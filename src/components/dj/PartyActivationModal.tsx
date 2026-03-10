import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PartyActivationModalProps {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
}

const PARTY_CODE = "00008";

export const PartyActivationModal = ({ open, onClose, onActivated }: PartyActivationModalProps) => {
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    if (code === PARTY_CODE) {
      toast.success("💀 Parkiet aktywowany — czas na domówkę!");
      onActivated();
      setCode("");
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error("Nieprawidłowy kod – spróbuj jeszcze raz");
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={shake ? { scale: 1, opacity: 1, x: [-8, 8, -8, 8, 0] } : { scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-gradient-to-b from-[#0a0a15] to-[#12041e] p-6 shadow-2xl shadow-red-900/20"
        >
          {/* Neon glow top accent */}
          <div className="absolute -top-px left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-400" />
              <h2 className="font-bold text-lg text-foreground">Aktywuj Parkiet QR</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-5">
            Podaj kod bezpieczeństwa, żeby uruchomić QR i wspólne sterowanie ekipą.
          </p>

          <div className="mb-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={5}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 5 && handleSubmit()}
              placeholder="• • • • •"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono py-4 rounded-xl bg-black/50 border border-red-500/20 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all"
              autoFocus
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={code.length !== 5}
            className="w-full gap-2 py-6 text-base bg-gradient-to-r from-red-600 to-purple-700 hover:from-red-500 hover:to-purple-600 border-0 disabled:opacity-30"
          >
            <Zap className="h-5 w-5" />
            Aktywuj i pokaż QR
          </Button>

          <p className="text-[11px] text-muted-foreground/60 text-center mt-4 leading-relaxed">
            Kod chroni przed przypadkowym startem imprezy. Po imprezie możesz zamknąć pokój.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
