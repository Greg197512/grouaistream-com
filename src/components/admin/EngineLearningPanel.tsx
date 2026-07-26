import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw, Lock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchEngineLearningStats } from "@/lib/hubStudio";

// Pulpit „Nauka silnika" — pokazuje, że silnik uczy się na naszych utworach:
// ile lekcji, średnia jakość (i trend 7 dni), zwycięskie tagi, ostatnie przykłady.
interface Stats {
  total: number; scored: number;
  avg_all: number; avg_7d: number; avg_30d: number;
  by_language: Record<string, number>;
  by_engine: Record<string, number>;
  top_tags: { tag: string; n: number }[];
  recent: { language: string; engine: string; score: number | null; title: string; tags: string; hook: string; at: string }[];
}

const LANG_FLAG: Record<string, string> = { pl: "🇵🇱", en: "🇬🇧", nl: "🇳🇱", ua: "🇺🇦", uk: "🇺🇦" };

export function EngineLearningPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState<string>(() => localStorage.getItem("b2b-pricing-pin") || "");

  const load = useCallback(async (thePin?: string) => {
    const p = (thePin ?? pin).trim();
    if (!p) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = await fetchEngineLearningStats(p);
      if (!d?.ok) throw new Error(d?.error === "bad_pin" ? "Zły PIN" : (d?.error || "błąd"));
      setStats(d);
      localStorage.setItem("b2b-pricing-pin", p);
    } catch (e: any) { toast.error("Nie udało się: " + (e?.message || "")); }
    finally { setLoading(false); }
  }, [pin]);

  useEffect(() => { if (pin) void load(); /* eslint-disable-next-line */ }, []);

  const trend = stats ? +(stats.avg_7d - stats.avg_30d).toFixed(2) : 0;
  const TrendIcon = trend > 0.05 ? TrendingUp : trend < -0.05 ? TrendingDown : Minus;
  const trendColor = trend > 0.05 ? "text-emerald-400" : trend < -0.05 ? "text-rose-400" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Nauka silnika — uczy się na naszych utworach</h3>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Odśwież
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative sm:max-w-[240px]">
          <Lock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input type="password" placeholder="PIN admina" value={pin} onChange={(e) => setPin(e.target.value)} className="pl-7" />
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>Wczytaj</Button>
      </div>

      {loading && !stats ? (
        <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>
      ) : !stats ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Podaj PIN i kliknij „Wczytaj", aby zobaczyć naukę silnika.</div>
      ) : (
        <>
          {/* Kafelki */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Zebrane lekcje</div>
              <div className="font-display text-2xl font-extrabold tabular-nums">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Średnia jakość</div>
              <div className="font-display text-2xl font-extrabold tabular-nums">{stats.avg_all || "—"}<span className="text-sm text-muted-foreground">/10</span></div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Ostatnie 7 dni</div>
              <div className="font-display text-2xl font-extrabold tabular-nums flex items-center gap-1">
                {stats.avg_7d || "—"} <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Silniki</div>
              <div className="text-xs mt-1 space-y-0.5">
                {Object.entries(stats.by_engine).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e, n]) => (
                  <div key={e} className="flex justify-between gap-2"><span className="truncate text-muted-foreground">{e}</span><b className="tabular-nums">{n}</b></div>
                ))}
              </div>
            </div>
          </div>

          {/* Zwycięskie tagi */}
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-[#FFB020]" /> Zwycięskie brzmienia (z najlepszych utworów)</div>
            {stats.top_tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">Za mało wysoko ocenionych utworów — pojawią się, gdy powstanie więcej hitów.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats.top_tags.map((t) => (
                  <span key={t.tag} className="rounded-full border border-[#FF7A1A]/40 bg-[#FF7A1A]/10 px-2.5 py-1 text-[11px] font-medium text-[#FFB020]">
                    {t.tag} <span className="text-white/40">×{t.n}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Języki */}
          <div className="rounded-xl border border-border p-3">
            <div className="text-sm font-semibold mb-2">Nauka wg języka</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_language).sort((a, b) => b[1] - a[1]).map(([l, n]) => (
                <span key={l} className="rounded-lg border border-border px-2.5 py-1 text-xs">
                  {LANG_FLAG[l] || "🏳️"} {l.toUpperCase()} · <b className="tabular-nums">{n}</b>
                </span>
              ))}
            </div>
          </div>

          {/* Ostatnie lekcje */}
          <div className="rounded-xl border border-border p-3">
            <div className="text-sm font-semibold mb-2">Ostatnio nauczone</div>
            <div className="space-y-2">
              {stats.recent.map((r, i) => (
                <div key={i} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{LANG_FLAG[r.language] || "🏳️"}</span>
                    <b className="truncate">{r.title || "—"}</b>
                    {r.score != null && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.score >= 8 ? "bg-emerald-500/20 text-emerald-300" : r.score >= 6 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"}`}>{r.score}/10</span>
                    )}
                    <span className="text-muted-foreground ml-auto">{r.engine}</span>
                  </div>
                  {r.hook && <div className="text-muted-foreground/90 mt-0.5">refren: „{r.hook}"</div>}
                  {r.tags && <div className="text-muted-foreground/60 mt-0.5 truncate">{r.tags}</div>}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Każda nowa generacja dokłada lekcję. Silnik przed komponowaniem czyta nasze najlepsze utwory w danym języku i wzoruje się na ich poziomie (in-context learning). Modelu Suno nie trenujemy — uczymy nasz planer.
          </p>
        </>
      )}
    </div>
  );
}
