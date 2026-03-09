import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Zap, Star, Sparkles, X, Infinity, Music, Radio, Brain } from "lucide-react";
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
  const { t } = useLanguage();

  const handleUpgrade = async () => {
    if (selectedPlan === "free") {
      toast.info(t("upgrade.alreadyFree"));
      return;
    }
    
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    
    const planName = selectedPlan === "pro" ? "Pro" : "Ultimate";
    toast.success(t("upgrade.welcomeMsg").replace("{plan}", planName));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-border bg-card">
        {/* Header with gradient */}
        <div className="relative overflow-hidden px-6 pt-8 pb-6">
          <div className="absolute inset-0 groove-gradient-bg opacity-10" />
          <motion.div
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
            className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10"
          />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              >
                <Crown className="h-8 w-8 text-accent" />
              </motion.div>
              <DialogTitle className="text-2xl font-display groove-gradient-text">
                {t("upgrade.title")}
              </DialogTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("upgrade.subtitle")}
            </p>
          </DialogHeader>
        </div>

        {/* Plans */}
        <div className="px-6 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {planConfigs.map((plan) => (
              <motion.button
                key={plan.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  "relative flex flex-col rounded-xl p-5 text-left transition-all border",
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
                
                <div className="flex items-center gap-2 mb-3">
                  <plan.icon className={cn("h-5 w-5", plan.color)} />
                  <span className="font-display font-semibold">{t(plan.nameKey)}</span>
                </div>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold font-display">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">{t(plan.periodKey)}</span>
                </div>
                
                <ul className="space-y-2 flex-1">
                  {plan.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2 text-xs">
                      <Check className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", plan.color)} />
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
              className="w-full h-12 groove-gradient-bg text-primary-foreground font-semibold text-base rounded-xl hover:opacity-90 gap-2"
            >
              {isProcessing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                  {t("upgrade.processing")}
                </>
              ) : selectedPlan === "free" ? (
                t("upgrade.currentPlan")
              ) : (
                <>
                  <Crown className="h-5 w-5" />
                  {t("upgrade.upgradeTo")} {t(planConfigs.find(p => p.id === selectedPlan)?.nameKey || "")}
                </>
              )}
            </Button>
          </motion.div>
          
          <p className="text-center text-xs text-muted-foreground mt-3">
            {t("upgrade.footer")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
