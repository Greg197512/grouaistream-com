import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles } from "lucide-react";
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
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-[280px] mx-4 rounded-2xl p-5 shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(60px) saturate(180%)',
              WebkitBackdropFilter: 'blur(60px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {/* Subtle glow accent */}
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            
            {/* Icon */}
            <div className="flex justify-center mb-3">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.6), hsl(var(--accent) / 0.4))',
                  boxShadow: '0 0 20px hsl(var(--primary) / 0.3)',
                }}
              >
                <Mic className="h-4 w-4 text-primary-foreground" />
              </motion.div>
            </div>

            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Sparkles className="h-3 w-3 text-primary/70" />
                <h2 className="text-sm font-semibold text-foreground/90">Nadaj imię asystentowi</h2>
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                Wpisz imię — będzie Cię słuchać i reagować na głos
              </p>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="np. Rocco, Luna, Max..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="text-center text-sm font-medium h-9 border-0 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'hsl(var(--foreground))',
                }}
                autoFocus
              />
              <Button
                onClick={handleSubmit}
                className="w-full h-9 text-xs font-semibold rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.7), hsl(var(--accent) / 0.5))',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Mic className="mr-1.5 h-3 w-3" />
                {name.trim() ? `Aktywuj „${name.trim()}"` : "Aktywuj"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
