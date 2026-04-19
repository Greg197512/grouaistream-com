import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, TrendingUp, Eye } from "lucide-react";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[] | null;
  cover_url: string | null;
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

const CATEGORIES = [
  { id: "all", label: "Wszystkie" },
  { id: "trends", label: "Trendy" },
  { id: "feature", label: "Funkcje" },
  { id: "monetization", label: "Zarobki" },
  { id: "tutorial", label: "Tutoriale" },
  { id: "psychology", label: "Psychologia" },
  { id: "tools", label: "Narzędzia" },
  { id: "industry", label: "Branża" },
];

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");

  useEffect(() => {
    document.title = "Blog GrouAI Stream — AI, muzyka i przyszłość streamingu";
    setMeta("description", "Artykuły o AI w muzyce, mood detection, monetyzacji dla twórców, AI DJ i przyszłości streamingu. Codziennie nowe inspiracje.");
    setMeta("og:title", "Blog GrouAI Stream", "property");
    setMeta("og:description", "AI, muzyka i przyszłość streamingu — codziennie nowe artykuły.", "property");
    setMeta("og:type", "website", "property");
    setMeta("og:url", "https://grouaistream.com/blog", "property");
    setCanonical("https://grouaistream.com/blog");
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts")
        .select("id, slug, title, description, category, tags, cover_url, created_at, view_count")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(60);
      setPosts(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (activeCat !== "all" && p.category !== activeCat) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [posts, search, activeCat]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <MainLayout>
      <section className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
        {/* HERO */}
        <header className="relative mb-12 text-center overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10 px-6 py-14 sm:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.25),transparent_60%),radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.2),transparent_55%)] pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-[11px] uppercase tracking-[0.2em] text-primary font-bold mb-5">
              <Sparkles className="w-3 h-3" /> Codziennie nowe artykuły AI
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-foreground mb-4 tracking-tight">
              Blog <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">GrouAI</span> Stream
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AI, muzyka, mood detection i monetyzacja dla niezależnych twórców.
              <br className="hidden sm:block" />
              Pisane sercem — czasem trochę algorytmem.
            </p>
          </div>
        </header>

        {/* SEARCH + CATEGORIES */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj artykułów…"
              className="pl-10 bg-card/40 border-border focus-visible:border-primary/50 focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  activeCat === c.id
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                    : "bg-card/30 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            {search ? `Brak wyników dla „${search}"` : "Pierwszy post pojawi się wkrótce."}
          </p>
        ) : (
          <>
            {/* FEATURED */}
            {featured && (
              <Link to={`/blog/${featured.slug}`} className="group block mb-8">
                <Card className="overflow-hidden bg-card/40 border-border hover:border-primary/60 transition-all hover:shadow-[0_0_50px_hsl(var(--primary)/0.25)]">
                  <div className="grid md:grid-cols-2 gap-0">
                    <div className="aspect-[16/10] md:aspect-auto overflow-hidden bg-muted">
                      {featured.cover_url ? (
                        <img src={featured.cover_url} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
                          <Sparkles className="w-16 h-16 text-primary/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-6 sm:p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
                          <TrendingUp className="w-3 h-3 mr-1" /> Najnowszy
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{featured.category}</Badge>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3 leading-tight group-hover:text-primary transition-colors">
                        {featured.title}
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{featured.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(featured.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {featured.view_count}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            )}

            {/* GRID */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                  <Card className="h-full overflow-hidden bg-card/40 border-border hover:border-primary/50 transition-all hover:shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      {p.cover_url ? (
                        <img src={p.cover_url} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/15 flex items-center justify-center">
                          <Sparkles className="w-10 h-10 text-primary/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-2">
                        {p.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                      {p.tags && p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {p.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </MainLayout>
  );
}
