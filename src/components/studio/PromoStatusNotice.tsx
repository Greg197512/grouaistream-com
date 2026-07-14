import { motion } from "framer-motion";
import { Gift, Clock, Sparkles, Crown } from "lucide-react";
import { getStudioPromoStatus, useSubscription } from "@/contexts/SubscriptionContext";

/**
 * Inteligentny, delikatny komunikat o promocji. Sterowany DATĄ — sam się
 * przełącza: „ostatnie dni" → po terminie „czas promocyjny minął, teraz VIP".
 * VIP (Ultimate) nie widzi nic. Zero nachalności.
 */
export const PromoStatusNotice = () => {
  const { isUltimate, showUpgradeFor } = useSubscription();
  if (isUltimate) return null; // płacący VIP nie potrzebuje zachęty

  const { state, daysLeft, endDate } = getStudioPromoStatus();
  const dateStr = endDate.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });

  const cfg =
    state === "ended"
      ? {
          Icon: Gift,
          title: "Czas promocyjny się zakończył",
          body: "Dziękujemy, że tworzyłeś z nami przez darmowy tydzień 💛 Pełne Studio i zarabianie są teraz częścią pakietu VIP.",
          cta: "Zostań VIP",
          accent: "#FF9500",
        }
      : state === "soon"
      ? {
          Icon: Clock,
          title: `Ostatnie dni promocji — zostało ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"}`,
          body: `Darmowy tydzień GrouAI kończy się ${dateStr}. Później pełny dostęp i zarabianie w pakiecie VIP.`,
          cta: "Zobacz VIP",
          accent: "#9333EA",
        }
      : {
          Icon: Sparkles,
          title: "Trwa darmowy tydzień GrouAI ✨",
          body: `Do ${dateStr} tworzysz bez opłat. Później pełne Studio i zarabianie wejdą do pakietu VIP.`,
          cta: "Poznaj VIP",
          accent: "#9333EA",
        };

  const { Icon } = cfg;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `${cfg.accent}33`,
        background: `linear-gradient(135deg, ${cfg.accent}12, transparent 70%)`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${cfg.accent}22`, color: cfg.accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{cfg.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{cfg.body}</p>
          <button
            onClick={() => showUpgradeFor?.("Zarabianie i pełne Studio (VIP)")}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
            style={{ background: `linear-gradient(135deg, ${cfg.accent}, #FF6B00)` }}
          >
            <Crown className="h-3.5 w-3.5" />
            {cfg.cta}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
