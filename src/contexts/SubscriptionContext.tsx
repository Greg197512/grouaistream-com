import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { restoreSessionSafely } from "@/lib/authSession";

export type SubscriptionPlan = "free" | "pro" | "ultimate";

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  isLoading: boolean;
  isPro: boolean;
  isUltimate: boolean;
  /** Is user in free trial period */
  isTrialActive: boolean;
  trialDaysLeft: number;
  /** Check if user has at least the given plan level (includes trial) */
  hasAccess: (requiredPlan: SubscriptionPlan) => boolean;
  /** Feature-specific checks */
  canUseAIDJ: boolean;
  canUseMoodDetection: boolean;
  canGenerateAIPlaylist: boolean;
  canDownloadOffline: boolean;
  canUsePsychologist: boolean;
  canCustomizeDJ: boolean;
  canUseUnlimitedSkips: boolean;
  canUseHQAudio: boolean;
  canUseLossless: boolean;
  dailyAIPlaylistsLeft: number;
  decrementAIPlaylistCount: () => void;
  /** Upgrade prompt */
  showUpgradeFor: (feature: string) => void;
  upgradePromptFeature: string | null;
  dismissUpgradePrompt: () => void;
  /** For admin - set plan */
  refreshSubscription: () => Promise<void>;
}

const PLAN_LEVELS: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1,
  ultimate: 2,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading: authLoading } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [isLoading, setIsLoading] = useState(true);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [dailyAIPlaylistsUsed, setDailyAIPlaylistsUsed] = useState(0);
  const [upgradePromptFeature, setUpgradePromptFeature] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      if (authLoading) return;

      if (!user) {
        setPlan("free");
        setTrialEndsAt(null);
        localStorage.setItem("grooveai-current-plan", "free");
        setIsLoading(false);
        return;
      }

      // Derive env from Paddle client token to keep test-mode purchases out of live entitlement
      const clientToken = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) || "";
      const paddleEnv: "sandbox" | "live" = clientToken.startsWith("test_") ? "sandbox" : "live";
      const hasCreatorAccess = profile?.role === "artist" || profile?.role === "pro";

      const [
        { data: isAdmin, error: adminError },
        { data: paddleSub, error: paddleErr },
        { data: legacySub, error: legacyErr },
      ] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        // Source of truth: Paddle-synced subscriptions table (filtered by env)
        supabase
          .from("subscriptions")
          .select("product_id, status, current_period_end, cancel_at_period_end")
          .eq("user_id", user.id)
          .eq("environment", paddleEnv)
          // past_due is filtered out — webhook downgrades it to canceled per policy
          .in("status", ["active", "trialing"])
          // grace period: if current_period_end already passed, exclude
          .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
          .maybeSingle(),
        // Fallback: legacy mirror (admin overrides + trial)
        supabase
          .from("user_subscriptions")
          .select("plan, status, trial_ends_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      if (adminError) console.error("Error checking admin role:", adminError);
      if (paddleErr) console.error("Error fetching paddle subscription:", paddleErr);
      if (legacyErr) console.error("Error fetching legacy subscription:", legacyErr);

      // Map Paddle product → plan
      const paddlePlan: SubscriptionPlan | null = paddleSub
        ? (paddleSub.product_id === "grouai_ultimate"
            ? "ultimate"
            : paddleSub.product_id === "grouai_pro"
              ? "pro"
              : null)
        : null;

      const legacyPlan = (legacySub?.plan as SubscriptionPlan | undefined) ?? "free";

      // Pick the higher tier between paddle (env-filtered) and legacy (admin/trial)
      const baseSubscriptionPlan: SubscriptionPlan =
        paddlePlan && PLAN_LEVELS[paddlePlan] >= PLAN_LEVELS[legacyPlan]
          ? paddlePlan
          : legacyPlan;

      const resolvedPlan: SubscriptionPlan = isAdmin
        ? "ultimate"
        : hasCreatorAccess
          ? (baseSubscriptionPlan === "ultimate" ? "ultimate" : "pro")
          : baseSubscriptionPlan;

      setPlan(resolvedPlan);
      setTrialEndsAt((legacySub as any)?.trial_ends_at || null);
      localStorage.setItem("grooveai-current-plan", resolvedPlan);

      console.log("[Subscription] resolved access:", {
        userId: user.id,
        email: user.email,
        isAdmin: Boolean(isAdmin),
        paddleEnv,
        paddlePlan,
        legacyPlan,
        resolvedPlan,
      });
    } catch (err) {
      console.error("Subscription fetch error:", err);
      setPlan("free");
      setTrialEndsAt(null);
      localStorage.setItem("grooveai-current-plan", "free");
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, profile?.role, profile?.subscriptionStatus, user, user?.email, user?.id]);

  useEffect(() => {
    void restoreSessionSafely().then(() => {
      void fetchSubscription();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void fetchSubscription();
    });

    return () => subscription.unsubscribe();
  }, [fetchSubscription]);

  useEffect(() => {
    const stored = localStorage.getItem("grooveai-ai-playlists-date");
    const today = new Date().toDateString();
    if (stored !== today) {
      setDailyAIPlaylistsUsed(0);
      localStorage.setItem("grooveai-ai-playlists-date", today);
      localStorage.setItem("grooveai-ai-playlists-count", "0");
    } else {
      const count = parseInt(localStorage.getItem("grooveai-ai-playlists-count") || "0");
      setDailyAIPlaylistsUsed(count);
    }
  }, []);

  const isTrialActive = Boolean(
    plan === "free" && trialEndsAt && new Date(trialEndsAt) > new Date()
  );
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const hasAccess = useCallback((requiredPlan: SubscriptionPlan) => {
    if (PLAN_LEVELS[plan] >= PLAN_LEVELS[requiredPlan]) return true;
    if (requiredPlan === "pro" && isTrialActive) return true;
    return false;
  }, [plan, isTrialActive]);

  const isPro = plan === "pro" || plan === "ultimate" || isTrialActive;
  const isUltimate = plan === "ultimate";

  const canUseAIDJ = isPro;
  const canUseMoodDetection = isPro;
  const canGenerateAIPlaylist = isPro;
  const canDownloadOffline = isPro;
  const canUsePsychologist = isUltimate;
  const canCustomizeDJ = isUltimate;
  const canUseUnlimitedSkips = isPro;
  const canUseHQAudio = isPro;
  const canUseLossless = isUltimate;

  const maxDailyPlaylists = isUltimate ? Infinity : (isPro ? 5 : 0);
  const dailyAIPlaylistsLeft = Math.max(0, maxDailyPlaylists - dailyAIPlaylistsUsed);

  const decrementAIPlaylistCount = useCallback(() => {
    setDailyAIPlaylistsUsed(prev => {
      const next = prev + 1;
      localStorage.setItem("grooveai-ai-playlists-count", String(next));
      return next;
    });
  }, []);

  const showUpgradeFor = useCallback((feature: string) => {
    setUpgradePromptFeature(feature);
  }, []);

  const dismissUpgradePrompt = useCallback(() => {
    setUpgradePromptFeature(null);
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        plan,
        isLoading,
        isPro,
        isUltimate,
        isTrialActive,
        trialDaysLeft,
        hasAccess,
        canUseAIDJ,
        canUseMoodDetection,
        canGenerateAIPlaylist,
        canDownloadOffline,
        canUsePsychologist,
        canCustomizeDJ,
        canUseUnlimitedSkips,
        canUseHQAudio,
        canUseLossless,
        dailyAIPlaylistsLeft,
        decrementAIPlaylistCount,
        showUpgradeFor,
        upgradePromptFeature,
        dismissUpgradePrompt,
        refreshSubscription: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
