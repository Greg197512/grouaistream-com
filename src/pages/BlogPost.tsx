import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Eye, Clock } from "lucide-react";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { BlogPostActions } from "@/components/blog/BlogPostActions";
import { BlogComments } from "@/components/blog/BlogComments";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { AffiliateSidebar } from "@/components/blog/AffiliateSidebar";
import { NewsletterCapture } from "@/components/blog/NewsletterCapture";
import { headingComponents } from "@/lib/markdownHeadingId";

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
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const commentsRef = useRef<HTMLDivElement>(null);

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
    if (!post) return;
    const url = `https://grouaistream.com/blog/${post.slug}`;
    document.title = `${post.title} | GrouAI Stream`;
    setMeta("description", post.description);
    setMeta("og:title", post.title, "property");
    setMeta("og:description", post.description, "property");
    setMeta("og:type", "article", "property");
    setMeta("og:url", url, "property");
    if (post.cover_url) setMeta("og:image", post.cover_url, "property");
    setMeta("twitter:card", "summary_large_image");
    setCanonical(url);
    setJsonLd({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.created_at,
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
  }, [post]);

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
  const minutes = readingMinutes(post.content);

  return (
    <MainLayout>
      <ReadingProgress />
      <article className="px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_240px] gap-8">
          {/* TOC */}
          <TableOfContents markdown={post.content} />

          {/* MAIN */}
          <div className="min-w-0 max-w-3xl mx-auto w-full">
            <Link to="/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Wszystkie artykuły
            </Link>

            <header className="mb-6">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge className="bg-primary/15 text-primary border-primary/30">{post.category}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {minutes} min
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {post.view_count}
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-foreground leading-[1.1] tracking-tight mb-4">
                {post.title}
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{post.description}</p>
            </header>

            {post.cover_url && (
              <div className="relative mb-8 rounded-2xl overflow-hidden border border-primary/20 shadow-[0_0_60px_hsl(var(--primary)/0.15)]">
                <img src={post.cover_url} alt={post.title} className="w-full" loading="eager" />
              </div>
            )}

            <div className="mb-8">
              <BlogPostActions postId={post.id} postUrl={url} postTitle={post.title} onScrollToComments={scrollToComments} />
            </div>

            <div className="prose prose-invert max-w-none prose-lg prose-headings:text-foreground prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:scroll-mt-24 prose-h3:text-xl prose-h3:mt-8 prose-h3:scroll-mt-24 prose-p:text-foreground/85 prose-p:leading-relaxed prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-li:text-foreground/85 prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-[''] prose-code:after:content-['']">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={headingComponents}>
                {post.content}
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
              <BlogPostActions postId={post.id} postUrl={url} postTitle={post.title} onScrollToComments={scrollToComments} />
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
