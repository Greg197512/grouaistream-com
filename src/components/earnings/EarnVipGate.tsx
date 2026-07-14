import { motion } from "framer-motion";
import { Crown, Check } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

/**
 * Bramka VIP dla ZARABIANIA. Po zakończeniu promocji na całej stronie
 * (tworzenie muzyki zostaje darmowe) zarabianie wymaga płatnego planu.
 * Renderowana zamiast pulpitu zarobków, gdy użytkownik nie ma VIP.
 */
export const EarnVipGate = () => {
  const { showUpgradeFor } = useSubscription();
  const perks = [
    "Wypłaty środków na konto",
    "Monetyzacja utworów i streamów",
    "Bonusy, napiwki i wyzwania",
    "Program poleceń (referral)",
  ];

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_40px_rgba(255,149,0,0.4)]">
          <Crown className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-foreground">Zarabianie jest teraz dla VIP</h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Dziękujemy, że jesteś z nami 💛 <b>Czas promocyjny na stronie się zakończył.</b> Tworzenie
          muzyki w GrouAI Studio zostaje darmowe, ale żeby <b>zarabiać przez naszą stronę</b> — wypłacać
          środki, monetyzować utwory i odbierać bonusy — trzeba <b>najpierw dołączyć do VIP</b>.
        </p>

        <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm">
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 shrink-0 text-amber-400" />
              {p}
            </li>
          ))}
        </ul>

        <button
          onClick={() => showUpgradeFor?.("Zarabianie na GrouAI Stream (VIP)")}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.03]"
        >
          <Crown className="h-4 w-4" /> Zostań VIP i zacznij zarabiać
        </button>

        <p className="mt-3 text-xs text-muted-foreground/70">
          Chcesz tylko tworzyć muzykę? To dalej za darmo — VIP dotyczy wyłącznie zarabiania.
        </p>
      </motion.div>
    </div>
  );
};
