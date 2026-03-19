import { useState, useEffect, forwardRef } from "react";
import { motion } from "framer-motion";
import { useFloatingHearts, FloatingHeartsOverlay } from "@/components/effects/FloatingHearts";
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
  Scissors
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
        toast.success("Removed from Liked Songs");
        onLikeChange?.(false);
      } else {
        await supabase
          .from("liked_songs")
          .insert({ user_id: user.id, track_id: trackId });
        
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
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

          {/* Add to playlist */}
          <DropdownMenuItem className="cursor-pointer">
            <ListPlus className="mr-2 h-4 w-4" />
            Add to Playlist
          </DropdownMenuItem>

          {/* Cut/Copy for moving */}
          <DropdownMenuItem onClick={handleCutTrack} className="cursor-pointer">
            <Scissors className="mr-2 h-4 w-4" />
            Cut (to paste elsewhere)
          </DropdownMenuItem>

          <DropdownMenuSeparator />

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
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { hearts, spawnHearts } = useFloatingHearts();

  useEffect(() => {
    const fetchData = async () => {
      if (showCount) {
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

    fetchData();
  }, [trackId, user?.id, showCount]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      } else {
        // Spawn hearts on like
        spawnHearts(e);
        await supabase
          .from("liked_songs")
          .insert({ user_id: user.id, track_id: trackId });
        
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        ref={ref}
        onClick={handleLike}
        disabled={loading}
        className={cn(
          "flex items-center gap-1 p-1.5 rounded-full transition-all",
          "hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "active:scale-95",
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
    </>
  );
};

export const LikeButton = forwardRef<HTMLButtonElement, LikeButtonProps>(LikeButtonComponent);
LikeButton.displayName = "LikeButton";
