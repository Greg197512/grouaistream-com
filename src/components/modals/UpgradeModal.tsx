import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Zap, Sparkles, X, Music, Loader2, Lock } from "lucide-react";
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
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { openPaddleCheckout, isLiveCheckoutEnabled, getPaddleEnvironment } from "@/lib/paddle";
import { supabase } from "@/integrations/supabase/client";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Cycle = "monthly" | "yearly";

const planConfigs = [
  {
    id: "free",
    nameKey: "upgrade.free.name",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: Music,
    color: "text-muted-foreground",
    featureKeys: ["upgrade.free.f1", "upgrade.free.f2", "upgrade.free.f3", "upgrade.free.f4"],
    current: true,
  },
  {
    id: "pro",
    nameKey: "upgrade.pro.name",
    monthlyPrice: 9.99,
    yearlyPrice: 95.88, // 20% off = ~$7.99/mo
    icon: Zap,
    color: "text-primary",
    popular: true,
    featureKeys: ["upgrade.pro.f1", "upgrade.pro.f2", "upgrade.pro.f3", "upgrade.pro.f4", "upgrade.pro.f5", "upgrade.pro.f6"],
  },
  {
    id: "ultimate",
    nameKey: "upgrade.ultimate.name",
    monthlyPrice: 19.99,
    yearlyPrice: 191.88, // 20% off = ~$15.99/mo
    icon: Crown,
    color: "text-accent",
    featureKeys: ["upgrade.ultimate.f1", "upgrade.ultimate.f2", "upgrade.ultimate.f3", "upgrade.ultimate.f4", "upgrade.ultimate.f5", "upgrade.ultimate.f6", "upgrade.ultimate.f7"],
  },
];

export const UpgradeModal = ({ open, onOpenChange }: UpgradeModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useLanguage();
  const { plan: currentPlan, refreshSubscription } = useSubscription();
  const { user } = useAuth();

  const liveEnabled = isLiveCheckoutEnabled();
  const env = getPaddleEnvironment();
  const isExistingSubscriber = currentPlan === "pro" || currentPlan === "ultimate";

  const handleUpgrade = async () => {
    if (selectedPlan === "free") {
      toast.info(t("upgrade.alreadyFree"));
      return;
    }
    if (!user) {
      toast.error("Zaloguj się, aby kupić plan");
      return;
    }
    if (selectedPlan === currentPlan) {
      toast.info("To jest Twój aktualny plan.");
      return;
    }
    if (!liveEnabled) {
      toast.info("Płatne plany wracają wkrótce — finalizujemy weryfikację dostawcy płatności. Postaw nam kawę ☕ aby wesprzeć projekt teraz!");
      return;
    }
    setIsProcessing(true);
    try {
      const suffix = cycle === "yearly" ? "_yearly" : "_monthly";
      const priceId = `grouai_${selectedPlan}${suffix}`;

      // Existing subscriber → switch plan with proration via portal
      if (isExistingSubscriber) {
        const { data, error } = await supabase.functions.invoke("customer-portal", {
          body: { action: "change_plan", environment: env, newPriceId: priceId },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success("Plan zmieniony! Paddle naliczy proporcjonalną różnicę.");
        await refreshSubscription();
        onOpenChange(false);
        return;
      }

      // New subscriber → fresh checkout
      await openPaddleCheckout({
        priceId,
        customerEmail: user.email,
        customData: { userId: user.id, cycle, plan: selectedPlan },
        successUrl: `${window.location.origin}/?checkout=success`,
      });
      onOpenChange(false);
    } catch (e: any) {
      console.error("Checkout error:", e);
      toast.error("Nie udało się: " + (e?.message || "spróbuj ponownie"));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (p: typeof planConfigs[number]) => {
    if (p.id === "free") return { main: "$0", per: t("upgrade.forever") };
    if (cycle === "yearly") {
      const monthly = (p.yearlyPrice / 12).toFixed(2);
      return { main: `$${monthly}`, per: "/mies. (rocznie)" };
    }
    return { main: `$${p.monthlyPrice}`, per: t("upgrade.perMonth") };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden border-border bg-card">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto max-h-[90vh]">
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

              {/* Cycle toggle */}
              <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 p-1 self-start">
                <button
                  onClick={() => setCycle("monthly")}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-all",
                    cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Miesięcznie
                </button>
                <button
                  onClick={() => setCycle("yearly")}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5",
                    cycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Rocznie
                  <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-bold">−20%</span>
                </button>
              </div>

              {!liveEnabled && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Płatne plany wracają wkrótce.</strong> Czekamy na ostatnią weryfikację dostawcy płatności. W międzyczasie możesz nas wesprzeć kawą ☕.
                  </div>
                </div>
              )}
            </DialogHeader>
          </div>

          <div className="px-4 sm:px-6 pb-6 sm:pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {planConfigs.map((plan) => {
                const price = formatPrice(plan);
                return (
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
                      <span className="text-2xl sm:text-3xl font-bold font-display">{price.main}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground">{price.per}</span>
                      {cycle === "yearly" && plan.id !== "free" && (
                        <div className="text-[10px] text-accent mt-0.5">
                          ${plan.yearlyPrice.toFixed(2)} rozliczane raz w roku
                        </div>
                      )}
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
                );
              })}
            </div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                onClick={handleUpgrade}
                disabled={isProcessing || selectedPlan === "free"}
                className="w-full h-10 sm:h-12 groove-gradient-bg text-primary-foreground font-semibold text-sm sm:text-base rounded-xl hover:opacity-90 gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    {t("upgrade.processing")}
                  </>
                ) : selectedPlan === "free" ? (
                  t("upgrade.currentPlan")
                ) : !liveEnabled ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Wkrótce dostępne
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
                    {isExistingSubscriber
                      ? `Zmień na ${t(planConfigs.find(p => p.id === selectedPlan)?.nameKey || "")}`
                      : `${t("upgrade.upgradeTo")} ${t(planConfigs.find(p => p.id === selectedPlan)?.nameKey || "")}`}
                  </>
                )}
              </Button>
            </motion.div>

            <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3">
              {env === "sandbox" ? "🧪 Tryb testowy — użyj karty 4242 4242 4242 4242. " : ""}
              {t("upgrade.footer")}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
