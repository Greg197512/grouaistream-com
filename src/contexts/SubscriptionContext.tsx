import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { restoreSessionSafely } from "@/lib/authSession";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionPlan = "free" | "pro" | "ultimate";

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  isLoading: boolean;
  isPro: boolean;
  isUltimate: boolean;
  /** Nadany ręcznie przez admina (Admin → Użytkownicy), niezależnie od planu Paddle */
  isVip: boolean;
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

// PROMOCJA: cały GrouAI Studio (poziom Pro) za darmo dla WSZYSTKICH do tej daty.
// Po tej dacie promocja wygasa sama. Serwer (hub) ma bliźniaczy warunek: hub_config.studio_free_until.
export const STUDIO_FREE_UNTIL = new Date("2026-08-10T23:59:59Z");
export const isStudioPromoActive = () => Date.now() < STUDIO_FREE_UNTIL.getTime();

// Inteligentny status promocji — sterowany DATĄ (sam się przełącza):
//  active  → jeszcze sporo czasu
//  soon    → kończy się w ciągu 3 dni (delikatny nudge)
//  ended   → czas promocyjny minął (teraz VIP)
export type PromoState = "active" | "soon" | "ended";
export function getStudioPromoStatus(): { state: PromoState; daysLeft: number; endDate: Date } {
  const dayMs = 86_400_000;
  const msLeft = STUDIO_FREE_UNTIL.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / dayMs));
  const state: PromoState = msLeft <= 0 ? "ended" : msLeft <= 3 * dayMs ? "soon" : "active";
  return { state, daysLeft, endDate: STUDIO_FREE_UNTIL };
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);
const roleDb = supabase as unknown as SupabaseClient;

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [isLoading, setIsLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [dailyAIPlaylistsUsed, setDailyAIPlaylistsUsed] = useState(0);
  const [upgradePromptFeature, setUpgradePromptFeature] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      if (authLoading) return;

      if (!user) {
        setPlan("free");
        setIsVip(false);
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
        { data: vipRole, error: vipError },
        { data: paddleSub, error: paddleErr },
        { data: legacySub, error: legacyErr },
      ] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        // VIP: nadawany ręcznie przez admina (Admin → Użytkownicy), niezależny od planu Paddle.
        roleDb.rpc("has_role", { _user_id: user.id, _role: "vip" }),
        // Source of truth: Paddle-synced subscriptions table (filtered by env).
        // Multiple rows per (user, env) are allowed (re-subscribe, plan change) — pick the newest
        // one that still confers access. Access rules:
        //   active / trialing / past_due  → allowed while current_period_end is null or future
        //   canceled                      → allowed until current_period_end (grace period)
        supabase
          .from("subscriptions")
          .select("product_id, status, current_period_end, cancel_at_period_end")
          .eq("user_id", user.id)
          .eq("environment", paddleEnv)
          .in("status", ["active", "trialing", "past_due", "canceled"])
          .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
          .order("created_at", { ascending: false })
          .limit(1)
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
      if (vipError) console.error("Error checking vip role:", vipError);
      if (paddleErr) console.error("Error fetching paddle subscription:", paddleErr);
      if (legacyErr) console.error("Error fetching legacy subscription:", legacyErr);
      setIsVip(Boolean(isAdmin) || Boolean(vipRole));

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

  // Natychmiastowa aktualizacja planu: zmiany w bazie (zakup / anulowanie / zmiana
  // przez admina) trafiają do klienta bez przeładowania strony.
  useEffect(() => {
    if (!user) return;

    const refreshAll = () => {
      void fetchSubscription();
      void refreshProfile();
    };

    const channel = supabase
      .channel(`sub-updates-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "user_subscriptions", filter: `user_id=eq.${user.id}`,
      }, refreshAll)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}`,
      }, refreshAll)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}`,
      }, refreshAll)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}`,
      }, refreshAll)
      .subscribe();

    // Fallback gdy realtime nie obejmuje tych tabel: odśwież po powrocie do karty
    // (np. po zamknięciu okna płatności Paddle) i co 30s w tle.
    const onFocus = () => refreshAll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshAll();
    }, 30_000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(interval);
    };
  }, [user, fetchSubscription, refreshProfile]);

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
    if (requiredPlan === "pro" && (isTrialActive || isStudioPromoActive())) return true;
    return false;
  }, [plan, isTrialActive]);

  const isPro = plan === "pro" || plan === "ultimate" || isTrialActive || isStudioPromoActive();
  const isUltimate = plan === "ultimate";

  const canUseAIDJ = isPro;
  const canUseMoodDetection = isPro;
  const canGenerateAIPlaylist = isPro;
  const canDownloadOffline = isPro;
  // AI Psycholog dostępny w Pro i VIP (Ultimate) — realne analizy po kilku skanach.
  const canUsePsychologist = isPro;
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
        isVip,
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
