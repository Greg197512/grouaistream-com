import { useEffect, useRef, useState } from "react";
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

const EXTERNAL_BLOG_URL = "https://lovable.dev/projects/462bddcb-d545-4f42-bc51-5f437cb12bbe";

export const BlogPromoButton = () => {
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
    longPressFired.current = false;
    setProgress(0);

    const start = Date.now();
    progressTimer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / LONG_PRESS_MS) * 100);
      setProgress(pct);
    }, 16);

    pressTimer.current = window.setTimeout(async () => {
      longPressFired.current = true;
      const url = EXTERNAL_BLOG_URL;
      const title = post?.title ?? "GrouAI Stream Blog";
      const description = post?.description ?? "";
      const richMarkdown = `🔥 [${title}](${url})${description ? `\n\n${description}` : ""}`;

      try {
        if (navigator.clipboard && (window as any).ClipboardItem) {
          const html = `<a href="${url}" style="font-weight:600;color:#ff6b1a;text-decoration:none">🔥 ${title}</a>${description ? `<br/><span style="color:#666">${description}</span>` : ""}`;
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
    window.open(EXTERNAL_BLOG_URL, "_blank", "noopener,noreferrer");
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
        className="relative overflow-hidden groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2 rounded-full px-6 h-14 font-semibold text-base shadow-[0_0_30px_hsl(var(--primary)/0.3)] select-none"
      >
        <span
          className="absolute inset-0 bg-primary-foreground/20 origin-left pointer-events-none"
          style={{ transform: `scaleX(${progress / 100})`, transition: "transform 0.04s linear" }}
          aria-hidden
        />
        <Newspaper className="h-5 w-5 relative z-10" />
        <span className="relative z-10">{t("hero.blog")}</span>
      </Button>
    </motion.div>
  );
};
