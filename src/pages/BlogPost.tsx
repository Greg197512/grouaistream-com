import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Eye, BookOpen } from "lucide-react";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { BlogPostActions } from "@/components/blog/BlogPostActions";
import { BlogComments } from "@/components/blog/BlogComments";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { AffiliateSidebar } from "@/components/blog/AffiliateSidebar";
import { NewsletterCapture } from "@/components/blog/NewsletterCapture";
import { headingComponents } from "@/lib/markdownHeadingId";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryLabel } from "@/lib/blogCategories";
import { getCoverUrl } from "@/lib/blogCovers";
import { fetchHubBlogPost } from "@/lib/hubBlog";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[] | null;
  created_at: string;
  cover_url: string | null;
  view_count: number;
  title_en?: string | null;
  title_nl?: string | null;
  title_ua?: string | null;
  description_en?: string | null;
  description_nl?: string | null;
  description_ua?: string | null;
  content_en?: string | null;
  content_nl?: string | null;
  content_ua?: string | null;
  translation_status?: string | null;
}

const pickLocalized = (post: BlogPost, lang: string) => {
  if (lang === "pl") return { title: post.title, description: post.description, content: post.content };
  const t = (post as any)[`title_${lang}`] as string | null | undefined;
  const d = (post as any)[`description_${lang}`] as string | null | undefined;
  const c = (post as any)[`content_${lang}`] as string | null | undefined;
  return {
    title: t || post.title,
    description: d || post.description,
    content: c || post.content,
  };
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

const setJsonLd = (data: object) => {
  let el = document.getElementById("blog-jsonld") as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = "blog-jsonld";
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
};

const readingMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 200));

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const commentsRef = useRef<HTMLDivElement>(null);
  const localized = post ? pickLocalized(post, language) : null;

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("seo_blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error || !data) {
        // Fallback: świeże wpisy generowane na hubie (bvstv nie ma już generatora).
        const hubPost = await fetchHubBlogPost(slug);
        if (hubPost) {
          setPost(hubPost as unknown as BlogPost);
          setLoading(false);
          return;
        }
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPost(data as BlogPost);
      setLoading(false);

      // Safe view increment via RPC
      supabase.rpc("increment_blog_view", { _post_id: data.id }).then(() => {});
    })();
  }, [slug]);

  useEffect(() => {
    if (!post || !localized) return;
    const url = `https://grouaistream.com/blog/${post.slug}`;
    document.title = `${localized.title} | GrouAI Stream`;
    setMeta("description", localized.description);
    setMeta("og:title", localized.title, "property");
    setMeta("og:description", localized.description, "property");
    setMeta("og:type", "article", "property");
    setMeta("og:url", url, "property");
    if (post.cover_url) setMeta("og:image", post.cover_url, "property");
    setMeta("twitter:card", "summary_large_image");
    setCanonical(url);
    setJsonLd({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: localized.title,
      description: localized.description,
      datePublished: post.created_at,
      inLanguage: language === "ua" ? "uk" : language,
      author: { "@type": "Organization", name: "GrouAI Stream" },
      publisher: {
        "@type": "Organization",
        name: "GrouAI Stream",
        logo: { "@type": "ImageObject", url: "https://grouaistream.com/icon-512.png" },
      },
      mainEntityOfPage: url,
      ...(post.cover_url ? { image: post.cover_url } : {}),
      keywords: (post.tags || []).join(", "),
    });
  }, [post, language, localized]);

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="px-6 py-10 max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (notFound || !post) {
    return (
      <MainLayout>
        <div className="px-6 py-20 max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-foreground mb-3">Post nie znaleziony</h1>
          <p className="text-muted-foreground mb-6">Ten artykuł mógł zostać usunięty lub adres jest nieprawidłowy.</p>
          <Link to="/blog">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do bloga
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const url = `https://grouaistream.com/blog/${post.slug}`;
  const displayContent = localized?.content || post.content;
  const displayTitle = localized?.title || post.title;
  const displayDescription = localized?.description || post.description;
  const minutes = readingMinutes(displayContent);
  const dateLocale = language === "ua" ? "uk-UA" : language === "nl" ? "nl-NL" : language === "en" ? "en-US" : "pl-PL";
  const backLabel = language === "en" ? "All articles" : language === "nl" ? "Alle artikelen" : language === "ua" ? "Усі статті" : "Wszystkie artykuły";

  return (
    <MainLayout>
      <ReadingProgress />
      <article className="px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_240px] gap-8">
          {/* TOC */}
          <TableOfContents markdown={displayContent} />

          {/* MAIN */}
          <div className="min-w-0 max-w-3xl mx-auto w-full">
            <Link to="/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}
            </Link>

            <header className="mb-6">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge className="bg-primary/15 text-primary border-primary/30">{getCategoryLabel(post.category, language)}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {post.view_count} {language === "en" ? "views" : "wyświetleń"}
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-foreground leading-[1.1] tracking-tight mb-4">
                {displayTitle}
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed font-light">{displayDescription}</p>
            </header>

            {/* Hero image — always shown (real or curated Unsplash fallback) */}
            <div className="relative mb-8 rounded-2xl overflow-hidden border border-border/40 shadow-[0_8px_60px_hsl(var(--primary)/0.12)]">
              <div className="aspect-[16/7] overflow-hidden">
                <img
                  src={getCoverUrl(post.cover_url, post.category, post.slug)}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>
            </div>

            {/* Author row */}
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border/40">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">GrouAI Redakcja</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
                  {" · "}
                  <BookOpen className="w-3 h-3 inline mr-0.5" />
                  {minutes} min czytania
                </p>
              </div>
            </div>

            <div className="mb-8">
              <BlogPostActions postId={post.id} postUrl={url} postTitle={displayTitle} onScrollToComments={scrollToComments} />
            </div>

            <div className="prose prose-invert max-w-none prose-lg prose-headings:text-foreground prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:scroll-mt-24 prose-h3:text-xl prose-h3:mt-8 prose-h3:scroll-mt-24 prose-p:text-foreground/85 prose-p:leading-relaxed prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-li:text-foreground/85 prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-[''] prose-code:after:content-['']">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={headingComponents}>
                {displayContent}
              </ReactMarkdown>
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-border">
                {post.tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-8">
              <BlogPostActions postId={post.id} postUrl={url} postTitle={displayTitle} onScrollToComments={scrollToComments} />
            </div>

            {/* Newsletter Capture */}
            <NewsletterCapture variant="card" source={`blog_post:${post.slug}`} />

            {/* Pro/Ultimate CTA */}
            <div className="mt-8 p-6 sm:p-10 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card/30 to-accent/15 text-center shadow-[0_0_60px_hsl(var(--primary)/0.25)] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.3),transparent_70%)] pointer-events-none" />
              <div className="relative">
                <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
                <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-2">Wypróbuj GrouAI Stream Pro</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-lg mx-auto">
                  AI DJ, mood detection, voice control, generowanie muzyki w 30s, 65% dla twórców. <strong className="text-foreground">7-dniowy trial bez karty.</strong>
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Link to="/auth"><Button size="lg" className="shadow-[0_0_30px_hsl(var(--primary)/0.5)]">Załóż darmowe konto</Button></Link>
                  <Link to="/settings"><Button size="lg" variant="outline">Zobacz plany Pro / Ultimate</Button></Link>
                </div>
                <p className="text-[10px] text-muted-foreground mt-4 uppercase tracking-widest">
                  Trial • Anuluj w 1 click • Zero zobowiązań
                </p>
              </div>
            </div>

            <RelatedPosts currentPostId={post.id} category={post.category} tags={post.tags} />

            <div ref={commentsRef}>
              <BlogComments postId={post.id} />
            </div>
          </div>

          {/* SIDEBAR */}
          <AffiliateSidebar category={post.category} />
        </div>
      </article>
    </MainLayout>
  );
}
