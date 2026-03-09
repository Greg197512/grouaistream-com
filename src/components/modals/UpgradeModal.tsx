import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Zap, Star, Sparkles, X, Infinity, Music, Radio, Brain } from "lucide-react";
import { PaymentQRModal } from "./PaymentQRModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const planConfigs = [
  {
    id: "free",
    nameKey: "upgrade.free.name",
    price: "0",
    periodKey: "upgrade.forever",
    icon: Music,
    color: "text-muted-foreground",
    featureKeys: ["upgrade.free.f1", "upgrade.free.f2", "upgrade.free.f3", "upgrade.free.f4"],
    current: true,
  },
  {
    id: "pro",
    nameKey: "upgrade.pro.name",
    price: "9.99",
    periodKey: "upgrade.perMonth",
    icon: Zap,
    color: "text-primary",
    popular: true,
    featureKeys: ["upgrade.pro.f1", "upgrade.pro.f2", "upgrade.pro.f3", "upgrade.pro.f4", "upgrade.pro.f5", "upgrade.pro.f6"],
  },
  {
    id: "ultimate",
    nameKey: "upgrade.ultimate.name",
    price: "19.99",
    periodKey: "upgrade.perMonth",
    icon: Crown,
    color: "text-accent",
    featureKeys: ["upgrade.ultimate.f1", "upgrade.ultimate.f2", "upgrade.ultimate.f3", "upgrade.ultimate.f4", "upgrade.ultimate.f5", "upgrade.ultimate.f6", "upgrade.ultimate.f7"],
  },
];

export const UpgradeModal = ({ open, onOpenChange }: UpgradeModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<"pro" | "ultimate" | null>(null);
  const { t } = useLanguage();
  const { plan: currentPlan, refreshSubscription } = useSubscription();

  const handleUpgrade = () => {
    if (selectedPlan === "free") {
      toast.info(t("upgrade.alreadyFree"));
      return;
    }
    setPaymentPlan(selectedPlan as "pro" | "ultimate");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden border-border bg-card">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header with gradient */}
          <div className="relative overflow-hidden px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6">
            <div className="absolute inset-0 groove-gradient-bg opacity-10" />
            <motion.div
              animate={{ opacity: [0.05, 0.15, 0.05] }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
              className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10"
            />
            <DialogHeader className="relative">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                >
                  <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
                </motion.div>
                <DialogTitle className="text-lg sm:text-2xl font-display groove-gradient-text">
                  {t("upgrade.title")}
                </DialogTitle>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {t("upgrade.subtitle")}
              </p>
            </DialogHeader>
          </div>

          {/* Plans */}
          <div className="px-4 sm:px-6 pb-6 sm:pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {planConfigs.map((plan) => (
                <motion.button
                  key={plan.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    "relative flex flex-col rounded-xl p-3 sm:p-5 text-left transition-all border",
                    selectedPlan === plan.id
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border bg-secondary/30 hover:border-muted-foreground/30"
                  )}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 groove-gradient-bg text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
                      {t("upgrade.popular")}
                    </span>
                  )}
                  
                  {plan.id === currentPlan && (
                    <span className="absolute -top-2.5 right-3 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ✓ {t("upgrade.currentPlan")}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <plan.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", plan.color)} />
                    <span className="font-display font-semibold text-sm sm:text-base">{t(plan.nameKey)}</span>
                  </div>
                  
                  <div className="mb-2 sm:mb-4">
                    <span className="text-2xl sm:text-3xl font-bold font-display">${plan.price}</span>
                    <span className="text-xs sm:text-sm text-muted-foreground">{t(plan.periodKey)}</span>
                  </div>
                  
                  <ul className="space-y-1.5 sm:space-y-2 flex-1">
                    {plan.featureKeys.map((featureKey) => (
                      <li key={featureKey} className="flex items-start gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                        <Check className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0", plan.color)} />
                        <span className="text-muted-foreground">{t(featureKey)}</span>
                      </li>
                    ))}
                  </ul>

                  {selectedPlan === plan.id && (
                    <motion.div
                      layoutId="plan-ring"
                      className="absolute inset-0 rounded-xl border-2 border-primary pointer-events-none"
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* CTA */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                onClick={handleUpgrade}
                disabled={isProcessing || selectedPlan === "free"}
                className="w-full h-10 sm:h-12 groove-gradient-bg text-primary-foreground font-semibold text-sm sm:text-base rounded-xl hover:opacity-90 gap-2"
              >
                {isProcessing ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    >
                      <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                    </motion.div>
                    {t("upgrade.processing")}
                  </>
                ) : selectedPlan === "free" ? (
                  t("upgrade.currentPlan")
                ) : (
                  <>
                    <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
                    {t("upgrade.upgradeTo")} {t(planConfigs.find(p => p.id === selectedPlan)?.nameKey || "")}
                  </>
                )}
              </Button>
            </motion.div>
            
            <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3">
              {t("upgrade.footer")}
            </p>
          </div>
        </div>
      </DialogContent>

      {/* Payment QR Modal */}
      {paymentPlan && (
        <PaymentQRModal
          open={!!paymentPlan}
          onOpenChange={(open) => {
            if (!open) {
              setPaymentPlan(null);
              onOpenChange(false);
            }
          }}
          plan={paymentPlan}
        />
      )}
    </Dialog>
  );
};
