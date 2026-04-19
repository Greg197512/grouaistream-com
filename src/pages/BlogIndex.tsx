import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[] | null;
  created_at: string;
  view_count: number;
}

const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
};

const setCanonical = (href: string) => {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
};

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Blog GrouAI Stream — AI, muzyka i przyszłość streamingu";
    setMeta(
      "description",
      "Artykuły o AI w muzyce, mood detection, monetyzacji dla twórców, AI DJ i przyszłości streamingu. Czytaj blog GrouAI Stream."
    );
    setMeta("og:title", "Blog GrouAI Stream", "property");
    setMeta("og:description", "AI, muzyka i przyszłość streamingu — bądź na bieżąco.", "property");
    setMeta("og:type", "website", "property");
    setMeta("og:url", "https://grouaistream.com/blog", "property");
    setCanonical("https://grouaistream.com/blog");
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts")
        .select("id, slug, title, description, category, tags, created_at, view_count")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <MainLayout>
      <section className="px-6 py-10 max-w-5xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
            Blog GrouAI Stream
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            AI, muzyka, mood detection i monetyzacja dla niezależnych twórców. Pisane sercem, nie algorytmem (no, czasem trochę algorytmem).
          </p>
        </header>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            Pierwszy post pojawi się wkrótce.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                <Card className="h-full p-5 bg-card/40 border-border hover:border-primary/50 transition-all hover:bg-card/60">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs">{p.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("pl-PL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors leading-tight">
                    {p.title}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </MainLayout>
  );
}
