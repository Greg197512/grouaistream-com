import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Coffee, Flame, Brain, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { speak } from "@/utils/tts";

type Mood = "chill" | "energetic" | "focus" | "party";

const MOODS: { id: Mood; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: "chill",     label: "Chill",     icon: Coffee,       color: "from-sky-500/80 to-cyan-500/80",       desc: "Ambient · Lo-fi · Acoustic" },
  { id: "energetic", label: "Energetic", icon: Flame,        color: "from-orange-500/80 to-red-500/80",     desc: "Rock · EDM · Hip-Hop" },
  { id: "focus",     label: "Focus",     icon: Brain,        color: "from-emerald-500/80 to-teal-500/80",   desc: "Instrumental · Deep work" },
  { id: "party",     label: "Party",     icon: PartyPopper,  color: "from-fuchsia-500/80 to-pink-500/80",   desc: "Dance · House · Pop" },
];

// Krótka zapowiedź DJ-a przy przełączeniu trybu — sam entuzjastyczny głos,
// bez efektów dźwiękowych (patrz useDJMode.ts / utils/tts.ts).
const MOOD_ANNOUNCEMENT: Record<Mood, string> = {
  chill: "Zwalniamy tempo — wchodzimy w tryb Chill. Usiądź wygodnie, lecimy z klimatem.",
  energetic: "Ładujemy energię — tryb Energetic! Rock, EDM i hip-hop, trzymaj się!",
  focus: "Tryb Focus — instrumentalnie i na luzie, żeby dobrze Ci się pracowało.",
  party: "Impreza się zaczyna — tryb Party! Dance, house i pop, dawaj na parkiet!",
};

export const RadioMoodSwitcher = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const [currentMode, setCurrentMode] = useState<string>("24h");
  const [loadingMood, setLoadingMood] = useState<Mood | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("radio_config").select("mode").limit(1).maybeSingle();
      if (!cancelled && data?.mode) setCurrentMode(data.mode);
    };
    load();
    const ch = supabase
      .channel("radio-config-mode")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "radio_config" }, (p) => {
        const m = (p.new as { mode?: string })?.mode;
        if (m) setCurrentMode(m);
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const activeMood = currentMode.startsWith("mood:") ? (currentMode.slice(5) as Mood) : null;

  const handlePick = async (mood: Mood) => {
    if (!user) {
      toast.error("Zaloguj się, aby przełączyć tryb radia.");
      return;
    }
    if (!isAdmin) {
      toast.info(`🎧 Tryb radia: ${mood}. Globalna zmiana jest tylko dla admin/DJ.`);
      return;
    }
    setLoadingMood(mood);
    toast.loading(`🤖 AI buduje nową playlistę "${mood}"...`, { id: "mood-switch" });
    try {
      const { data, error } = await supabase.functions.invoke("radio-mood-switch", { body: { mood } });
      if (error) throw error;
      toast.success(
        `🎵 Radio przełączone na "${mood}" (${data?.dispatched === "n8n" ? "AI przez n8n" : "fallback shuffle"}).`,
        { id: "mood-switch", duration: 4000 },
      );
      void speak(MOOD_ANNOUNCEMENT[mood], { mode: "dj" });
    } catch (e) {
      toast.error(`Nie udało się przełączyć: ${(e as Error).message}`, { id: "mood-switch" });
    } finally {
      setLoadingMood(null);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-primary/20 bg-card/40 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-sm font-bold tracking-wide">Inteligentne tryby radia</h3>
          <p className="text-[11px] text-muted-foreground">
            Klik = AI dobiera ~60 utworów do nastroju i puszcza na antenie.
          </p>
        </div>
        {activeMood && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 uppercase tracking-wider">
            On air: {activeMood}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MOODS.map((m) => {
          const Icon = m.icon;
          const isActive = activeMood === m.id;
          const isLoading = loadingMood === m.id;
          return (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePick(m.id)}
              disabled={loadingMood !== null}
              className={cn(
                "relative overflow-hidden rounded-xl p-3 text-left border transition-all",
                "bg-gradient-to-br",
                m.color,
                isActive ? "border-primary ring-2 ring-primary/60 shadow-[0_0_24px_hsl(14_100%_57%/0.5)]" : "border-white/10 hover:border-white/30",
                loadingMood !== null && !isLoading && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Icon className="h-4 w-4 text-white" />}
                <span className="font-bold text-sm text-white drop-shadow">{m.label}</span>
              </div>
              <p className="text-[10px] text-white/80 leading-tight">{m.desc}</p>
            </motion.button>
          );
        })}
      </div>

      {!isAdmin && (
        <p className="text-[10px] text-muted-foreground mt-2 italic">
          * Globalna zmiana radia dla wszystkich słuchaczy — tylko admin/DJ.
        </p>
      )}
    </div>
  );
};
