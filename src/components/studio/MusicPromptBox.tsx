import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Send, Globe, Zap, Music2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { invokeStudioEngine, waitForAceStep, fireCoverGeneration, isSubscriptionError } from "@/lib/hubStudio";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { UpgradeModal } from "@/components/modals/UpgradeModal";

type Lang = "auto" | "pl" | "en" | "nl" | "uk";

const PLACEHOLDERS: Record<Exclude<Lang, "auto">, string[]> = {
  pl: [
    "Smutny lo-fi z deszczem, 80 BPM, 2 minuty, instrumentalny…",
    "Energetyczny synthwave w stylu The Midnight, męski wokal, 3 minuty…",
    "Mroczny trap na nocną jazdę, 140 BPM, kobiecy szept…",
    "Spokojny ambient do medytacji, 70 BPM, 4 minuty…",
  ],
  en: [
    "Sad lo-fi with rain, 80 BPM, 2 minutes, instrumental…",
    "Energetic synthwave like The Midnight, male vocals, 3 minutes…",
    "Dark trap for a night drive, 140 BPM, female whisper…",
    "Calm ambient for meditation, 70 BPM, 4 minutes…",
  ],
  nl: [
    "Verdrietige lo-fi met regen, 80 BPM, 2 minuten, instrumentaal…",
    "Energieke synthwave zoals The Midnight, mannelijke zang, 3 minuten…",
    "Donkere trap voor een nachtrit, 140 BPM, vrouwelijk gefluister…",
    "Rustige ambient voor meditatie, 70 BPM, 4 minuten…",
  ],
  uk: [
    "Сумний lo-fi з дощем, 80 BPM, 2 хвилини, інструментальний…",
    "Енергійний synthwave у стилі The Midnight, чоловічий вокал, 3 хвилини…",
    "Темний trap для нічної їзди, 140 BPM, жіночий шепіт…",
    "Спокійний ambient для медитації, 70 BPM, 4 хвилини…",
  ],
};

const STAGE_LABELS: Record<Exclude<Lang, "auto">, { parsing: string; composing: string; done: string }> = {
  pl: { parsing: "Rozumiem co chcesz…", composing: "Komponuję utwór…", done: "Gotowe!" },
  en: { parsing: "Understanding your idea…", composing: "Composing your track…", done: "Done!" },
  nl: { parsing: "Ik begrijp wat U wilt…", composing: "Ik componeer Uw nummer…", done: "Klaar!" },
  uk: { parsing: "Розумію вашу ідею…", composing: "Створюю трек…", done: "Готово!" },
};

interface Props {
  onTrackReady?: (data: {
    audioUrl?: string;
    coverUrl?: string;
    generationId: string;
    plan: any;
    engine: string;
    taskId?: string;
    processing?: boolean;
  }) => void;
}

export function MusicPromptBox({ onTrackReady }: Props) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<Lang>("auto");
  const [stage, setStage] = useState<"idle" | "parsing" | "composing" | "done" | "error">("idle");
  const [planSummary, setPlanSummary] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotate placeholders for inspiration
  useEffect(() => {
    if (prompt) return;
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % 4), 3500);
    return () => clearInterval(id);
  }, [prompt]);

  const placeholderLang = language === "auto" ? "pl" : language;
  const placeholder = PLACEHOLDERS[placeholderLang][placeholderIdx];
  const labels = STAGE_LABELS[placeholderLang];

  const handleGenerate = async () => {
    if (!user) {
      toast.error("Zaloguj się aby tworzyć muzykę");
      return;
    }
    if (prompt.trim().length < 3) {
      toast.error("Powiedz coś więcej o utworze");
      return;
    }

    setStage("parsing");
    setError("");
    setPlanSummary("");

    try {
      const { data, error: fnError } = await invokeStudioEngine("studio-prompt-engine", {
        prompt: prompt.trim(),
        ...(language !== "auto" ? { language } : {}),
      });

      if (fnError) {
        throw new Error(fnError.message || "Generation failed");
      }
      if (!data?.success) {
        throw new Error(data?.message || data?.error || "Engine error");
      }

      // Show plan summary (AI ułożyło tytuł, styl i tekst)
      const summary: string = data.plan?.human_summary || "";
      setPlanSummary(summary);
      setStage("composing");

      // Okładka AI (darmowa) generuje się w tle, dopasowana do tytułu i stylu
      fireCoverGeneration(data.task_id, data.plan?.title || "", data.plan?.tags || "");

      // ACE-Step pracuje asynchronicznie — czekamy na gotowy utwór
      const { audioUrl, coverUrl } = await waitForAceStep(data.task_id, data.generation_id, (sec) => {
        setPlanSummary(`${summary} · ${labels.composing} ${sec}s`);
      });

      setStage("done");
      toast.success(labels.done);
      onTrackReady?.({
        audioUrl,
        coverUrl: coverUrl || undefined,
        generationId: data.generation_id,
        plan: data.plan,
        engine: data.engine,
      });
      setTimeout(() => setStage("idle"), 2500);
    } catch (e: any) {
      if (isSubscriptionError(e)) {
        setStage("idle");
        setShowUpgrade(true);
        return;
      }
      console.error("[MusicPromptBox]", e);
      setStage("error");
      setError(e.message || "Coś poszło nie tak");
      toast.error(e.message || "Błąd generowania");
      setTimeout(() => setStage("idle"), 5000);
    }
  };

  const isBusy = stage === "parsing" || stage === "composing";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full"
    >
      {/* Glow background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-purple-500/10 to-orange-500/20 blur-3xl opacity-60" />

      <div className="relative rounded-3xl border-2 border-primary/40 bg-card/60 backdrop-blur-xl p-6 shadow-2xl shadow-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isBusy ? 360 : 0 }}
              transition={{ duration: 2, repeat: isBusy ? Infinity : 0, ease: "linear" }}
            >
              <Sparkles className="w-5 h-5 text-primary" />
            </motion.div>
            <h2 className="text-lg font-bold tracking-tight">
              Powiedz mi co zagrać
            </h2>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              AI · PL/EN/NL/UK
            </Badge>
          </div>

          {/* Language switcher */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1">
            {(["auto", "pl", "en", "nl", "uk"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                disabled={isBusy}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  language === l
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l === "auto" ? <Globe className="w-3 h-3 inline" /> : l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          placeholder={placeholder}
          disabled={isBusy}
          className="min-h-[100px] text-base resize-none bg-background/50 border-primary/20 focus-visible:ring-primary placeholder:text-muted-foreground/60"
        />

        {/* Action row */}
        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />
            <span>Cmd/Ctrl + Enter</span>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isBusy || prompt.trim().length < 3}
            size="lg"
            className="bg-gradient-to-r from-primary via-purple-500 to-orange-500 hover:opacity-90 text-white font-bold px-8 shadow-lg shadow-primary/30"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {stage === "parsing" ? labels.parsing : labels.composing}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Generuj
              </>
            )}
          </Button>
        </div>

        {/* Plan summary / progress */}
        <AnimatePresence>
          {(planSummary || error || stage === "done") && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              {error ? (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-primary/10 border border-primary/30 p-3 text-sm">
                  <Music2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span className="text-foreground/90">{planSummary || labels.done}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated bars while composing */}
        <AnimatePresence>
          {stage === "composing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-1 mt-4 h-8"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-gradient-to-t from-primary to-orange-500 rounded-full"
                  animate={{ height: ["20%", "100%", "20%"] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generowanie wymaga planu Pro/Ultimate */}
      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </motion.div>
  );
}
