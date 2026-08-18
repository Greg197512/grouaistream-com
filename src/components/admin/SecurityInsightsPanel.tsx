import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchGeoList, type UserGeo } from "@/lib/hubGeo";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Shield, Users, Bot, Loader2, AlertTriangle, Smartphone, Globe, ScanLine } from "lucide-react";

const flagEmoji = (cc?: string | null) => {
  if (!cc || cc.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
};

const CHART_COLORS = ["#8b5cf6", "#ec4899", "#22d3ee", "#f59e0b", "#34d399", "#f43f5e", "#a3e635", "#60a5fa"];

interface IpCluster { ip: string; accounts: UserGeo[]; }
interface UploaderStat {
  userId: string;
  label: string;
  total: number;
  last24h: number;
  burst: number;      // najwięcej wrzutów w oknie 10 min
  botScore: number;   // 0–3: sygnały bota
  reasons: string[];
}

export const SecurityInsightsPanel = () => {
  const [geo, setGeo] = useState<UserGeo[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(true);

  const [scanning, setScanning] = useState(false);
  const [uploaders, setUploaders] = useState<UploaderStat[] | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingGeo(true);
      const rows = await fetchGeoList();
      // jeden wiersz na user_id (fetchGeoList zwraca po userze)
      setGeo(rows);
      setLoadingGeo(false);
    })();
  }, []);

  // ── Rozbicie urządzeń ──────────────────────────────────────────────────────
  const deviceData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of geo) {
      const d = g.device || "Nieznane";
      m[d] = (m[d] || 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [geo]);

  // ── Top kraje ──────────────────────────────────────────────────────────────
  const countryData = useMemo(() => {
    const m: Record<string, { c: number; cc: string }> = {};
    for (const g of geo) {
      const k = g.country || "Nieznany";
      if (!m[k]) m[k] = { c: 0, cc: g.country_code || "" };
      m[k].c++;
    }
    return Object.entries(m)
      .map(([name, v]) => ({ name, value: v.c, cc: v.cc }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [geo]);

  // ── Wiele kont z jednego IP ─────────────────────────────────────────────────
  const ipClusters: IpCluster[] = useMemo(() => {
    const byIp: Record<string, UserGeo[]> = {};
    for (const g of geo) {
      if (!g.ip) continue;
      (byIp[g.ip] ||= []).push(g);
    }
    return Object.entries(byIp)
      .map(([ip, accounts]) => ({ ip, accounts }))
      .filter((c) => c.accounts.length >= 2)
      .sort((a, b) => b.accounts.length - a.accounts.length);
  }, [geo]);

  const multiAccounts = ipClusters.reduce((n, c) => n + c.accounts.length, 0);

  // ── Skan wrzutów / botów ────────────────────────────────────────────────────
  const scanUploads = async () => {
    setScanning(true);
    try {
      // Lekki: tylko user_id + czas + artysta (bez audio) — liczymy po stronie klienta.
      const { data, error } = await supabase
        .from("tracks")
        .select("user_id, created_at, artist")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50000);
      if (error) throw error;

      const byUser: Record<string, { times: number[]; artist: string }> = {};
      for (const t of data || []) {
        const uid = (t as any).user_id as string;
        if (!uid) continue;
        (byUser[uid] ||= { times: [], artist: (t as any).artist || "" }).times.push(new Date((t as any).created_at).getTime());
      }

      const geoByUser: Record<string, UserGeo> = {};
      for (const g of geo) geoByUser[g.user_id] = g;

      const now = Date.now();
      const DAY = 24 * 60 * 60 * 1000;
      const stats: UploaderStat[] = Object.entries(byUser).map(([userId, v]) => {
        const times = v.times.sort((a, b) => a - b);
        const total = times.length;
        const last24h = times.filter((t) => now - t < DAY).length;
        // największy „burst” — ile wrzutów w oknie 10 minut
        let burst = 1;
        for (let i = 0; i < times.length; i++) {
          let j = i;
          while (j < times.length && times[j] - times[i] <= 10 * 60 * 1000) j++;
          burst = Math.max(burst, j - i);
        }
        const g = geoByUser[userId];
        const reasons: string[] = [];
        let botScore = 0;
        if (!g || !g.user_agent) { botScore++; reasons.push("brak/znany user-agent"); }
        if (burst >= 8) { botScore++; reasons.push(`seria ${burst} wrzutów w 10 min`); }
        if (last24h >= 15) { botScore++; reasons.push(`${last24h} wrzutów w 24h`); }
        return {
          userId,
          label: g?.email || v.artist || `${userId.slice(0, 8)}…`,
          total, last24h, burst, botScore, reasons,
        };
      });

      stats.sort((a, b) => b.botScore - a.botScore || b.burst - a.burst || b.total - a.total);
      setUploaders(stats.slice(0, 40));
    } catch (e) {
      setUploaders([]);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">Bezpieczeństwo i boty</h3>
      </div>

      {/* Rozbicie urządzeń + top kraje */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Urządzenia</CardTitle></CardHeader>
          <CardContent>
            {loadingGeo ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deviceData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} osób`, ""]} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {deviceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Top kraje</CardTitle></CardHeader>
          <CardContent>
            {loadingGeo ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
              <div className="space-y-1.5">
                {countryData.map((c, i) => {
                  const max = countryData[0]?.value || 1;
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-base w-5 text-center">{flagEmoji(c.cc) || "🌍"}</span>
                      <span className="text-xs w-28 truncate">{c.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(c.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="text-xs tabular-nums w-6 text-right">{c.value}</span>
                    </div>
                  );
                })}
                {countryData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Brak danych geo.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wiele kont z jednego IP */}
      <Card className="border-amber-500/30 bg-amber-500/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-500" /> Wiele kont z jednego IP
            {ipClusters.length > 0 && <Badge className="bg-amber-500 text-black">{ipClusters.length} IP · {multiAccounts} kont</Badge>}
          </CardTitle>
          <CardDescription>To samo IP używane przez ≥2 konta — możliwe multikonta z jednego urządzenia/sieci (uwaga: może to być też wspólny WiFi/rodzina).</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingGeo ? <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            : ipClusters.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Brak — każde IP ma jedno konto. 👍</p>
            : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {ipClusters.map((c) => (
                  <div key={c.ip} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{flagEmoji(c.accounts[0]?.country_code) || "🌍"}</span>
                      <span className="font-mono text-sm">{c.ip}</span>
                      <Badge variant="secondary" className="ml-auto">{c.accounts.length} kont</Badge>
                    </div>
                    <div className="space-y-0.5">
                      {c.accounts.map((a) => (
                        <div key={a.user_id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="text-foreground truncate max-w-[220px]">{a.email || `${a.user_id.slice(0, 8)}…`}</span>
                          <span className="text-muted-foreground/60">· {[a.city, a.country].filter(Boolean).join(", ")}</span>
                          <span className="ml-auto">{a.hits} wejść</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Skan wrzutów / botów */}
      <Card className="border-rose-500/30 bg-rose-500/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-rose-400" /> Masowe wrzuty / boty</CardTitle>
          <CardDescription>Kto wrzuca dużo i szybko — sygnały bota: brak user-agenta, seria wrzutów w 10 min, dużo w 24 h.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => void scanUploads()} disabled={scanning} className="gap-2">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            {scanning ? "Skanuję wrzuty…" : "Skanuj wrzuty"}
          </Button>

          {uploaders && (
            uploaders.length === 0 ? <p className="text-sm text-muted-foreground">Brak danych.</p> : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {uploaders.map((u) => (
                  <div key={u.userId} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-2.5">
                    {u.botScore >= 2
                      ? <AlertTriangle className="h-4 w-4 text-rose-400 flex-none" />
                      : u.botScore === 1 ? <AlertTriangle className="h-4 w-4 text-amber-400 flex-none" />
                      : <Bot className="h-4 w-4 text-muted-foreground/40 flex-none" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{u.label}</span>
                        {u.botScore >= 2 && <Badge className="bg-rose-500">możliwy bot</Badge>}
                        {u.botScore === 1 && <Badge className="bg-amber-500 text-black">do sprawdzenia</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {u.total} utworów · {u.last24h} w 24h · max seria {u.burst}/10min
                        {u.reasons.length > 0 && <span className="text-rose-300/80"> — {u.reasons.join("; ")}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};
