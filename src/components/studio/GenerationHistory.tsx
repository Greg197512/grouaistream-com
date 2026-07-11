import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import {
  Music, Heart, Download, Play, Loader2, RefreshCw, Library, Trash2, Plus,
  MoreHorizontal, AudioLines, ImagePlus, Crown, FileAudio, Link2, Share2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadAudio, downloadAudioAsWav, startStems, waitForStems, invokeStudioEngine, isSubscriptionError } from "@/lib/hubStudio";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Biblioteka wygenerowanych utworów w stylu Suno: każdy wiersz ma okładkę,
// tytuł, styl, status na żywo, odtwarzanie i pobieranie. Te same funkcje dla
// wszystkich użytkowników.

const HUB_STORAGE = "https://bmwtydwpevzhbdplilbr.supabase.co/storage/v1/object/public/acestep";

interface Generation {
  id: string;
  title: string;
  genre: string;
  audio_url: string | null;
  instrumental: boolean;
  created_at: string;
  status: string;
  replicate_id?: string | null;
}

function CoverThumb({ gen, version }: { gen: Generation; version: number }) {
  const [failed, setFailed] = useState(false);
  const coverUrl = gen.replicate_id
    ? `${HUB_STORAGE}/${gen.replicate_id}-cover.jpg${version ? `?v=${version}` : ""}`
    : null;

  if (!coverUrl || failed) {
    return (
      <div className="w-14 h-14 shrink-0 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#FF6B00] to-[#9333EA]">
        <Music className="h-6 w-6 text-white/90" />
      </div>
    );
  }
  // Najazd = podskok z obrotem i powiększeniem; zejście = sprężysty powrót.
  return (
    <motion.img
      src={coverUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-14 h-14 shrink-0 rounded-lg object-cover border border-[#FF6B00]/20 cursor-zoom-in origin-center"
      whileHover={{
        scale: 1.9,
        rotate: [0, -12, 8, 0],
        y: -10,
        zIndex: 40,
        boxShadow: "0 0 40px rgba(255,107,0,0.45), 0 18px 50px rgba(0,0,0,0.7)",
        borderRadius: 16,
      }}
      transition={{ type: "spring", stiffness: 320, damping: 15 }}
      style={{ position: "relative", zIndex: 1 }}
    />
  );
}

export const GenerationHistory = () => {
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [coverVersion, setCoverVersion] = useState(0);
  const [stemsDialog, setStemsDialog] = useState<{
    open: boolean; title: string; loading: boolean; elapsed: number;
    stems: Record<string, string> | null;
  }>({ open: false, title: "", loading: false, elapsed: 0, stems: null });
  const timerRef = useRef<number | null>(null);

  const loadGenerations = useCallback(async () => {
    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .in("status", ["completed", "pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && data) setGenerations(data as Generation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadGenerations();
  }, [user, loadGenerations]);

  // Nowy utwór z kompozytora → natychmiast odśwież „Twoje utwory”
  useEffect(() => {
    const onChanged = () => void loadGenerations();
    window.addEventListener("grouai:generations-changed", onChanged);
    return () => window.removeEventListener("grouai:generations-changed", onChanged);
  }, [loadGenerations]);

  // Auto-odświeżanie, dopóki coś się generuje
  useEffect(() => {
    const hasPending = generations.some((g) => g.status === "pending" || g.status === "processing");
    if (!hasPending) return;
    timerRef.current = window.setInterval(() => void loadGenerations(), 15000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [generations, loadGenerations]);

  const play = (gen: Generation) => {
    if (!gen.audio_url) return;
    playTrack({
      id: gen.id,
      title: gen.title,
      artist: "GrouAI Studio",
      album: "AI Generated",
      duration: 180,
      audio_url: gen.audio_url,
      cover_url: gen.replicate_id ? `${HUB_STORAGE}/${gen.replicate_id}-cover.jpg` : null,
      genre: gen.genre || "AI",
      mood: null,
    });
  };

  const download = async (gen: Generation) => {
    if (!gen.audio_url) return;
    setDownloadingId(gen.id);
    try {
      await downloadAudio(gen.audio_url, `${gen.title || "grouai-track"}.mp3`);
      toast.success("Pobieranie rozpoczęte 🎵");
    } catch {
      // awaryjnie otwórz w nowej karcie
      window.open(gen.audio_url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  // Pobierz WAV wysokiej jakości (konwersja w przeglądarce)
  const downloadWav = async (gen: Generation) => {
    if (!gen.audio_url) return;
    setDownloadingId(gen.id);
    toast.loading("Przygotowuję WAV HQ…", { id: "wav" });
    try {
      await downloadAudioAsWav(gen.audio_url, `${gen.title || "grouai-track"}.wav`);
      toast.success("WAV pobrany 🎧", { id: "wav" });
    } catch (e: any) {
      toast.error("Błąd WAV: " + (e?.message || "spróbuj MP3"), { id: "wav" });
    } finally {
      setDownloadingId(null);
    }
  };

  // Rozdziel na ścieżki (wokal/perkusja/bas/reszta) — Demucs, jak w Suno
  const splitStems = async (gen: Generation) => {
    if (!gen.audio_url) return;
    setStemsDialog({ open: true, title: gen.title, loading: true, elapsed: 0, stems: null });
    try {
      const taskId = await startStems(gen.audio_url);
      const stems = await waitForStems(taskId, gen.replicate_id || gen.id, (sec) =>
        setStemsDialog((s) => ({ ...s, elapsed: sec }))
      );
      setStemsDialog((s) => ({ ...s, loading: false, stems }));
      toast.success("Ścieżki gotowe! 🎚️");
    } catch (e: any) {
      setStemsDialog((s) => ({ ...s, open: false, loading: false }));
      if (isSubscriptionError(e)) toast.error("Rozdzielanie na ścieżki wymaga planu Pro lub Ultimate");
      else toast.error("Nie udało się rozdzielić: " + (e?.message || "błąd"));
    }
  };

  // Nowa okładka AI (darmowa) — nadpisuje obecną
  const regenerateCover = async (gen: Generation) => {
    if (!gen.replicate_id) { toast.error("Ten utwór nie obsługuje okładek AI"); return; }
    toast.loading("🎨 Generuję nową okładkę…", { id: "recover" });
    const { data, error } = await invokeStudioEngine("studio-cover", {
      id: gen.replicate_id, title: gen.title, style: gen.genre,
    });
    if (error || !data?.cover_url) {
      toast.error("Nie udało się wygenerować okładki", { id: "recover" });
    } else {
      setCoverVersion(Date.now());
      toast.success("Nowa okładka gotowa! 🎨", { id: "recover" });
    }
  };

  // „Dodaj do Nowości” — publikacja utworu na stronie głównej (sekcja „Nowe na serwerze”).
  // RLS na LIVE wymaga user_id = zalogowany użytkownik.
  const addToNew = async (gen: Generation) => {
    if (!gen.audio_url) return;
    if (!user) { toast.error("Zaloguj się, aby publikować"); return; }
    try {
      const artistName = user.user_metadata?.display_name || user.email?.split("@")[0] || "GrouAI Studio";
      const { error } = await supabase.from("tracks").insert({
        user_id: user.id,
        title: gen.title,
        artist: artistName,
        album: "AI Generated",
        duration: 180,
        audio_url: gen.audio_url,
        cover_url: gen.replicate_id ? `${HUB_STORAGE}/${gen.replicate_id}-cover.jpg` : null,
        genre: gen.genre || "AI",
        mood: "generated",
      });
      if (error) throw error;
      toast.success(`„${gen.title}” jest już na stronie głównej w „Nowe na serwerze”! 🚀`);
    } catch (e: any) {
      toast.error("Nie udało się opublikować: " + (e?.message || "błąd"));
    }
  };

  // Kopiuj link do pobrania
  const copyLink = async (gen: Generation) => {
    if (!gen.audio_url) return;
    try {
      await navigator.clipboard.writeText(gen.audio_url);
      toast.success("Link do utworu skopiowany 🔗");
    } catch {
      window.prompt("Skopiuj link do utworu:", gen.audio_url);
    }
  };

  // Wyślij / Udostępnij — natywne „wyślij do" (WhatsApp, Messenger, mail…)
  const shareTrack = async (gen: Generation) => {
    if (!gen.audio_url) return;
    const shareData = {
      title: gen.title,
      text: `Posłuchaj „${gen.title}” — stworzone w GrouAI Studio 🎧`,
      url: gen.audio_url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(gen.audio_url);
        toast.success("Link skopiowany — wklej go, gdzie chcesz wysłać 🔗");
      }
    } catch { /* użytkownik anulował */ }
  };

  const removeGeneration = async (gen: Generation) => {
    if (!window.confirm(`Usunąć „${gen.title}” z Twoich utworów? Tego nie można cofnąć.`)) return;
    const { error } = await supabase.from("generations").delete().eq("id", gen.id);
    if (error) {
      toast.error("Nie udało się usunąć: " + error.message);
    } else {
      setGenerations((prev) => prev.filter((g) => g.id !== gen.id));
      toast.success("Utwór usunięty 🗑️");
    }
  };

  const saveToFavorites = async (genId: string) => {
    if (!user) return;
    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      generation_id: genId,
    });
    if (error) {
      if (error.code === "23505") toast.info("Już jest w ulubionych!");
      else toast.error("Błąd zapisu");
    } else {
      toast.success("Dodano do ulubionych! ❤️");
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[#FF9500]">
          <Library className="h-5 w-5" />
          Twoje utwory
          {generations.length > 0 && (
            <span className="text-xs font-normal text-gray-400">({generations.length})</span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider text-black bg-gradient-to-r from-amber-300 to-yellow-500 shadow-[0_0_12px_#f59e0b60]">
            <Crown className="h-2.5 w-2.5" /> PREMIUM
          </span>
        </h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-gray-400 hover:text-white"
          onClick={() => void loadGenerations()}
          title="Odśwież"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {generations.length === 0 && !loading ? (
        <div className="p-6 rounded-xl border border-dashed border-[#FF6B00]/25 text-center text-sm text-gray-400">
          Tu pojawią się Twoje wygenerowane utwory 🎵
        </div>
      ) : (
        <div className="space-y-2">
          {generations.map((gen) => {
            const isPending = gen.status === "pending" || gen.status === "processing";
            return (
              <div
                key={gen.id}
                className={cn(
                  "group flex items-center gap-3 p-2.5 rounded-xl border border-[#FF6B00]/15 bg-[#1a1a2e]/60 backdrop-blur-sm transition-all hover:border-[#FF6B00]/45 hover:bg-[#1a1a2e]/90",
                  isPending && "opacity-80"
                )}
              >
                <CoverThumb gen={gen} version={coverVersion} />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{gen.title}</p>
                  <p className="text-[11px] text-[#FF9500]/70 truncate">
                    {gen.genre}
                    {gen.instrumental && " • instrumental"}
                    {" • "}
                    {new Date(gen.created_at).toLocaleDateString("pl-PL")}
                  </p>
                  {isPending && (
                    <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> tworzy się…
                    </p>
                  )}
                </div>

                {!isPending && gen.audio_url && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-full text-white shrink-0"
                      style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
                      onClick={() => play(gen)}
                      title="Odtwórz"
                    >
                      <Play className="h-4 w-4 ml-0.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-300 hover:text-white"
                      onClick={() => void download(gen)}
                      disabled={downloadingId === gen.id}
                      title="Pobierz MP3"
                    >
                      {downloadingId === gen.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />}
                    </Button>

                    {/* Menu opcji — jak w Suno */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white" title="Więcej opcji">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60 bg-[#1a1a2e] border-[#FF6B00]/30 text-white">
                        {/* Pobieranie */}
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void downloadWav(gen)}>
                          <FileAudio className="h-4 w-4 text-[#FF9500]" /> Pobierz WAV (HQ)
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void download(gen)}>
                          <Download className="h-4 w-4 text-gray-300" /> Pobierz MP3
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#FF6B00]/20" />
                        {/* Udostępnianie */}
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void shareTrack(gen)}>
                          <Share2 className="h-4 w-4 text-sky-400" /> Wyślij / Udostępnij
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void copyLink(gen)}>
                          <Link2 className="h-4 w-4 text-gray-300" /> Kopiuj link
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => gen.audio_url && window.open(gen.audio_url, "_blank")}>
                          <ExternalLink className="h-4 w-4 text-gray-300" /> Otwórz w nowej karcie
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#FF6B00]/20" />
                        {/* Obróbka AI */}
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void splitStems(gen)}>
                          <AudioLines className="h-4 w-4 text-purple-400" /> Rozdziel na ścieżki (AI)
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void regenerateCover(gen)}>
                          <ImagePlus className="h-4 w-4 text-pink-400" /> Nowa okładka (AI)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#FF6B00]/20" />
                        {/* Biblioteka */}
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void addToNew(gen)}>
                          <Plus className="h-4 w-4 text-emerald-400" /> Dodaj do Nowości
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void saveToFavorites(gen.id)}>
                          <Heart className="h-4 w-4 text-[#FF6B00]" /> Do ulubionych
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#FF6B00]/20" />
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-red-400 focus:text-red-300"
                          onClick={() => void removeGeneration(gen)}
                        >
                          <Trash2 className="h-4 w-4" /> Usuń
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Okno ścieżek (stems) — wokal / perkusja / bas / reszta */}
      <Dialog open={stemsDialog.open} onOpenChange={(o) => !stemsDialog.loading && setStemsDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="bg-[#1a1a2e] border-[#FF6B00]/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#FF9500]">
              <AudioLines className="h-5 w-5" />
              Ścieżki: {stemsDialog.title}
            </DialogTitle>
          </DialogHeader>
          {stemsDialog.loading ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#FF9500]" />
              <p className="text-sm text-gray-300">AI rozdziela utwór na ścieżki… {stemsDialog.elapsed}s</p>
              <p className="text-xs text-gray-500">wokal · perkusja · bas · reszta (~1–2 min)</p>
            </div>
          ) : stemsDialog.stems ? (
            <div className="space-y-2">
              {Object.entries(stemsDialog.stems).map(([name, url]) => {
                const label = ({ vocals: "🎤 Wokal", drums: "🥁 Perkusja", bass: "🎸 Bas", other: "🎹 Reszta (instrumenty)", guitar: "🎸 Gitara", piano: "🎹 Pianino" } as Record<string, string>)[name] || name;
                return (
                  <div key={name} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#FF6B00]/20 bg-[#0f0f1e]/60">
                    <span className="text-sm font-medium">{label}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-gray-200"
                        onClick={() => { const a = new Audio(url); void a.play(); }}>
                        <Play className="h-3.5 w-3.5" /> Odsłuchaj
                      </Button>
                      <Button size="sm" className="h-8 gap-1.5 text-white" style={{ background: "linear-gradient(135deg, #FF6B00, #FF9500)" }}
                        onClick={() => void downloadAudio(url, `${stemsDialog.title}-${name}.mp3`).catch(() => window.open(url, "_blank"))}>
                        <Download className="h-3.5 w-3.5" /> Pobierz
                      </Button>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-gray-500 pt-1">Ścieżki zapisane na stałe — możesz do nich wrócić w każdej chwili.</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
