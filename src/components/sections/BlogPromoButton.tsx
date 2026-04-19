import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper, Copy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LatestPost {
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
}

const LONG_PRESS_MS = 600;

export const BlogPromoButton = () => {
  const [post, setPost] = useState<LatestPost | null>(null);
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressTimer = useRef<number | null>(null);
  const progressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts")
        .select("slug, title, description, cover_url")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPost(data as LatestPost);
    })();
  }, []);

  const cleanup = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    pressTimer.current = null;
    progressTimer.current = null;
    setPressing(false);
    setProgress(0);
  };

  const startPress = () => {
    if (!post) return;
    longPressFired.current = false;
    setPressing(true);
    setProgress(0);

    const start = Date.now();
    progressTimer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / LONG_PRESS_MS) * 100);
      setProgress(pct);
    }, 16);

    pressTimer.current = window.setTimeout(async () => {
      longPressFired.current = true;
      const url = `${window.location.origin}/blog/${post.slug}`;
      const richMarkdown = `🔥 [${post.title}](${url})\n\n${post.description}`;

      try {
        if (navigator.clipboard && (window as any).ClipboardItem) {
          const html = `<a href="${url}" style="font-weight:600;color:#ff6b1a;text-decoration:none">🔥 ${post.title}</a><br/><span style="color:#666">${post.description}</span>`;
          const item = new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([`${richMarkdown}\n${url}`], { type: "text/plain" }),
          });
          await navigator.clipboard.write([item]);
        } else {
          await navigator.clipboard.writeText(`${richMarkdown}\n${url}`);
        }
        toast.success("🔗 Link skopiowany — wklej gdziekolwiek", {
          description: "Działa w mailach, czatach, social media",
        });
      } catch {
        toast.error("Nie udało się skopiować linku");
      }
      cleanup();
    }, LONG_PRESS_MS);
  };

  const endPress = (e?: React.MouseEvent | React.TouchEvent) => {
    if (longPressFired.current && e) {
      e.preventDefault();
    }
    cleanup();
  };

  if (!post) return null;

  return (
    <Link
      to={`/blog/${post.slug}`}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={() => cleanup()}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (longPressFired.current) {
          e.preventDefault();
          longPressFired.current = false;
        }
      }}
      className={cn(
        "group relative inline-flex items-center gap-3 select-none",
        "px-5 py-3 rounded-2xl overflow-hidden",
        "bg-gradient-to-r from-primary/20 via-accent/15 to-primary/20",
        "border border-primary/40 hover:border-primary/70",
        "shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]",
        "hover:shadow-[0_0_36px_-6px_hsl(var(--primary)/0.9)]",
        "transition-all duration-300",
        pressing && "scale-[0.98]"
      )}
      title="Kliknij: otwórz · Przytrzymaj: skopiuj link do udostępniania"
    >
      <div
        className="absolute inset-0 bg-primary/30 origin-left transition-none pointer-events-none"
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden
      />

      {post.cover_url ? (
        <img
          src={post.cover_url}
          alt=""
          className="relative h-10 w-10 rounded-lg object-cover ring-1 ring-primary/40"
          loading="lazy"
        />
      ) : (
        <div className="relative h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center ring-1 ring-primary/40">
          <Newspaper className="h-5 w-5 text-primary" />
        </div>
      )}

      <div className="relative flex flex-col min-w-0">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-primary/90">
          <Sparkles className="h-3 w-3" />
          Najnowszy post · Blog
        </span>
        <span className="font-display text-sm md:text-base font-semibold text-foreground truncate max-w-[280px] md:max-w-[420px]">
          {post.title}
        </span>
      </div>

      <div className="relative ml-auto hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground/80 pl-3 border-l border-primary/20">
        <Copy className="h-3 w-3" />
        <span>Przytrzymaj, by skopiować</span>
      </div>
    </Link>
  );
};
