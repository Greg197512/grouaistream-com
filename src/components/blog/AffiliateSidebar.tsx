import { useEffect, useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Affiliate {
  id: string;
  brand: string;
  display_text: string;
  url: string;
  description: string | null;
  category: string;
}

interface Props {
  category: string;
}

export const AffiliateSidebar = ({ category }: Props) => {
  const [items, setItems] = useState<Affiliate[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_affiliate_links")
        .select("id, brand, display_text, url, description, category")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(20);
      const all = (data || []) as Affiliate[];
      // Prefer same category + always include 'self'
      const matched = all.filter((a) => a.category === category || a.category === "self");
      const fallback = matched.length >= 3 ? matched : all;
      setItems(fallback.slice(0, 4));
    })();
  }, [category]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden xl:block sticky top-24 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-accent/80 font-bold">
        Polecane narzędzia
      </div>
      {items.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener sponsored"
          className="block p-3 rounded-xl bg-gradient-to-br from-card/60 to-card/30 border border-border hover:border-primary/50 transition-all group hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                {a.brand}
              </span>
            </div>
            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
          </div>
          {a.description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{a.description}</p>
          )}
        </a>
      ))}
      <p className="text-[9px] text-muted-foreground/60 leading-tight pt-1">
        Niektóre linki to linki partnerskie. Klikając wspierasz GrouAI Stream.
      </p>
    </aside>
  );
};
