import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSubscription } from "@/contexts/SubscriptionContext";

/**
 * Mounted once at app root. Listens for ?checkout=success and ?coffee=success
 * after a Paddle checkout, refreshes entitlement, toasts, and cleans the URL.
 */
export function CheckoutSuccessHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshSubscription } = useSubscription();
  const handled = useRef(false);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const coffee = searchParams.get("coffee");

    if (handled.current) return;
    if (checkout !== "success" && coffee !== "success") return;
    handled.current = true;

    if (checkout === "success") {
      toast.success("Płatność przyjęta! ⚡ Otwieram Twój dashboard...", {
        duration: 8000,
        action: {
          label: "Otwórz dashboard",
          onClick: () => { window.location.href = "/client-dashboard"; },
        },
      });
      // Auto-redirect to dashboard after 2.5s
      window.setTimeout(() => { window.location.href = "/client-dashboard"; }, 2500);
      // Webhook lands within a few seconds — give it time, then refresh
      const timers = [1500, 4000, 8000].map((ms) =>
        window.setTimeout(() => { void refreshSubscription(); }, ms)
      );
      // Cleanup any leftover timers if user navigates away
      // (return from outer useEffect handles this)
      const cleanup = () => timers.forEach(clearTimeout);

      // Clean URL
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      setSearchParams(next, { replace: true });
      return cleanup;
    }

    if (coffee === "success") {
      toast.success("Dzięki za kawę! ☕ 90% trafia do twórcy.", { duration: 6000 });
      const next = new URLSearchParams(searchParams);
      next.delete("coffee");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshSubscription]);

  return null;
}
