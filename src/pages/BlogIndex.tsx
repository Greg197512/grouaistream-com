import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, TrendingUp, Eye, Clock, ArrowRight, Headphones, Radio } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BLOG_CATEGORIES as CATEGORIES, getCategoryLabel as catLabel } from "@/lib/blogCategories";
import { getCoverUrl } from "@/lib/blogCovers";
import { ReadingSoundtrack } from "@/components/blog/ReadingSoundtrack";
import { fetchAutoList } from "@/lib/blogAuto";

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

const BLOG_CSS = `
.blog-x{background:linear-gradient(100deg,#ff7a1a 0%,#ff2bd6 45%,#22d3ee 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.blog-rank{color:transparent;-webkit-text-stroke:1.5px hsl(var(--primary));transition:color .3s}
.group:hover .blog-rank{color:hsl(var(--primary))}
@keyframes blog-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.blog-ticker-track{animation:blog-marquee 60s linear infinite}
.blog-ticker:hover .blog-ticker-track,.blog-ticker:focus-within .blog-ticker-track{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.blog-ticker-track{animation:none}}
html[data-lowpower="on"] .blog-ticker-track{animation:none}
`;

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
      // (Stary hub bmwtyd nie istnieje — tylko wpisy z głównej bazy.)
      const [{ data }, auto] = await Promise.all([
        supabase
          .from("seo_blog_posts")
          .select("id, slug, title, description, category, tags, cover_url, created_at, view_count, title_en, title_nl, title_ua, description_en, description_nl, description_ua")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(240),
        fetchAutoList(60), // automatyczna redakcja (api/blog-auto): wiadomości + nauka i książki
      ]);
      const seen = new Set(((data as BlogPost[]) || []).map((p) => p.slug));
      setPosts([...((data as BlogPost[]) || []), ...(auto as unknown as BlogPost[]).filter((p) => !seen.has(p.slug))]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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

  const topRead = useMemo(() => [...posts].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5), [posts]);
  const ticker = posts.slice(0, 10);
  const L = (pl: string, en: string, nl: string, ua: string) => (language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl);
  const featured = filtered[0];
  const secondary = filtered.slice(1, 3);
  const rest = filtered.slice(3);

  return (
    <MainLayout>
      <section className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">

        <style>{BLOG_CSS}</style>
        {/* HERO — „Dźwięk × Technologia”: grafika z Canvy, typografia jak okładka magazynu */}
        <header className="relative mb-6 overflow-hidden rounded-[2rem] border border-border/50 bg-black">
          <img src="/blog/hero-sound-tech.jpg" srcSet="/blog/hero-sound-tech-800.jpg 800w, /blog/hero-sound-tech.jpg 1600w" sizes="(max-width: 768px) 100vw, 1280px"
            alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-right opacity-90" fetchPriority="high" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/10" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:p-14">
            <div>
              <div className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
                <span className="h-px w-8 bg-primary/60" /><Sparkles className="h-3.5 w-3.5" />
                <span>{L("Muzyka · AI · Technologia", "Music · AI · Technology", "Muziek · AI · Technologie", "Музика · AI · Технології")}</span>
              </div>
              <h1 className="font-black leading-[0.86] tracking-[-0.04em] text-white [text-wrap:balance]">
                <span className="block text-[clamp(2.9rem,6.4vw,6rem)]">{L("Dźwięk", "Sound", "Geluid", "Звук")}</span>
                <span className="blog-x block whitespace-nowrap pb-[0.08em] text-[clamp(2.9rem,6.4vw,6rem)]">× {L("Technologia", "Technology", "Technologie", "Технології")}</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                {L("Blog GrouAI Stream: jak AI zmienia muzykę, studio, streaming i to, czego słuchasz. Każdy artykuł możesz też posłuchać.",
                   "The GrouAI Stream blog: how AI is changing music, the studio, streaming and what you hear. Every article can be listened to.",
                   "De GrouAI Stream-blog: hoe AI muziek, de studio, streaming en wat je hoort verandert. Elk artikel kun je ook beluisteren.",
                   "Блог GrouAI Stream: як AI змінює музику, студію, стрімінг і те, що ти слухаєш. Кожну статтю можна прослухати.")}
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-white/85">
                {posts.length > 0 && <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 tabular-nums">{posts.length} {L("artykułów", "articles", "artikelen", "статей")}</span>}
                <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5"><Headphones className="h-3.5 w-3.5 text-primary" />{L("AI czyta na głos", "AI reads aloud", "AI leest voor", "AI читає вголос")}</span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5"><Radio className="h-3.5 w-3.5 text-accent" />{L("Soundtrack do czytania", "Reading soundtrack", "Leessoundtrack", "Саундтрек для читання")}</span>
              </div>
            </div>
            <div className="lg:pb-1"><ReadingSoundtrack lang={language} compact /></div>
          </div>
        </header>

        {/* NA ANTENIE — najnowsze tytuły przewijają się jak pasek radia (stoi przy „ogranicz ruch”) */}
        {ticker.length > 0 && (
          <div className="blog-ticker mb-10 flex items-center overflow-hidden rounded-full border border-border/50 bg-card/50">
            <span className="z-10 flex shrink-0 items-center gap-2 bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-foreground motion-reduce:animate-none" />{L("Na antenie", "On air", "On air", "В ефірі")}
            </span>
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <div className="blog-ticker-track flex w-max gap-8 py-2 pl-6">
                {[...ticker, ...ticker].map((p, k) => (
                  <Link key={`${p.id}-${k}`} to={`/blog/${p.slug}`} tabIndex={k >= ticker.length ? -1 : 0} aria-hidden={k >= ticker.length || undefined}
                    className="whitespace-nowrap text-sm text-muted-foreground transition hover:text-foreground">
                    <span className="mr-2 text-primary">◆</span>{localizedField(p, "title", language)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NAJCZĘŚCIEJ CZYTANE — numer = miejsce w rankingu wyświetleń */}
        {!loading && topRead.length >= 3 && !search && activeCat === "all" && (
          <section className="mb-12" aria-label={L("Najczęściej czytane", "Most read", "Meest gelezen", "Найпопулярніше")}>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-muted-foreground"><TrendingUp className="h-4 w-4 text-primary" />{L("Najczęściej czytane", "Most read", "Meest gelezen", "Найпопулярніше")}</h2>
            <ol className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
              {topRead.map((p, k) => (
                <li key={p.id}>
                  <Link to={`/blog/${p.slug}`} className="group flex gap-3">
                    <span aria-hidden className="blog-rank text-5xl font-black leading-none tabular-nums">{k + 1}</span>
                    <span className="min-w-0">
                      <span className="line-clamp-3 text-sm font-semibold leading-snug text-foreground transition group-hover:text-primary">{localizedField(p, "title", language)}</span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Eye className="h-3 w-3" />{p.view_count}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

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
