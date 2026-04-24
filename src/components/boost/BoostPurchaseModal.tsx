import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Check, X, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { openPaddleCheckout } from "@/lib/paddle";
import { toast } from "sonner";

interface BoostPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
}

export const BoostPurchaseModal = ({ isOpen, onClose, trackId, trackTitle }: BoostPurchaseModalProps) => {
  const { user } = useAuth();
  const [purchasing, setPurchasing] = useState(false);

  const PRICE = 5;

  const handlePurchase = async () => {
    if (!user) {
      toast.error("Zaloguj się, aby kupić boost");
      return;
    }

    setPurchasing(true);
    try {
      await openPaddleCheckout({
        priceId: "grouai_boost_basic",
        customerEmail: user.email,
        customData: {
          userId: user.id,
          boostTrackId: trackId,
          boostPackage: "basic",
        },
        successUrl: `${window.location.origin}/creator-earnings?boost=success`,
      });
      toast.success("Otwieram bezpieczną płatność…");
      onClose();
    } catch (err: any) {
      console.error("Boost checkout error:", err);
      toast.error("Nie udało się otworzyć płatności: " + (err?.message || ""));
    } finally {
      setPurchasing(false);
    }
  };

  const handleClose = () => {
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
                <span className="text-4xl font-bold">{PRICE}</span>
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

            <Button
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
            >
              {purchasing ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="h-4 w-4" />
                  </motion.div>
                  Otwieram płatność…
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Kup Basic Boost — {PRICE}€
                </>
              )}
            </Button>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-secondary/40 rounded-lg p-2.5 mt-3">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>
                Bezpieczna płatność kartą (Paddle) · VAT, faktura, zwrot 30 dni · Boost aktywuje się od razu
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
