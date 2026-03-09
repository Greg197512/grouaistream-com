import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlan = "free" | "pro" | "ultimate";

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  isLoading: boolean;
  isPro: boolean;
  isUltimate: boolean;
  /** Check if user has at least the given plan level */
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
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [isLoading, setIsLoading] = useState(true);
  const [dailyAIPlaylistsUsed, setDailyAIPlaylistsUsed] = useState(0);
  const [upgradePromptFeature, setUpgradePromptFeature] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setPlan("free");
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("plan, status")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (error) {
        console.error("Error fetching subscription:", error);
        setPlan("free");
        localStorage.setItem("grooveai-current-plan", "free");
      } else if (data) {
        setPlan(data.plan as SubscriptionPlan);
        localStorage.setItem("grooveai-current-plan", data.plan as string);
      } else {
        // No subscription row yet — create free one
        await supabase.from("user_subscriptions").insert({
          user_id: session.user.id,
          plan: "free",
          status: "active",
        });
        setPlan("free");
        localStorage.setItem("grooveai-current-plan", "free");
      }
    } catch (err) {
      console.error("Subscription fetch error:", err);
      setPlan("free");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription();
    });

    return () => subscription.unsubscribe();
  }, [fetchSubscription]);

  // Reset daily AI playlist count at midnight
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

  const hasAccess = useCallback((requiredPlan: SubscriptionPlan) => {
    return PLAN_LEVELS[plan] >= PLAN_LEVELS[requiredPlan];
  }, [plan]);

  const isPro = plan === "pro" || plan === "ultimate";
  const isUltimate = plan === "ultimate";

  // Feature access
  const canUseAIDJ = isPro;
  const canUseMoodDetection = isPro;
  const canGenerateAIPlaylist = isPro;
  const canDownloadOffline = isPro;
  const canUsePsychologist = isUltimate;
  const canCustomizeDJ = isUltimate;
  const canUseUnlimitedSkips = isPro;
  const canUseHQAudio = isPro;
  const canUseLossless = isUltimate;

  // Pro gets 5/day, Ultimate gets unlimited
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
