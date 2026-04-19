import { useEffect, useState } from "react";
import { Heart, Bookmark, Share2, Twitter, Facebook, Linkedin, Link2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  postId: string;
  postUrl: string;
  postTitle: string;
  onScrollToComments?: () => void;
}

export const BlogPostActions = ({ postId, postUrl, postTitle, onScrollToComments }: Props) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("blog_post_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId);
      setLikeCount(count || 0);

      if (user) {
        const [{ data: l }, { data: s }] = await Promise.all([
          supabase.from("blog_post_likes").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
          supabase.from("blog_post_saves").select("id").eq("post_id", postId).eq("user_id", user.id).maybeSingle(),
        ]);
        setLiked(!!l);
        setSaved(!!s);
      }
    })();
  }, [postId, user]);

  const toggleLike = async () => {
    if (!user) return toast.error("Zaloguj się, by polubić artykuł");
    if (busy) return;
    setBusy(true);
    if (liked) {
      await supabase.from("blog_post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      setLiked(false);
      setLikeCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("blog_post_likes").insert({ post_id: postId, user_id: user.id });
      setLiked(true);
      setLikeCount((n) => n + 1);
    }
    setBusy(false);
  };

  const toggleSave = async () => {
    if (!user) return toast.error("Zaloguj się, by zapisać artykuł");
    if (busy) return;
    setBusy(true);
    if (saved) {
      await supabase.from("blog_post_saves").delete().eq("post_id", postId).eq("user_id", user.id);
      setSaved(false);
      toast.success("Usunięto z zapisanych");
    } else {
      await supabase.from("blog_post_saves").insert({ post_id: postId, user_id: user.id });
      setSaved(true);
      toast.success("Zapisano na później");
    }
    setBusy(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.success("Link skopiowany");
    } catch {
      toast.error("Nie udało się skopiować");
    }
  };

  const shareUrl = encodeURIComponent(postUrl);
  const shareText = encodeURIComponent(postTitle);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleLike}
        className={`gap-2 transition-all ${liked ? "border-primary text-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]" : ""}`}
      >
        <Heart className={`w-4 h-4 ${liked ? "fill-primary" : ""}`} />
        <span className="tabular-nums">{likeCount}</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={toggleSave}
        className={`gap-2 ${saved ? "border-accent text-accent bg-accent/10" : ""}`}
      >
        <Bookmark className={`w-4 h-4 ${saved ? "fill-accent" : ""}`} />
        <span className="hidden sm:inline">{saved ? "Zapisano" : "Zapisz"}</span>
      </Button>

      {onScrollToComments && (
        <Button variant="outline" size="sm" onClick={onScrollToComments} className="gap-2">
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Komentarze</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Udostępnij</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur border-border">
          <DropdownMenuItem asChild>
            <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noopener noreferrer">
              <Twitter className="w-4 h-4 mr-2" /> X / Twitter
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer">
              <Facebook className="w-4 h-4 mr-2" /> Facebook
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} target="_blank" rel="noopener noreferrer">
              <Linkedin className="w-4 h-4 mr-2" /> LinkedIn
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink}>
            <Link2 className="w-4 h-4 mr-2" /> Kopiuj link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
