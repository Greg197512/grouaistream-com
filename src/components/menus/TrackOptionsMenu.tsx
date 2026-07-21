import { useState, useEffect, useRef, forwardRef } from "react";
import { motion } from "framer-motion";
import { useFloatingHearts, FloatingHeartsOverlay } from "@/components/effects/FloatingHearts";
import { RatingLikeModal } from "@/components/modals/RatingLikeModal";
import { usePlayer } from "@/contexts/PlayerContext";
import { CoffeeDialog } from "@/components/payments/CoffeeDialog";
import { 
  MoreHorizontal, 
  Heart, 
  Share2, 
  Copy, 
  Link, 
  Download, 
  ListPlus,
  ExternalLink,
  Twitter,
  MessageCircle,
  Trash2,
  Scissors,
  Coffee,
  DownloadCloud,
  Check,
  Gift,
  Headphones,
  ImagePlus,
  Film
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isOffline, saveOfflineTrack, removeOfflineTrack } from "@/lib/offlineLibrary";
import { CoverStudioModal } from "@/components/modals/CoverStudioModal";


interface TrackOptionsMenuProps {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackUrl?: string | null;
  className?: string;
  showLikeCount?: boolean;
  size?: "sm" | "md" | "lg";
  onLikeChange?: (liked: boolean) => void;
  onDelete?: () => void;
  showDelete?: boolean;
  playlistId?: string;
}

const TrackOptionsMenuComponent = (
  {
    trackId,
    trackTitle,
    trackArtist,
    trackUrl,
    className,
    showLikeCount = false,
    size = "md",
    onLikeChange,
    onDelete,
    showDelete = true,
    playlistId
  }: TrackOptionsMenuProps,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCoffeeDialog, setShowCoffeeDialog] = useState(false);
  const [showCoverStudio, setShowCoverStudio] = useState(false);
  const [trackOwnerId, setTrackOwnerId] = useState<string | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<{ id: string; title: string }[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  // Fetch właściciela utworu — żeby wiedzieć czy pokazać "Postaw kawę twórcy"
  // (ukrywamy dla własnych utworów; nie ma sensu fundować kawy samemu sobie)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tracks")
        .select("user_id")
        .eq("id", trackId)
        .maybeSingle();
      if (!cancelled) setTrackOwnerId(data?.user_id ?? null);
    })();
    return () => { cancelled = true; };
  }, [trackId]);

  useEffect(() => {
    const fetchLikeData = async () => {
      if (showLikeCount) {
        const { count } = await supabase
          .from("liked_songs")
          .select("*", { count: "exact", head: true })
          .eq("track_id", trackId);
        setLikeCount(count || 0);
      }

      if (user?.id) {
        const { data } = await supabase
          .from("liked_songs")
          .select("id")
          .eq("user_id", user.id)
          .eq("track_id", trackId)
          .maybeSingle();

        setIsLiked(!!data);
      } else {
        setIsLiked(false);
      }
    };

    fetchLikeData();

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trackId: string; liked: boolean };
      if (detail?.trackId === trackId) {
        setIsLiked(detail.liked);
        if (showLikeCount) {
          setLikeCount((prev) => Math.max(0, prev + (detail.liked ? 1 : -1)));
        }
      }
    };
    window.addEventListener("track-like-changed", handler);
    return () => window.removeEventListener("track-like-changed", handler);
  }, [trackId, user?.id, showLikeCount]);

  const handleLike = async () => {
    if (!user) {
      toast.error("Sign in to like songs");
      return;
    }

    setLoading(true);
    try {
      if (isLiked) {
        await supabase
          .from("liked_songs")
          .delete()
          .eq("user_id", user.id)
          .eq("track_id", trackId);
        
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
        window.dispatchEvent(new CustomEvent("track-like-changed", { detail: { trackId, liked: false } }));
        toast.success("Removed from Liked Songs");
        onLikeChange?.(false);
      } else {
        await supabase
          .from("liked_songs")
          .insert({ user_id: user.id, track_id: trackId });
        
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
        window.dispatchEvent(new CustomEvent("track-like-changed", { detail: { trackId, liked: true } }));
        toast.success("Added to Liked Songs");
        onLikeChange?.(true);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = trackUrl || `${window.location.origin}/track/${trackId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleShareTwitter = () => {
    const text = `🎵 Listening to "${trackTitle}" by ${trackArtist} on GrouAI Stream!`;
    const url = trackUrl || window.location.origin;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  };

  const handleShareWhatsApp = () => {
    const text = `🎵 Posłuchaj "${trackTitle}" by ${trackArtist} na GrouAI Stream! ${trackUrl || window.location.origin}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    // Use link click instead of window.open to avoid popup blockers
    const a = document.createElement("a");
    a.href = whatsappUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [downloading, setDownloading] = useState(false);

  // Prezent 🎁 — link do animowanej strony-prezentu (paczka → wir → piosenka+grafika).
  const giftUrl = `https://grouaistream.com/prezent/${trackId}`;
  const handleSendGift = async () => {
    const text = `🎁 Mam dla Ciebie prezent — „${trackTitle}" od ${trackArtist} w GrouAI Studio`;
    const nav = navigator as any;
    try {
      if (nav.share) {
        await nav.share({ title: "🎁 Prezent GrouAI Studio", text, url: giftUrl });
        return;
      }
    } catch { return; }
    const a = document.createElement("a");
    a.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + giftUrl)}`;
    a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Tryb offline — utwór zapisany w IndexedDB gra bez internetu.
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isOffline(trackId).then((v) => { if (!cancelled) setOfflineSaved(v); });
    return () => { cancelled = true; };
  }, [trackId]);

  const handleOffline = async () => {
    if (offlineSaved) {
      await removeOfflineTrack(trackId);
      setOfflineSaved(false);
      toast.success("Usunięto z trybu offline");
      return;
    }
    if (!trackUrl) {
      toast.error("Ten utwór nie ma pliku do pobrania offline");
      return;
    }
    setSavingOffline(true);
    toast.info("⬇️ Zapisuję do trybu offline…");
    try {
      await saveOfflineTrack(trackId, trackUrl, { title: trackTitle, artist: trackArtist });
      setOfflineSaved(true);
      toast.success("✅ Dostępne offline — zagra bez internetu");
    } catch {
      toast.error("Nie udało się zapisać offline (plik może blokować pobieranie)");
    } finally {
      setSavingOffline(false);
    }
  };

  const handleDownload = async () => {
    if (!trackUrl) {
      toast.error("Download not available for this track");
      return;
    }

    const confirmed = window.confirm(
      "Download consent: By downloading, you confirm you have the right to download this content for personal use. Continue?"
    );

    if (!confirmed) return;

    setDownloading(true);
    toast.info("💿 Wypalanie...", { duration: 3000 });

    try {
      const response = await fetch(trackUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = trackUrl.includes(".mp4") ? "mp4" : "mp3";
      a.download = `${trackArtist} - ${trackTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("✅ Pobrano na dysk!");
    } catch {
      // Fallback: direct link download
      const a = document.createElement("a");
      a.href = trackUrl;
      a.download = `${trackArtist} - ${trackTitle}.mp3`;
      a.target = "_self";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Download started");
    } finally {
      setDownloading(false);
    }
  };

  // Pobierz playlisty użytkownika (leniwie — dopiero gdy otwiera menu playlist).
  const loadMyPlaylists = async () => {
    if (playlistsLoaded || !user) return;
    const { data } = await supabase
      .from("playlists")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyPlaylists(data ?? []);
    setPlaylistsLoaded(true);
  };

  const handleAddToPlaylist = async (targetPlaylistId: string, targetTitle: string) => {
    if (!user) {
      toast.error("Zaloguj się, aby dodać do playlisty");
      return;
    }
    setAddingTo(targetPlaylistId);
    try {
      // Nie dubluj — sprawdź czy utwór już jest w tej playliście.
      const { data: existing } = await supabase
        .from("playlist_tracks")
        .select("id")
        .eq("playlist_id", targetPlaylistId)
        .eq("track_id", trackId)
        .maybeSingle();
      if (existing) {
        toast.info(`Ten utwór już jest w „${targetTitle}"`);
        return;
      }
      // Dołóż na koniec (kolejna pozycja).
      const { data: last } = await supabase
        .from("playlist_tracks")
        .select("position")
        .eq("playlist_id", targetPlaylistId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPos = (last?.position ?? -1) + 1;
      const { error } = await supabase
        .from("playlist_tracks")
        .insert({ playlist_id: targetPlaylistId, track_id: trackId, position: nextPos });
      if (error) throw error;
      toast.success(`Dodano „${trackTitle}" do „${targetTitle}" 🎶`);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (e) {
      console.error("Add to playlist failed:", e);
      toast.error("Nie udało się dodać do playlisty");
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreatePlaylistAndAdd = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby utworzyć playlistę");
      return;
    }
    const name = window.prompt("Nazwa nowej playlisty:", trackTitle);
    if (!name || !name.trim()) return;
    setAddingTo("__new__");
    try {
      const { data: created, error: createErr } = await supabase
        .from("playlists")
        .insert({ title: name.trim(), user_id: user.id })
        .select("id, title")
        .single();
      if (createErr || !created) throw createErr;
      const { error: addErr } = await supabase
        .from("playlist_tracks")
        .insert({ playlist_id: created.id, track_id: trackId, position: 0 });
      if (addErr) throw addErr;
      setMyPlaylists((prev) => [{ id: created.id, title: created.title }, ...prev]);
      toast.success(`Utworzono „${created.title}" i dodano utwór 🎶`);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (e) {
      console.error("Create playlist failed:", e);
      toast.error("Nie udało się utworzyć playlisty");
    } finally {
      setAddingTo(null);
    }
  };

  // Nowa okładka 🎨 — właściciel utworu może podmienić grafikę.
  // Plik idzie do publicznego bucketa "music" (covers/...), a tracks.cover_url
  // dostaje nowy adres. RLS przepuszcza UPDATE tylko dla właściciela utworu.
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const handleCoverPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("To nie jest grafika — wybierz obrazek (JPG, PNG lub WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Okładka może ważyć maksymalnie 5 MB");
      return;
    }
    setCoverUploading(true);
    toast.info("🎨 Przymierzam nową okładkę…");
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `covers/${trackId}-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("music")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("music").getPublicUrl(path);
      const { data: updated, error: updErr } = await supabase
        .from("tracks")
        .update({ cover_url: pub.publicUrl })
        .eq("id", trackId)
        .select("id");
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        throw new Error("Tylko autor utworu może zmienić jego okładkę");
      }
      toast.success(`✨ Gotowe! „${trackTitle}" ma nową okładkę`);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (err) {
      console.error("Cover update failed:", err);
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.includes("autor") ? msg : "Nie udało się założyć nowej okładki — spróbuj ponownie");
    } finally {
      setCoverUploading(false);
    }
  };

  // Szybka okładka AI z 3-kropek — bez otwierania Cover Studio.
  const [aiCoverBusy, setAiCoverBusy] = useState(false);
  const handleQuickAICover = async () => {
    if (aiCoverBusy) return;
    setAiCoverBusy(true);
    toast.info("🎨 Maluję okładkę AI…");
    try {
      const { data, error } = await supabase.functions.invoke("ai-cover-generate", {
        body: {
          title: trackTitle,
          style: "",
          description: `${trackTitle} — ${trackArtist}`,
          mode: "auto",
        },
      });
      if (error) throw error;
      const coverUrl = data?.cover_url;
      if (!coverUrl) throw new Error("AI nie zwróciło obrazu");
      const { error: updErr } = await supabase
        .from("tracks")
        .update({ cover_url: coverUrl })
        .eq("id", trackId);
      if (updErr) throw updErr;
      toast.success("✨ Nowa okładka AI założona!");
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (err) {
      console.error("Quick AI cover failed:", err);
      const msg = err instanceof Error ? err.message : "Nie udało się wygenerować okładki";
      toast.error(msg);
    } finally {
      setAiCoverBusy(false);
    }
  };

  const handleCutTrack = async () => {
    // Store track data in clipboard for cut/paste functionality
    const trackData = JSON.stringify({ trackId, trackTitle, trackArtist, playlistId });
    try {
      await navigator.clipboard.writeText(`GROOVEAI_TRACK:${trackData}`);
      toast.success(`"${trackTitle}" skopiowany - wklej do innej playlisty`);
    } catch (error) {
      toast.error("Failed to cut track");
    }
  };

  const handleRemoveFromPlaylist = async () => {
    if (!user || !playlistId) return;

    setDeleteLoading(true);
    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId);

    if (error) {
      console.error("Error removing track:", error);
      toast.error("Nie udało się usunąć");
    } else {
      toast.success(`"${trackTitle}" usunięty z playlisty`);
      onDelete?.();
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    }
    setDeleteLoading(false);
  };

  const handleDeleteTrack = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby usunąć utwór");
      return;
    }

    const confirmed = window.confirm(
      `Usunąć "${trackTitle}" z biblioteki? Zostanie usunięty ze wszystkich playlist i ulubionych.`
    );

    if (!confirmed) return;

    setDeleteLoading(true);

    // Remove from liked songs (user's own)
    await supabase.from("liked_songs").delete().eq("track_id", trackId).eq("user_id", user.id);

    // Remove from listening history (user's own)
    await supabase.from("listening_history").delete().eq("track_id", trackId).eq("user_id", user.id);

    // Remove from user's playlists
    const { data: userPlaylists } = await supabase
      .from("playlists")
      .select("id")
      .eq("user_id", user.id);
    
    if (userPlaylists && userPlaylists.length > 0) {
      const playlistIds = userPlaylists.map(p => p.id);
      await supabase
        .from("playlist_tracks")
        .delete()
        .eq("track_id", trackId)
        .in("playlist_id", playlistIds);
    }

    // Try to delete the track record (works for admins only)
    await supabase.from("tracks").delete().eq("id", trackId);

    toast.success(`"${trackTitle}" usunięty`);
    onDelete?.();
    window.dispatchEvent(new CustomEvent("track-list-changed"));
    setDeleteLoading(false);
  };

  const iconSize = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  }[size];

  return (
    <div ref={ref}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "p-1.5 rounded-full hover:bg-secondary/80 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              className
            )}
          >
            <MoreHorizontal className={cn(iconSize, "text-muted-foreground hover:text-foreground")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none truncate">{trackTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{trackArtist}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Like button */}
          <DropdownMenuItem onClick={handleLike} disabled={loading} className="cursor-pointer">
            <Heart className={cn("mr-2 h-4 w-4", isLiked && "fill-primary text-primary")} />
            <span className="flex-1">{isLiked ? "Unlike" : "Daj ❤️"}</span>
            {showLikeCount && likeCount > 0 && (
              <span className="text-xs text-muted-foreground">{likeCount}</span>
            )}
          </DropdownMenuItem>

          {/* Add to playlist — submenu z playlistami użytkownika */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger onPointerEnter={loadMyPlaylists} onClick={loadMyPlaylists}>
              <ListPlus className="mr-2 h-4 w-4" />
              Dodaj do playlisty
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto w-56">
              <DropdownMenuItem
                onClick={handleCreatePlaylistAndAdd}
                disabled={addingTo === "__new__"}
                className="cursor-pointer text-primary focus:text-primary"
              >
                <ListPlus className="mr-2 h-4 w-4" />
                + Nowa playlista
              </DropdownMenuItem>
              {myPlaylists.length > 0 && <DropdownMenuSeparator />}
              {!user ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">Zaloguj się, aby dodawać</div>
              ) : !playlistsLoaded ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">Ładowanie…</div>
              ) : myPlaylists.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">Brak playlist — utwórz nową powyżej</div>
              ) : (
                myPlaylists.map((pl) => (
                  <DropdownMenuItem
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl.id, pl.title)}
                    disabled={addingTo === pl.id}
                    className="cursor-pointer"
                  >
                    <ListPlus className="mr-2 h-4 w-4 opacity-60" />
                    <span className="truncate">{pl.title}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Szybkie: wgraj własne zdjęcie jako okładkę */}
          <DropdownMenuItem
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading}
            className="cursor-pointer text-sky-300 focus:text-sky-200 focus:bg-sky-500/10"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            <span className="flex-1">{coverUploading ? "Wgrywam…" : "Wgraj zdjęcie 📷"}</span>
          </DropdownMenuItem>

          {/* Szybkie: wygeneruj okładkę AI od razu (bez otwierania Studia) */}
          <DropdownMenuItem
            onClick={handleQuickAICover}
            disabled={aiCoverBusy}
            className="cursor-pointer text-amber-300 focus:text-amber-200 focus:bg-amber-500/10"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            <span className="flex-1">{aiCoverBusy ? "Maluję…" : "AI okładka ⚡"}</span>
          </DropdownMenuItem>

          {/* Cover Studio — okładki i teledyski AI (tekst→obraz, zdj→obraz, tekst→wideo, zdj→wideo) */}
          <DropdownMenuItem
            onClick={() => setShowCoverStudio(true)}
            className="cursor-pointer text-fuchsia-300 focus:text-fuchsia-200 focus:bg-fuchsia-500/10"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            <span className="flex-1">Cover Studio 🎨🎬</span>
          </DropdownMenuItem>

          {/* Cut/Copy for moving */}
          <DropdownMenuItem onClick={handleCutTrack} className="cursor-pointer">
            <Scissors className="mr-2 h-4 w-4" />
            Cut (to paste elsewhere)
          </DropdownMenuItem>

          {/* Postaw kawę twórcy (real money via Paddle, 90% → twórca) */}
          {trackOwnerId && trackOwnerId !== user?.id && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCoffeeDialog(true)}
                className="cursor-pointer text-amber-400 focus:text-amber-300 focus:bg-amber-500/10"
              >
                <Coffee className="mr-2 h-4 w-4" />
                <span className="flex-1">Postaw kawę twórcy ☕</span>
                <span className="text-[10px] text-muted-foreground">1$ / 3$ / 5$</span>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {/* Rozdziel na ścieżki (stemy) — otwiera odtwarzacz solo/mute */}
          {trackUrl && (
            <DropdownMenuItem
              onClick={() => window.dispatchEvent(new CustomEvent("grouai:open-stems", { detail: { audioUrl: trackUrl, title: trackTitle } }))}
              className="cursor-pointer text-cyan-300 focus:text-cyan-200 focus:bg-cyan-500/10"
            >
              <Headphones className="mr-2 h-4 w-4" />
              <span className="flex-1">Rozdziel na ścieżki 🎚️</span>
            </DropdownMenuItem>
          )}

          {/* Prezent 🎁 — animowana strona-prezent (paczka → wir → piosenka) */}
          <DropdownMenuItem
            onClick={handleSendGift}
            className="cursor-pointer text-amber-300 focus:text-amber-200 focus:bg-amber-500/10"
          >
            <Gift className="mr-2 h-4 w-4" />
            <span className="flex-1">Wyślij prezent 🎁</span>
          </DropdownMenuItem>

          {/* Share submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Share2 className="mr-2 h-4 w-4" />
              Wyślij do
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleShareTwitter} className="cursor-pointer">
                <Twitter className="mr-2 h-4 w-4" />
                Share on X
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareWhatsApp} className="cursor-pointer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
                <Link className="mr-2 h-4 w-4" />
                Copy Link
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Copy link */}
          <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Kopiuj
          </DropdownMenuItem>

          {/* Download */}
          <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="cursor-pointer">
            {downloading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="mr-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
              </motion.div>
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {downloading ? "Wypalanie..." : "Pobierz Utwór"}
          </DropdownMenuItem>

          {/* Offline — zapisz w telefonie/przeglądarce, gra bez internetu */}
          <DropdownMenuItem onClick={handleOffline} disabled={savingOffline} className="cursor-pointer">
            {offlineSaved ? (
              <Check className="mr-2 h-4 w-4 text-emerald-400" />
            ) : (
              <DownloadCloud className="mr-2 h-4 w-4" />
            )}
            <span className="flex-1">
              {savingOffline ? "Zapisuję…" : offlineSaved ? "Dostępne offline" : "Pobierz offline"}
            </span>
            {offlineSaved && <span className="text-[10px] text-emerald-400">usuń</span>}
          </DropdownMenuItem>

          {/* Open original */}
          {trackUrl && (
            <DropdownMenuItem 
              onClick={() => window.open(trackUrl, "_blank")} 
              className="cursor-pointer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Original
            </DropdownMenuItem>
          )}

          {/* Remove from playlist */}
          {playlistId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleRemoveFromPlaylist} 
                disabled={deleteLoading}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Usuń z playlisty
              </DropdownMenuItem>
            </>
          )}

          {/* Delete track from library */}
          {showDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleDeleteTrack} 
                disabled={deleteLoading}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Usuń z biblioteki
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ukryty picker pliku dla nowej okładki (otwierany z menu) */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleCoverPicked}
      />

      {/* Coffee Dialog (real-money tip via Paddle, 90% → twórca utworu) */}
      <CoffeeDialog
        open={showCoffeeDialog}
        onOpenChange={setShowCoffeeDialog}
        recipientUserId={trackOwnerId ?? undefined}
        recipientTrackId={trackId}
        recipientName={trackArtist}
      />

      <CoverStudioModal
        open={showCoverStudio}
        onOpenChange={setShowCoverStudio}
        trackId={trackId}
        trackTitle={trackTitle}
        trackArtist={trackArtist}
      />
    </div>
  );
};

export const TrackOptionsMenu = forwardRef<HTMLDivElement, TrackOptionsMenuProps>(TrackOptionsMenuComponent);
TrackOptionsMenu.displayName = "TrackOptionsMenu";

// Separate like button component for inline use
interface LikeButtonProps {
  trackId: string;
  className?: string;
  showCount?: boolean;
}

const LikeButtonComponent = (
  { trackId, className, showCount = false }: LikeButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) => {
  const { user } = useAuth();
  const player = (() => { try { return usePlayer(); } catch { return null; } })();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [trackMeta, setTrackMeta] = useState<{ title: string; artist: string } | null>(null);
  const [isOwn, setIsOwn] = useState(false);
  const { hearts, spawnHearts } = useFloatingHearts();

  const fetchData = async () => {
    if (showCount) {
      const { count } = await supabase
        .from("liked_songs")
        .select("*", { count: "exact", head: true })
        .eq("track_id", trackId);
      setLikeCount(count || 0);
    }
    // Sprawdź właściciela utworu
    const { data: trackOwner } = await supabase
      .from("tracks")
      .select("user_id")
      .eq("id", trackId)
      .maybeSingle();
    if (user?.id && trackOwner?.user_id === user.id) {
      setIsOwn(true);
      setIsLiked(false);
      return;
    }
    setIsOwn(false);
    if (user?.id) {
      const { data } = await supabase
        .from("liked_songs")
        .select("id")
        .eq("user_id", user.id)
        .eq("track_id", trackId)
        .maybeSingle();
      setIsLiked(!!data);
    } else {
      setIsLiked(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Sync with player + other LikeButtons via global event
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trackId: string; liked: boolean };
      if (detail?.trackId === trackId) {
        setIsLiked(detail.liked);
        if (showCount) {
          setLikeCount((prev) => Math.max(0, prev + (detail.liked ? 1 : -1)));
        }
      }
    };
    window.addEventListener("track-like-changed", handler);
    return () => window.removeEventListener("track-like-changed", handler);
  }, [trackId, user?.id, showCount]);

  const broadcast = (liked: boolean) => {
    window.dispatchEvent(new CustomEvent("track-like-changed", { detail: { trackId, liked } }));
  };

  const handleUnlike = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase
        .from("liked_songs")
        .delete()
        .eq("user_id", user.id)
        .eq("track_id", trackId);
      setIsLiked(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
      broadcast(false);
      toast.success("Removed from Liked Songs");
    } catch {
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to like songs");
      return;
    }
    if (isOwn) {
      toast.error("Nie możesz polubić własnego utworu 🎵");
      return;
    }

    if (isLiked) {
      handleUnlike();
      return;
    }

    // Nowe polubienie → wymaga oceny gwiazdkowej (jak w playerze)
    spawnHearts(e);
    // Pobierz tytuł/artystę utworu, jeśli nie znamy
    let meta = trackMeta;
    if (!meta) {
      const { data } = await supabase
        .from("tracks")
        .select("title, artist")
        .eq("id", trackId)
        .maybeSingle();
      meta = { title: data?.title || "Utwór", artist: data?.artist || "Artysta" };
      setTrackMeta(meta);
    }
    setShowRatingModal(true);
  };

  // Listened seconds — z playera jeśli to aktualny utwór, inaczej 30s (próg minimalny)
  const listenedSeconds =
    player?.currentTrack?.id === trackId ? player.currentTime : 30;

  return (
    <>
      <button
        ref={ref}
        onClick={handleLike}
        disabled={loading || isOwn}
        title={isOwn ? "To Twój utwór — nie możesz go polubić" : undefined}
        className={cn(
          "flex items-center gap-1 p-1.5 rounded-full transition-all",
          "hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "active:scale-95",
          isOwn && "opacity-40 cursor-not-allowed",
          className
        )}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition-all duration-200",
            isLiked 
              ? "fill-primary text-primary scale-110" 
              : "text-muted-foreground hover:text-foreground scale-100"
          )}
        />
        {showCount && likeCount > 0 && (
          <span className="text-xs text-muted-foreground">{likeCount}</span>
        )}
      </button>
      <FloatingHeartsOverlay hearts={hearts} />
      {trackMeta && (
        <RatingLikeModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          trackId={trackId}
          trackTitle={trackMeta.title}
          trackArtist={trackMeta.artist}
          listenedSeconds={listenedSeconds}
          onSuccess={() => {
            setIsLiked(true);
            setLikeCount((prev) => prev + 1);
            broadcast(true);
          }}
        />
      )}
    </>
  );
};

export const LikeButton = forwardRef<HTMLButtonElement, LikeButtonProps>(LikeButtonComponent);
LikeButton.displayName = "LikeButton";
