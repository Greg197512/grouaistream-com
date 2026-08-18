import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Radio, Users } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { pl } from "date-fns/locale";

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
            {users.map((u) => (
              <div key={u.user_id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 p-2.5">
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-xs font-semibold">{nameOf(u).charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nameOf(u)}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.online_at ? `od ${formatDistanceToNowStrict(new Date(u.online_at), { locale: pl })}` : "online"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
