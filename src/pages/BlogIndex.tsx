import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, TrendingUp, Eye, Clock, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BLOG_CATEGORIES as CATEGORIES, getCategoryLabel as catLabel } from "@/lib/blogCategories";
import { getCoverUrl } from "@/lib/blogCovers";
import { fetchHubBlogList } from "@/lib/hubBlog";

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

const readMins = (desc: string) => Math.max(1, Math.round(desc.split(/\s+/).length / 4));

const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.content = content;
};
const setCanonical = (href: string) => {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) { el = document.createElement("link"); el.rel = "canonical"; document.head.appendChild(el); }
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
      const [{ data }, hub] = await Promise.all([
        supabase
          .from("seo_blog_posts")
          .select("id, slug, title, description, category, tags, cover_url, created_at, view_count, title_en, title_nl, title_ua, description_en, description_nl, description_ua")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(60),
        fetchHubBlogList(30),
      ]);
      // Świeże wpisy huba dokładamy do listy z bvstv i sortujemy po dacie (najnowsze u góry).
      const bvstv = (data as BlogPost[]) || [];
      const seen = new Set(bvstv.map((p) => p.slug));
      const merged = [...bvstv, ...hub.filter((h) => !seen.has(h.slug)) as unknown as BlogPost[]]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPosts(merged);
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
      return title.includes(q) || desc.includes(q) || (p.tags || []).some((tag) => tag.toLowerCase().includes(q));
    });
  }, [posts, search, activeCat, language]);

  const featured = filtered[0];
  const secondary = filtered.slice(1, 3);
  const rest = filtered.slice(3);

  return (
    <MainLayout>
      <section className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">

        {/* HERO — editorial masthead */}
        <header className="mb-12 sm:mb-16 pt-4">
          <div className="flex items-center gap-3 mb-5 text-[11px] uppercase tracking-[0.3em] text-primary font-semibold">
            <span className="h-px w-8 bg-primary/50" />
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {language === "en" ? "New articles daily" : language === "nl" ? "Dagelijks nieuwe artikelen" : language === "ua" ? "Нові статті щодня" : "Codziennie nowe artykuły"}
            </span>
          </div>
          <h1 className="text-5xl sm:text-7xl lg:text-[5.5rem] font-black text-foreground tracking-[-0.03em] leading-[0.92]">
            Blog{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">GrouAI</span>{" "}
            Stream
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            {language === "en"
              ? "AI, music, sound and the future of streaming — deep dives for people who care how it actually works."
              : language === "nl"
              ? "AI, muziek, geluid en de toekomst van streaming — verdiepende artikelen voor wie wil weten hoe het echt werkt."
              : language === "ua"
              ? "AI, музика, звук і майбутнє стрімінгу — глибокі матеріали для тих, кому цікаво, як це справді працює."
              : "AI, muzyka, dźwięk i przyszłość streamingu — pogłębione teksty dla tych, których interesuje, jak to naprawdę działa."}
          </p>
          <div className="mt-8 h-px w-full bg-gradient-to-r from-border via-border/50 to-transparent" />
        </header>

        {/* SEARCH */}
        <div className="mb-6 relative max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "en" ? "Search articles…" : language === "nl" ? "Artikelen zoeken…" : language === "ua" ? "Пошук статей…" : "Szukaj artykułów…"}
            className="pl-10 bg-card/40 border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/20 h-11"
          />
        </div>

        {/* CATEGORY TABS */}
        <div className="sticky top-2 z-20 mb-10 -mx-2 px-2">
          <div className="overflow-x-auto rounded-2xl border border-border/50 bg-background/90 backdrop-blur-xl shadow-lg">
            <div className="flex items-stretch gap-1 p-1.5 min-w-max">
              {CATEGORIES.map((c) => {
                const count = c.id === "all" ? posts.length : posts.filter((p) => p.category === c.id).length;
                const active = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    disabled={count === 0 && c.id !== "all"}
                    className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : count === 0
                        ? "bg-transparent text-muted-foreground/30 border-transparent cursor-not-allowed"
                        : "bg-card/40 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground hover:bg-card/70"
                    }`}
                  >
                    <span>{catLabel(c.id, language)}</span>
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted/60 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                    }`}>
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
          <div className="space-y-6">
            <Skeleton className="h-80 rounded-3xl" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground text-lg">
              {search
                ? `${language === "en" ? "No results for" : "Brak wyników dla"} „${search}"`
                : language === "en" ? "First article coming soon." : "Pierwszy artykuł pojawi się wkrótce."}
            </p>
          </div>
        ) : (
          <>
            {/* FEATURED — hero card with full-bleed image */}
            {featured && (
              <Link to={`/blog/${featured.slug}`} className="group block mb-8">
                <article className="relative overflow-hidden rounded-3xl border border-border/50 bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-black/40">
                  <div className="aspect-[21/9] sm:aspect-[3/1] overflow-hidden">
                    <img
                      src={getCoverUrl(featured.cover_url, featured.category, featured.slug)}
                      alt={localizedField(featured, "title", language)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge className="bg-primary text-primary-foreground border-0 text-[10px] uppercase tracking-wider font-bold">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {language === "en" ? "Latest" : language === "nl" ? "Nieuwste" : language === "ua" ? "Найновіше" : "Najnowszy"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-background/60 backdrop-blur border-border/40">
                        {catLabel(featured.category, language)}
                      </Badge>
                    </div>
                    <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white mb-3 leading-[1.1] group-hover:text-primary transition-colors max-w-3xl drop-shadow-lg">
                      {localizedField(featured, "title", language)}
                    </h2>
                    <p className="text-sm sm:text-base text-white/70 line-clamp-2 mb-4 max-w-2xl drop-shadow">
                      {localizedField(featured, "description", language)}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-white/60">
                      <span>
                        {new Date(featured.created_at).toLocaleDateString(
                          language === "ua" ? "uk-UA" : language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "pl-PL",
                          { day: "numeric", month: "long", year: "numeric" }
                        )}
                      </span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {featured.view_count}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {readMins(localizedField(featured, "description", language))} min</span>
                      <span className="hidden sm:flex items-center gap-1 text-primary font-semibold">
                        {language === "en" ? "Read article" : "Czytaj artykuł"} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            )}

            {/* SECONDARY ROW — 2 large cards */}
            {secondary.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 mb-8">
                {secondary.map((p) => (
                  <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                    <article className="relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-xl hover:shadow-black/30 h-full">
                      <div className="aspect-[16/9] overflow-hidden">
                        <img
                          src={getCoverUrl(p.cover_url, p.category, p.slug)}
                          alt={localizedField(p, "title", language)}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-[10px] bg-background/60 backdrop-blur border-border/40">
                            {catLabel(p.category, language)}
                          </Badge>
                          <span className="text-[10px] text-white/50">
                            {new Date(p.created_at).toLocaleDateString(language === "en" ? "en-US" : "pl-PL", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors drop-shadow">
                          {localizedField(p, "title", language)}
                        </h3>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}

            {/* GRID — editorial, image-first cards */}
            {rest.length > 0 && (
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => {
                  const coverSrc = getCoverUrl(p.cover_url, p.category, p.slug);
                  return (
                    <Link key={p.id} to={`/blog/${p.slug}`} className="group block">
                      <article className="h-full flex flex-col">
                        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted/30 mb-4 ring-1 ring-border/40 group-hover:ring-primary/40 transition-[box-shadow,transform] duration-300">
                          <img
                            src={coverSrc}
                            alt={localizedField(p, "title", language)}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
                          <span className="text-primary font-semibold">{catLabel(p.category, language)}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>
                            {new Date(p.created_at).toLocaleDateString(
                              language === "ua" ? "uk-UA" : language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "pl-PL",
                              { day: "numeric", month: "short" }
                            )}
                          </span>
                          <span className="ml-auto flex items-center gap-1 normal-case tracking-normal"><Eye className="w-3 h-3" /> {p.view_count}</span>
                        </div>
                        <h3 className="font-bold text-lg leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {localizedField(p, "title", language)}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {localizedField(p, "description", language)}
                        </p>
                      </article>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </MainLayout>
  );
}
