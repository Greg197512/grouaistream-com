import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";

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

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

      // Increment view count (fire & forget)
      supabase
        .from("seo_blog_posts")
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq("id", data.id)
        .then(() => {});
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
    });
  }, [post]);

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
          <p className="text-muted-foreground mb-6">
            Ten artykuł mógł zostać usunięty lub adres jest nieprawidłowy.
          </p>
          <Link to="/blog">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do bloga
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <article className="px-6 py-10 max-w-3xl mx-auto">
        <Link to="/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Wszystkie artykuły
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary">{post.category}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(post.created_at).toLocaleDateString("pl-PL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">{post.description}</p>
        </header>

        {post.cover_url && (
          <img
            src={post.cover_url}
            alt={post.title}
            className="w-full rounded-xl mb-8 border border-border"
            loading="lazy"
          />
        )}

        <div className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary prose-li:text-muted-foreground prose-code:text-foreground prose-code:bg-muted/50 prose-code:px-1 prose-code:rounded">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-border">
            {post.tags.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 p-6 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground mb-2">
            Wypróbuj GrouAI Stream za darmo
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI DJ, mood detection, voice control, monetyzacja 65% dla twórców.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Link to="/auth">
              <Button>Załóż konto</Button>
            </Link>
            <Link to="/earn">
              <Button variant="outline">Zarabiaj z nami</Button>
            </Link>
          </div>
        </div>
      </article>
    </MainLayout>
  );
}
