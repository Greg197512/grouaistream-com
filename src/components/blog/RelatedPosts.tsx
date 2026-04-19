import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Post {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  cover_url: string | null;
  created_at: string;
  title_en?: string | null;
  title_nl?: string | null;
  title_ua?: string | null;
  description_en?: string | null;
  description_nl?: string | null;
  description_ua?: string | null;
}

interface Props {
  currentPostId: string;
  category: string;
  tags: string[] | null;
}

const pick = (post: Post, field: "title" | "description", lang: string): string => {
  if (lang === "pl") return post[field];
  const v = (post as any)[`${field}_${lang}`] as string | null | undefined;
  return v || post[field];
};

export const RelatedPosts = ({ currentPostId, category, tags }: Props) => {
  const { language } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    (async () => {
      const cols = "id, slug, title, description, category, cover_url, created_at, title_en, title_nl, title_ua, description_en, description_nl, description_ua";
      const { data: sameCat } = await supabase
        .from("seo_blog_posts")
        .select(cols)
        .eq("is_published", true)
        .eq("category", category)
        .neq("id", currentPostId)
        .order("created_at", { ascending: false })
        .limit(3);

      let result = (sameCat as Post[]) || [];
      if (result.length < 3) {
        const have = new Set(result.map((p) => p.id).concat(currentPostId));
        const { data: recent } = await supabase
          .from("seo_blog_posts")
          .select(cols)
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(8);
        for (const p of (recent as Post[]) || []) {
          if (have.has(p.id)) continue;
          result.push(p);
          if (result.length >= 3) break;
        }
      }
      setPosts(result.slice(0, 3));
    })();
  }, [currentPostId, category, tags]);

  if (posts.length === 0) return null;

  const heading = language === "en" ? "Read more" : language === "nl" ? "Lees verder" : language === "ua" ? "Читайте далі" : "Czytaj dalej";

  return (
    <section className="mt-16 pt-10 border-t border-border/60">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">{heading}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.id} to={`/blog/${p.slug}`} className="group">
            <Card className="h-full overflow-hidden bg-card/40 border-border hover:border-primary/50 transition-all hover:shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
              {p.cover_url && (
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={p.cover_url}
                    alt={pick(p, "title", language)}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-4">
                <Badge variant="secondary" className="text-[10px] mb-2">{p.category}</Badge>
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                  {pick(p, "title", language)}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{pick(p, "description", language)}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
