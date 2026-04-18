import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Check, X, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTipWallet } from "@/hooks/useTipWallet";
import { toast } from "sonner";

interface BoostPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
}

export const BoostPurchaseModal = ({ isOpen, onClose, trackId, trackTitle }: BoostPurchaseModalProps) => {
  const { user } = useAuth();
  const { wallet, refresh } = useTipWallet();
  const [purchasing, setPurchasing] = useState(false);
  const [done, setDone] = useState<null | { expires: string }>(null);

  const PRICE = 5;
  const balance = wallet?.balance ?? 0;
  const canAfford = balance >= PRICE;

  const handlePurchase = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby kupić boost");
      return;
    }
    if (!canAfford) {
      toast.error(`Za mało środków w portfelu (masz ${balance.toFixed(2)} €)`);
      return;
    }

    setPurchasing(true);
    try {
      const { data, error } = await supabase.rpc("purchase_boost" as any, {
        _track_id: trackId,
        _package: "basic",
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        if (result?.error === "insufficient_balance") {
          toast.error(`Za mało środków (masz ${result.balance} €, trzeba ${result.required} €)`);
        } else {
          toast.error("Nie udało się kupić boosta: " + (result?.error || "unknown"));
        }
        return;
      }

      await refresh();
      setDone({ expires: result.expires_at });
      toast.success(`🚀 Boost aktywny dla "${trackTitle}"!`);
    } catch (err: any) {
      console.error("Boost purchase error:", err);
      toast.error("Błąd zakupu: " + (err.message || ""));
    } finally {
      setPurchasing(false);
    }
  };

  const handleClose = () => {
    setDone(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.92, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 12, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md relative rounded-3xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/95 to-orange-500/10 backdrop-blur-xl shadow-2xl shadow-amber-500/20"
        >
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-orange-500/20 blur-3xl" />
          </div>

          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/40 hover:bg-background/70 transition"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative p-6 sm:p-8">
            {!done ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <motion.div
                    animate={{ rotate: [0, -8, 8, 0], y: [0, -2, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity }}
                    className="p-2.5 rounded-2xl bg-amber-500/20"
                  >
                    <Rocket className="h-6 w-6 text-amber-400" />
                  </motion.div>
                  <div>
                    <h2 className="font-bold text-xl">Basic Boost</h2>
                    <p className="text-xs text-muted-foreground">Promuj swój utwór</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mt-3 mb-5 truncate">
                  🎵 <span className="text-foreground font-medium">{trackTitle}</span>
                </p>

                <div className="rounded-2xl bg-background/40 border border-white/5 p-5 mb-5">
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-4xl font-bold">5</span>
                    <span className="text-lg text-muted-foreground">€</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                      Jednorazowo
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {[
                      "5 000 wyświetleń promocyjnych",
                      "7 dni promocji utworu",
                      "Badge „Promowany” na okładce",
                      "Sekcja „Promowane” na głównej",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 px-1">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Twój portfel
                  </span>
                  <span className={canAfford ? "text-foreground font-medium" : "text-destructive font-medium"}>
                    {balance.toFixed(2)} €
                  </span>
                </div>

                <Button
                  onClick={handlePurchase}
                  disabled={purchasing || !canAfford}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
                >
                  {purchasing ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                        <Sparkles className="h-4 w-4" />
                      </motion.div>
                      Aktywuję boost…
                    </>
                  ) : !canAfford ? (
                    "Za mało środków w portfelu"
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Kup Basic Boost — 5€
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground mt-3">
                  Płatność z portfela tipów. Zwiększa widoczność i streamy.
                </p>
              </>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-4"
              >
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-flex p-4 rounded-full bg-amber-500/20 mb-4"
                >
                  <Rocket className="h-10 w-10 text-amber-400" />
                </motion.div>
                <h2 className="font-bold text-2xl mb-2">Boost aktywny! 🚀</h2>
                <p className="text-sm text-muted-foreground mb-1">
                  „{trackTitle}” promowany przez 7 dni
                </p>
                <p className="text-xs text-muted-foreground/70 mb-6">
                  do {new Date(done.expires).toLocaleDateString("pl-PL")}
                </p>
                <Button
                  onClick={handleClose}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold"
                >
                  Świetnie, lecę dalej 🎶
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
