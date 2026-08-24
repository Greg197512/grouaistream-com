import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Newspaper, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface LatestPost {
  slug: string;
  title: string;
  description: string;
}

const LONG_PRESS_MS = 600;

export const BlogPromoButton = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [post, setPost] = useState<LatestPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const pressTimer = useRef<number | null>(null);
  const progressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts")
        .select("slug, title, description")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPost(data as LatestPost);
      setLoading(false);
    })();
  }, []);

  const cleanup = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    pressTimer.current = null;
    progressTimer.current = null;
    setProgress(0);
  };

  const startPress = () => {
    if (!post) return;
    longPressFired.current = false;
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
        toast.success(t("hero.blogCopied"), {
          description: t("hero.blogCopiedDesc"),
        });
      } catch {
        toast.error(t("hero.blogCopyError"));
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

  const handleClick = (e: React.MouseEvent) => {
    if (longPressFired.current) {
      e.preventDefault();
      longPressFired.current = false;
      return;
    }
    navigate("/blog");
  };

  if (loading) return null;

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Button
        size="lg"
        onClick={handleClick}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={() => cleanup()}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onContextMenu={(e) => e.preventDefault()}
        title={t("hero.blogTooltip")}
        className="group relative overflow-hidden rounded-full px-7 h-14 gap-2 font-semibold text-base text-white border border-white/25 bg-white/[0.07] backdrop-blur-xl hover:bg-white/[0.13] hover:border-white/45 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_10px_30px_-12px_rgba(0,0,0,0.7)] select-none"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.22), transparent 42%)" }} />
        <span
          className="absolute inset-0 bg-white/25 origin-left pointer-events-none"
          style={{ transform: `scaleX(${progress / 100})`, transition: "transform 0.04s linear" }}
          aria-hidden
        />
        <span className="relative z-10 inline-flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          {t("hero.blog")}
        </span>
      </Button>
    </motion.div>
  );
};
