// Panel promocji bloga: pokazuje GOTOWE posty do social (X/LinkedIn/Facebook)
// wygenerowane automatycznie co tydzień przez generate_weekly_blog_promo().
// Człowiek kopiuje treść, publikuje na swoim koncie i oznacza jako „opublikowane".
// Zero autopostowania i zero wysyłki maili — świadomie (RODO/ePrivacy + deliverability).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, RefreshCw, Loader2, Megaphone, ExternalLink } from "lucide-react";

interface PromoPost {
  id: string;
  blog_slug: string;
  blog_title: string;
  platform: "x" | "linkedin" | "facebook";
  body: string;
  url: string;
  status: "draft" | "posted" | "skipped";
  week_of: string;
  created_at: string;
}

const PLATFORM: Record<string, { label: string; color: string }> = {
  x: { label: "X / Twitter", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  linkedin: { label: "LinkedIn", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  facebook: { label: "Facebook", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
};

export function BlogPromoPanel() {
  const [posts, setPosts] = useState<PromoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blog_promo_posts")
      .select("id, blog_slug, blog_title, platform, body, url, status, week_of, created_at")
      .eq("status", "draft")
      .order("week_of", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120);
    setPosts((data as PromoPost[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const regenerate = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("generate_weekly_blog_promo", { _limit: 6 });
      if (error) throw error;
      toast.success("Wygenerowano paczkę postów na ten tydzień");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Nie udało się wygenerować");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (p: PromoPost) => {
    try {
      await navigator.clipboard.writeText(p.body);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 1500);
    } catch {
      toast.error("Kopiowanie zablokowane przez przeglądarkę");
    }
  };

  const setStatus = async (p: PromoPost, status: "posted" | "skipped") => {
    await supabase.from("blog_promo_posts").update({ status }).eq("id", p.id);
    setPosts((list) => list.filter((x) => x.id !== p.id));
  };

  // Grupowanie po tygodniu.
  const byWeek = posts.reduce<Record<string, PromoPost[]>>((acc, p) => {
    (acc[p.week_of] ||= []).push(p);
    return acc;
  }, {});

  return (
    <Card className="bg-card/50 backdrop-blur border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5 text-primary" />
          Promocja bloga — gotowe posty do social
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Automat co poniedziałek generuje posty o najnowszych wpisach z CTA grouaistream.com.
          Kopiujesz, publikujesz na swoim koncie i oznaczasz jako opublikowane. Google/Bing pinguje
          osobno funkcja <code className="text-[11px]">indexnow-ping</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={regenerate} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Wygeneruj na ten tydzień
          </Button>
          <span className="text-xs text-muted-foreground">{posts.length} szkiców do publikacji</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Brak szkiców. Kliknij „Wygeneruj na ten tydzień" albo poczekaj na poniedziałkowy automat.
          </p>
        ) : (
          Object.entries(byWeek).map(([week, items]) => (
            <div key={week} className="space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
                Tydzień od {new Date(week).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border/50 bg-background/40 p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-[10px] border ${PLATFORM[p.platform]?.color || ""}`}>
                        {PLATFORM[p.platform]?.label || p.platform}
                      </Badge>
                      <a href={p.url} target="_blank" rel="noreferrer"
                         className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 truncate">
                        {p.blog_title} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-foreground/90 font-sans leading-relaxed flex-1 mb-3">
                      {p.body}
                    </pre>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => copy(p)} className="gap-1.5">
                        {copiedId === p.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === p.id ? "Skopiowano" : "Kopiuj"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(p, "posted")}>Opublikowane</Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setStatus(p, "skipped")}>Pomiń</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
