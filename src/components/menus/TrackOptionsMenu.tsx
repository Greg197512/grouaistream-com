import { useState, useEffect, forwardRef } from "react";
import { 
  MoreHorizontal, 
  Heart, 
  Share2, 
  Copy, 
  Link, 
  Download, 
  ListPlus,
  ExternalLink,
  Twitter
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
    onLikeChange
  }: TrackOptionsMenuProps,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch initial like status and count
  useEffect(() => {
    const fetchLikeData = async () => {
      // Get like count
      const { count } = await supabase
        .from("liked_songs")
        .select("*", { count: "exact", head: true })
        .eq("track_id", trackId);
      
      setLikeCount(count || 0);

      // Check if user liked this track
      if (user) {
        const { data } = await supabase
          .from("liked_songs")
          .select("id")
          .eq("user_id", user.id)
          .eq("track_id", trackId)
          .maybeSingle();
        
        setIsLiked(!!data);
      }
    };

    fetchLikeData();
  }, [trackId, user]);

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
    const text = `🎵 Listening to "${trackTitle}" by ${trackArtist} on GrooveAI Stream!`;
    const url = trackUrl || window.location.origin;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  };

  const handleDownload = () => {
    if (!trackUrl) {
      toast.error("Download not available for this track");
      return;
    }

    // GDPR consent popup
    const confirmed = window.confirm(
      "Download consent: By downloading, you confirm you have the right to download this content for personal use. Continue?"
    );

    if (confirmed) {
      window.open(trackUrl, "_blank");
      toast.success("Download started");
    }
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
          <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
            <Download className="mr-2 h-4 w-4" />
            Pobierz Utwór
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

  useEffect(() => {
    const fetchData = async () => {
      const { count } = await supabase
        .from("liked_songs")
        .select("*", { count: "exact", head: true })
        .eq("track_id", trackId);
      
      setLikeCount(count || 0);

      if (user) {
        const { data } = await supabase
          .from("liked_songs")
          .select("id")
          .eq("user_id", user.id)
          .eq("track_id", trackId)
          .maybeSingle();
        
        setIsLiked(!!data);
      }
    };

    fetchData();
  }, [trackId, user]);

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
  );
};

export const LikeButton = forwardRef<HTMLButtonElement, LikeButtonProps>(LikeButtonComponent);
LikeButton.displayName = "LikeButton";
