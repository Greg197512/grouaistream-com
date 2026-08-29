import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Radio, Users, MapPin, Monitor, Wifi, TrendingUp } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { pl } from "date-fns/locale";
import { fetchGeoList, fetchPresenceStats, type UserGeo, type PresenceStats } from "@/lib/hubGeo";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const flagEmoji = (cc?: string | null) => {
  if (!cc || cc.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
};

const hhmm = (epochSec: number) =>
  new Date(epochSec * 1000).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

/**
 * „Kto teraz online” + statystyki obecności (admin).
 * — Lista NA ŻYWO z presence (grouai-presence): kto ma teraz otwartą apkę,
 *   z imieniem, IP, lokalizacją (miasto/region/kraj), urządzeniem/przeglądarką,
 *   ISP i linkiem do mapy.
 * — Szczyt dnia + wykres „ilu online w czasie” z heartbeatu (presence_heartbeat).
 * Admin tylko słucha presence (nie zawyża liczby).
 */
interface OnlineUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  online_at?: string;
}

export const OnlineNowPanel = () => {
  const [ids, setIds] = useState<string[]>([]);
  const [since, setSince] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});
  const [geo, setGeo] = useState<Record<string, UserGeo>>({});
  const [stats, setStats] = useState<PresenceStats | null>(null);

  useEffect(() => {
    const channel = supabase.channel("grouai-presence");
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ online_at?: string }>>;
        const keys = Object.keys(state);
        setIds(keys);
        const s: Record<string, string> = {};
        for (const k of keys) s[k] = state[k]?.[0]?.online_at || "";
        setSince(s);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Geo (IP, lokalizacja, urządzenie, ISP) — to samo źródło co tabela userów.
  useEffect(() => {
    (async () => {
      const rows = await fetchGeoList();
      const map: Record<string, UserGeo> = {};
      for (const r of rows) {
        map[r.user_id] = r;
        if (r.email) map[r.email.toLowerCase()] = r;
      }
      setGeo(map);
    })();
  }, []);

  // Statystyki obecności (szczyt dnia + wykres 24h) — odśwież co 60 s.
  useEffect(() => {
    const load = () => { void fetchPresenceStats().then((s) => s && setStats(s)); };
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, []);

  // Dociągnij imiona/avatary dla obecnych user_id.
  useEffect(() => {
    const missing = ids.filter((id) => !(id in profiles));
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", missing);
      if (data) {
        setProfiles((prev) => {
          const next = { ...prev };
          for (const r of data) next[r.user_id] = { display_name: r.display_name, avatar_url: r.avatar_url };
          return next;
        });
      }
    })();
  }, [ids, profiles]);

  const users: OnlineUser[] = useMemo(
    () => ids.map((id) => ({
      user_id: id,
      display_name: profiles[id]?.display_name ?? null,
      avatar_url: profiles[id]?.avatar_url ?? null,
      online_at: since[id],
    })),
    [ids, profiles, since]
  );

  const chartData = useMemo(
    () => (stats?.series || []).map((p) => ({ label: hhmm(p.t), c: p.c })),
    [stats]
  );

  const nameOf = (u: OnlineUser) => u.display_name || `${u.user_id.slice(0, 8)}…`;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-emerald-500 animate-pulse" />
          Kto teraz online
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-sm font-bold text-emerald-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {users.length}
          </span>
        </CardTitle>
        <CardDescription>
          Na żywo — osoby, które w tej chwili mają otwartą aplikację. Ty (admin) nie jesteś tu liczony.
          Poniżej: szczyt dnia i wykres obecności z ostatnich 24 h.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Statystyki + wykres */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/50 bg-background/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Radio className="h-3.5 w-3.5" /> Online teraz</div>
            <div className="mt-0.5 text-2xl font-extrabold tabular-nums text-emerald-500">{users.length}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Szczyt dziś</div>
            <div className="mt-0.5 text-2xl font-extrabold tabular-nums">{stats?.peak_today ?? "—"}</div>
            {stats?.peak_at && (
              <div className="text-[11px] text-muted-foreground">
                o {new Date(stats.peak_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border/50 bg-background/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Sesje 24 h (kubełki 30 min)</div>
            <div className="mt-0.5 text-2xl font-extrabold tabular-nums">{chartData.length}</div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="onlineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l) => `Godz. ${l}`}
                  formatter={(v: number) => [`${v} online`, ""]}
                />
                <Area type="monotone" dataKey="c" stroke="hsl(160 84% 39%)" strokeWidth={2} fill="url(#onlineFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Lista online */}
        {users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-40" />
            <p className="text-sm">Nikt nie jest teraz online (albo dopiero się łączą).</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const g = geo[u.user_id];
              const loc = g ? [g.city, g.region, g.country].filter(Boolean).join(", ") : "";
              const dev = g ? [g.device, g.os, g.browser].filter(Boolean).join(" · ") : "";
              const mapUrl = g?.lat != null && g?.lng != null
                ? `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=11/${g.lat}/${g.lng}`
                : null;
              return (
                <div key={u.user_id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 p-2.5">
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-xs font-semibold">{nameOf(u).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{nameOf(u)}</p>
                      {g?.email && <span className="truncate text-xs text-muted-foreground">· {g.email}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{u.online_at ? `online od ${formatDistanceToNowStrict(new Date(u.online_at), { locale: pl })}` : "online"}</span>
                      {loc && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {g?.country_code && <span className="text-sm leading-none">{flagEmoji(g.country_code)}</span>}
                          {loc}
                          {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapa</a>}
                        </span>
                      )}
                      <span className="font-mono">IP: {g?.ip || "—"}</span>
                      {dev && <span className="inline-flex items-center gap-1"><Monitor className="h-3 w-3" /> {dev}</span>}
                      {g?.isp && <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3" /> {g.isp}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
