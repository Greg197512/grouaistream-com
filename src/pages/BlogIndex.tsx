import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, TrendingUp, Eye } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BLOG_CATEGORIES as CATEGORIES, getCategoryLabel as catLabel } from "@/lib/blogCategories";

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
  title_en?: string | null;
  title_nl?: string | null;
  title_ua?: string | null;
  description_en?: string | null;
  description_nl?: string | null;
  description_ua?: string | null;
}

const localizedField = (post: BlogPost, field: "title" | "description", lang: string): string => {
  if (lang === "pl") return post[field];
  const v = (post as any)[`${field}_${lang}`] as string | null | undefined;
  return v || post[field];
};

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
  const { language } = useLanguage();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");

  useEffect(() => {
    const titles: Record<string, string> = {
      pl: "Blog GrouAI Stream — AI, muzyka i przyszłość streamingu",
      en: "GrouAI Stream Blog — AI, music & the future of streaming",
      nl: "GrouAI Stream Blog — AI, muziek en de toekomst van streaming",
      ua: "Блог GrouAI Stream — AI, музика та майбутнє стрімінгу",
    };
    const descs: Record<string, string> = {
      pl: "Artykuły o AI w muzyce, mood detection, monetyzacji dla twórców, AI DJ i przyszłości streamingu.",
      en: "Articles about AI in music, mood detection, creator monetization, AI DJ and the future of streaming.",
      nl: "Artikelen over AI in muziek, mood detection, monetisatie voor creators, AI DJ en streaming.",
      ua: "Статті про AI у музиці, виявлення настрою, монетизацію для авторів, AI DJ та майбутнє стрімінгу.",
    };
    document.title = titles[language] || titles.pl;
    setMeta("description", descs[language] || descs.pl);
    setMeta("og:title", titles[language] || titles.pl, "property");
    setMeta("og:description", descs[language] || descs.pl, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:url", "https://grouaistream.com/blog", "property");
    setCanonical("https://grouaistream.com/blog");
  }, [language]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts")
        .select("id, slug, title, description, category, tags, cover_url, created_at, view_count, title_en, title_nl, title_ua, description_en, description_nl, description_ua")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(60);
      setPosts((data as BlogPost[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (activeCat !== "all" && p.category !== activeCat) return false;
      if (!q) return true;
      const title = localizedField(p, "title", language).toLowerCase();
      const desc = localizedField(p, "description", language).toLowerCase();
      return (
        title.includes(q) ||
        desc.includes(q) ||
        (p.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [posts, search, activeCat, language]);

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

        {/* SEARCH */}
        <div className="mb-5 relative max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj artykułów…"
            className="pl-10 bg-card/40 border-border focus-visible:border-primary/50 focus-visible:ring-primary/20"
          />
        </div>

        {/* TABS — sticky technical category navigation */}
        <div className="sticky top-2 z-20 mb-8 -mx-2 px-2">
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-background/85 backdrop-blur-xl shadow-[0_4px_30px_hsl(var(--primary)/0.08)]">
            <div className="flex items-stretch gap-1 p-1.5 min-w-max">
              {CATEGORIES.map((c) => {
                const count = c.id === "all"
                  ? posts.length
                  : posts.filter((p) => p.category === c.id).length;
                const active = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    disabled={count === 0 && c.id !== "all"}
                    className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      active
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                        : count === 0
                        ? "bg-transparent text-muted-foreground/40 border-transparent cursor-not-allowed"
                        : "bg-card/40 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground hover:bg-card/70"
                    }`}
                  >
                    <span>{catLabel(c.id, language)}</span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            {search
              ? language === "en" ? `No results for "${search}"` :
                language === "nl" ? `Geen resultaten voor "${search}"` :
                language === "ua" ? `Немає результатів для "${search}"` :
                `Brak wyników dla „${search}"`
              : language === "en" ? "First post coming soon." :
                language === "nl" ? "Eerste post komt binnenkort." :
                language === "ua" ? "Перший пост скоро з'явиться." :
                "Pierwszy post pojawi się wkrótce."}
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
                        <img src={featured.cover_url} alt={localizedField(featured, "title", language)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
                          <Sparkles className="w-16 h-16 text-primary/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-6 sm:p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
                          <TrendingUp className="w-3 h-3 mr-1" /> {language === "en" ? "Latest" : language === "nl" ? "Nieuwste" : language === "ua" ? "Найновіше" : "Najnowszy"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{catLabel(featured.category, language)}</Badge>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3 leading-tight group-hover:text-primary transition-colors">
                        {localizedField(featured, "title", language)}
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{localizedField(featured, "description", language)}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(featured.created_at).toLocaleDateString(language === "ua" ? "uk-UA" : language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "pl-PL", { day: "numeric", month: "long", year: "numeric" })}</span>
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
                        <img src={p.cover_url} alt={localizedField(p, "title", language)} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/15 flex items-center justify-center">
                          <Sparkles className="w-10 h-10 text-primary/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-[10px]">{catLabel(p.category, language)}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString(language === "ua" ? "uk-UA" : language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "pl-PL", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-2">
                        {localizedField(p, "title", language)}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{localizedField(p, "description", language)}</p>
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
