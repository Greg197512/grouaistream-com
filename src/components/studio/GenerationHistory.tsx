import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Heart, Download, Play, Loader2, RefreshCw, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadAudio } from "@/lib/hubStudio";
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

function CoverThumb({ gen }: { gen: Generation }) {
  const [failed, setFailed] = useState(false);
  const coverUrl = gen.replicate_id ? `${HUB_STORAGE}/${gen.replicate_id}-cover.jpg` : null;

  if (!coverUrl || failed) {
    return (
      <div className="w-14 h-14 shrink-0 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#FF6B00] to-[#9333EA]">
        <Music className="h-6 w-6 text-white/90" />
      </div>
    );
  }
  return (
    <img
      src={coverUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-14 h-14 shrink-0 rounded-lg object-cover border border-[#FF6B00]/20"
    />
  );
}

export const GenerationHistory = () => {
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
                <CoverThumb gen={gen} />

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
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-[#FF6B00] hover:text-[#FF9500]"
                      onClick={() => void saveToFavorites(gen.id)}
                      title="Do ulubionych"
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
