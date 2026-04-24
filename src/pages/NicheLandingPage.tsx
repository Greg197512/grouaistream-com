import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";

interface LandingPage {
  slug: string;
  niche: string;
  title: string;
  meta_description: string | null;
  hero_headline: string;
  hero_subheadline: string | null;
  sections: any[];
  cta_text: string;
  cta_url: string;
  sponsor_name: string | null;
  sponsor_url: string | null;
  sponsor_active: boolean;
}

export default function NicheLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("aurora_landing_pages" as any)
        .select("*")
        .eq("slug", slug)
        .eq("status", "live")
        .maybeSingle();
      setPage(data as any);
      // bump views (best-effort)
      if (data) {
        await supabase.rpc("increment" as any, { table_name: "aurora_landing_pages", row_id: (data as any).id, column_name: "views_count" }).catch(() => {});
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl font-bold mb-2">Strony nie znaleziono</h1>
        <p className="text-muted-foreground mb-6">Aurora jeszcze nie napisała tej historii.</p>
        <Button asChild><Link to="/">Wróć na stronę główną</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{page.title}</title>
        {page.meta_description && <meta name="description" content={page.meta_description} />}
        <link rel="canonical" href={`https://grouaistream.com/n/${page.slug}`} />
        <meta property="og:title" content={page.title} />
        {page.meta_description && <meta property="og:description" content={page.meta_description} />}
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative max-w-5xl mx-auto px-4 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-xs text-primary mb-6">
            <Sparkles className="h-3 w-3" /> {page.niche}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
            {page.hero_headline}
          </h1>
          {page.hero_subheadline && (
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {page.hero_subheadline}
            </p>
          )}
          <Button size="lg" asChild className="text-base h-12 px-8">
            <Link to={page.cta_url || "/"}>{page.cta_text || "Posłuchaj teraz"}</Link>
          </Button>
        </div>
      </section>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-16">
        {(page.sections || []).map((s: any, i: number) => (
          <section key={i}>
            {s.heading && <h2 className="text-2xl md:text-3xl font-bold mb-4">{s.heading}</h2>}
            {s.type === "benefits" && Array.isArray(s.items) && (
              <ul className="grid md:grid-cols-2 gap-3">
                {s.items.map((it: string, k: number) => (
                  <li key={k} className="border border-border rounded-lg p-4 bg-card/50">
                    <span className="text-primary mr-2">✦</span>{it}
                  </li>
                ))}
              </ul>
            )}
            {s.type === "how" && Array.isArray(s.steps) && (
              <ol className="space-y-3">
                {s.steps.map((it: string, k: number) => (
                  <li key={k} className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      {k + 1}
                    </span>
                    <span className="pt-1">{it}</span>
                  </li>
                ))}
              </ol>
            )}
            {s.type === "testimonial" && s.quote && (
              <blockquote className="border-l-4 border-primary pl-4 italic text-lg">
                „{s.quote}"
                {s.author && <footer className="text-sm text-muted-foreground mt-2 not-italic">— {s.author}</footer>}
              </blockquote>
            )}
          </section>
        ))}

        {page.sponsor_active && page.sponsor_name && page.sponsor_url && (
          <div className="border border-amber-500/40 bg-amber-500/5 rounded-lg p-4 text-sm text-center">
            Sponsor strony: <a href={page.sponsor_url} target="_blank" rel="noreferrer" className="text-amber-300 underline">{page.sponsor_name}</a>
          </div>
        )}

        {/* Final CTA */}
        <div className="text-center py-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">Witaj w domu, w którym zawsze gra coś Twojego.</h2>
          <Button size="lg" asChild className="text-base h-12 px-8 mt-4">
            <Link to={page.cta_url || "/"}>{page.cta_text || "Wejdź do GrouAI Stream"}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
