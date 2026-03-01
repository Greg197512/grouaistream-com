import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onSubmit: (name: string) => void;
}

export const AssistantNamingModal = ({ open, onSubmit }: Props) => {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim() || "Groove";
    onSubmit(trimmed);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-full max-w-md mx-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-8 shadow-2xl"
          >
            {/* Decorative elements */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/40"
              >
                <Mic className="h-6 w-6 text-primary-foreground" />
              </motion.div>
            </div>

            <div className="text-center mt-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-bold text-foreground">Twój Asystent AI</h2>
                  <Music className="h-5 w-5 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Nadaj imię swojemu asystentowi muzycznemu.<br />
                  Będzie Cię słuchać, uczyć się i reagować na Twój głos.
                </p>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <Input
                placeholder="np. Rocco, Luna, Max..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="text-center text-lg font-semibold bg-background/50 border-primary/20 focus:border-primary h-12"
                autoFocus
              />
              <Button
                onClick={handleSubmit}
                className="w-full h-12 text-base font-bold groove-glow"
                size="lg"
              >
                <Mic className="mr-2 h-5 w-5" />
                {name.trim() ? `Aktywuj "${name.trim()}"` : "Aktywuj asystenta"}
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-muted-foreground text-center mt-4"
            >
              Powiedz imię asystenta, żeby go przywołać 🎤
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
