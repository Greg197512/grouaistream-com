import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Radio, Users, MapPin } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { pl } from "date-fns/locale";
import { fetchGeoList, type UserGeo } from "@/lib/hubGeo";

const flagEmoji = (cc?: string | null) => {
  if (!cc || cc.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65));
};

/**
 * „Kto teraz online” — podłącza się do tego samego kanału presence co czat
 * (grouai-presence). Liczba i lista są NA ŻYWO: dokładnie te osoby, które w tej
 * chwili mają otwartą aplikację. To jedyne wiarygodne źródło „aktywni teraz” —
 * presence nie jest nigdzie zapisywane, więc trzeba je czytać na żywo.
 *
 * Admin tylko SŁUCHA (nie track-uje siebie), żeby nie zawyżać liczby.
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

  // Geo (IP + lokalizacja) — z tego samego źródła co tabela użytkowników (admin).
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
          Na żywo — osoby, które w tej chwili mają otwartą aplikację (ten sam sygnał, co licznik przy czacie).
          Ty (admin) nie jesteś tu liczony.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-40" />
            <p className="text-sm">Nikt nie jest teraz online (albo dopiero się łączą).</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const g = geo[u.user_id];
              const loc = g ? [g.city, g.country].filter(Boolean).join(", ") : "";
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
                        </span>
                      )}
                      <span className="font-mono">IP: {g?.ip || "—"}</span>
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
