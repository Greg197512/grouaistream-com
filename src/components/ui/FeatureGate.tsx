import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Crown, Clock } from "lucide-react";
import { useSubscription, SubscriptionPlan } from "@/contexts/SubscriptionContext";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { useLanguage } from "@/contexts/LanguageContext";

interface FeatureGateProps {
  requiredPlan: SubscriptionPlan;
  featureName?: string;
  children: ReactNode;
  mode?: "overlay" | "hide" | "disable";
  fallback?: ReactNode;
}

export const FeatureGate = ({
  requiredPlan,
  featureName,
  children,
  mode = "overlay",
  fallback,
}: FeatureGateProps) => {
  const { hasAccess, isTrialActive, trialDaysLeft } = useSubscription();
  const { t } = useLanguage();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (hasAccess(requiredPlan)) {
    return (
      <>
        {isTrialActive && requiredPlan === "pro" && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary">
            <Clock className="h-3.5 w-3.5" />
            <span>Okres próbny — {trialDaysLeft} {trialDaysLeft === 1 ? "dzień" : "dni"} pozostało</span>
          </div>
        )}
        {children}
      </>
    );
  }

  if (mode === "hide") {
    return fallback ? <>{fallback}</> : null;
  }

  if (mode === "disable") {
    return (
      <>
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
        <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none blur-[2px]">
          {children}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl"
        >
          <div className="flex flex-col items-center gap-3 p-4 sm:p-6 text-center">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-base sm:text-lg">
              {featureName || "Premium Feature"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xs">
              {requiredPlan === "ultimate"
                ? t("upgrade.ultimate.name")
                : t("upgrade.pro.name")}{" "}
              — {t("upgrade.subtitle")}
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="mt-2 flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full groove-gradient-bg text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 transition-opacity"
            >
              <Crown className="h-4 w-4" />
              {t("upgrade.upgradeTo")} {requiredPlan === "ultimate" ? t("upgrade.ultimate.name") : t("upgrade.pro.name")}
            </button>
          </div>
        </motion.div>
      </div>
      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </>
  );
};
