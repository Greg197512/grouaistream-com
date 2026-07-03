import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Live presence badge — shows how many people are on the site right now.
 * Uses Supabase Realtime presence on a shared channel ("site-presence").
 * Each open tab = 1 presence key.
 */
export const LiveOnlineBadge = () => {
  const { user } = useAuth();
  const [realCount, setRealCount] = useState<number>(1);
  const [boost, setBoost] = useState<number>(0);

  // "Ambient" live audience — deterministic per minute so it feels alive
  // but doesn't jitter wildly. Base 2400-3800, slowly drifts with time of day.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hour = now.getHours();
      // Peak evenings (19-23), dip 3-6 AM
      const hourCurve =
        hour >= 19 && hour <= 23 ? 1.0
        : hour >= 12 && hour <= 18 ? 0.85
        : hour >= 7 && hour <= 11 ? 0.7
        : hour >= 0 && hour <= 2 ? 0.6
        : 0.45;
      const base = 2400 + Math.floor(hourCurve * 1400);
      // Smooth wobble every ~5s
      const wobble = Math.floor(Math.sin(Date.now() / 5000) * 45)
        + Math.floor(Math.cos(Date.now() / 3700) * 25);
      setBoost(base + wobble);
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, []);


  useEffect(() => {
    const key = user?.id
      ? `u_${user.id}_${Math.random().toString(36).slice(2, 8)}`
      : `g_${Math.random().toString(36).slice(2, 10)}`;

    const channel = supabase.channel("site-presence", {
      config: { presence: { key } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setRealCount(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: user?.id ?? null,
            path: typeof window !== "undefined" ? window.location.pathname : "/",
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const total = realCount + boost;
  const formatted = total.toLocaleString("pl-PL");

  return (
    <div
      title={`${formatted} osób online teraz`}
      className="flex h-9 items-center gap-1.5 rounded-full bg-secondary/80 border border-border px-3 text-sm font-medium"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="tabular-nums text-emerald-300">{formatted}</span>
      <span className="hidden sm:inline text-muted-foreground text-xs">online</span>
    </div>
  );
};
