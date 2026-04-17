import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone } from "lucide-react";

interface MarqueeMsg {
  id: string;
  message: string;
}

export const AdminMarquee = () => {
  const [messages, setMessages] = useState<MarqueeMsg[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("admin_marquee_messages")
      .select("id, message")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (data) setMessages(data);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-marquee")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_marquee_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (messages.length === 0) return null;

  // Duplicate for seamless loop
  const loopText = messages.map((m) => m.message).join("   •   ");

  return (
    <div className="relative mx-4 md:mx-6 mb-2 overflow-hidden rounded-full border border-primary/30 bg-gradient-to-r from-primary/10 via-background/80 to-accent/10 backdrop-blur-sm">
      <div className="flex items-center gap-3 py-2">
        <div className="flex shrink-0 items-center gap-2 px-3 border-r border-primary/30">
          <Megaphone className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider hidden sm:inline">Live</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee will-change-transform">
            <span className="text-sm font-medium text-foreground/90 px-4">{loopText}</span>
            <span className="text-sm font-medium text-foreground/90 px-4" aria-hidden="true">{loopText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
