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
  const [count, setCount] = useState<number>(0);

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
        setCount(Object.keys(state).length);
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

  return (
    <div
      title={`${count} ${count === 1 ? "osoba" : "osób"} online teraz`}
      className="flex h-9 items-center gap-1.5 rounded-full bg-secondary/80 border border-border px-3 text-sm font-medium"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="tabular-nums text-emerald-300">{count}</span>
      <span className="hidden sm:inline text-muted-foreground text-xs">online</span>
    </div>
  );
};
