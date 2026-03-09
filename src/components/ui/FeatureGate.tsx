import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Crown } from "lucide-react";
import { useSubscription, SubscriptionPlan } from "@/contexts/SubscriptionContext";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { useLanguage } from "@/contexts/LanguageContext";

interface FeatureGateProps {
  /** Minimum plan required */
  requiredPlan: SubscriptionPlan;
  /** Feature name for display */
  featureName?: string;
  /** Children to render if access granted */
  children: ReactNode;
  /** Render a locked overlay instead of hiding content */
  mode?: "overlay" | "hide" | "disable";
  /** Custom fallback */
  fallback?: ReactNode;
}

export const FeatureGate = ({
  requiredPlan,
  featureName,
  children,
  mode = "overlay",
  fallback,
}: FeatureGateProps) => {
  const { hasAccess } = useSubscription();
  const { t } = useLanguage();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (hasAccess(requiredPlan)) {
    return <>{children}</>;
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

  // overlay mode
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
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg">
              {featureName || "Premium Feature"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {requiredPlan === "ultimate"
                ? t("upgrade.ultimate.name")
                : t("upgrade.pro.name")}{" "}
              — {t("upgrade.subtitle")}
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full groove-gradient-bg text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
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
