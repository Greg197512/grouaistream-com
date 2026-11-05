// „Wsparcie” — jednorazowa „kawa” dla GrouAI Stream przez Paddle (także dla gości). Teksty w 4 językach.
import { Coffee, Star, Loader2, Radio, Server, Wrench } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { openPaddleCheckout } from "@/lib/paddle";
import { asHomeLang } from "@/lib/homeI18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COFFEES = [
  { id: "grouai_coffee_black", price: 1, emoji: "☕", color: "from-amber-900/30 to-stone-800/30", border: "border-amber-700/40", text: "text-amber-300" },
  { id: "grouai_coffee_latte", price: 3, emoji: "☕🥛", color: "from-orange-500/20 to-amber-400/20", border: "border-orange-400/40", text: "text-orange-300" },
  { id: "grouai_coffee_irish", price: 5, emoji: "☕🥃", color: "from-rose-500/20 to-amber-600/20", border: "border-rose-500/40", text: "text-rose-300" },
] as const;

const TXT = {
  pl: {
    badge: "Wsparcie", title: "Postaw nam kawę ☕",
    lead: "GrouAI Stream to niezależna platforma. Twoja kawa pokrywa realne koszty: serwery i pliki muzyki, radio grające 24/7 oraz darmowe narzędzia dla twórców.",
    uses: ["Serwery i muzyka", "Radio 24/7", "Narzędzia dla twórców"],
    names: ["Czarna kawa", "Latte", "Kawa irlandzka"], descs: ["Mały gest, wielka moc", "Aksamitne wsparcie", "Z nutą whisky 🔥"],
    note: "Płatność jednorazowa · bez subskrypcji · konto nie jest wymagane · bezpieczna płatność przez Paddle",
    cta: "Wybierz", err: "Nie udało się otworzyć płatności", errPrice: "Ta kwota nie jest jeszcze dostępna — spróbuj innej", errToken: "Płatności są chwilowo niedostępne",
  },
  en: {
    badge: "Support", title: "Buy us a coffee ☕",
    lead: "GrouAI Stream is an independent platform. Your coffee covers real costs: servers and music files, radio playing 24/7 and free tools for artists.",
    uses: ["Servers & music", "24/7 radio", "Tools for artists"],
    names: ["Black coffee", "Latte", "Irish coffee"], descs: ["A small gesture, big power", "Smooth support", "With a hint of whiskey 🔥"],
    note: "One-time payment · no subscription · no account needed · secure payment via Paddle",
    cta: "Choose", err: "Couldn't open the payment", errPrice: "This amount isn't available yet — try another", errToken: "Payments are temporarily unavailable",
  },
  nl: {
    badge: "Steun", title: "Trakteer ons op koffie ☕",
    lead: "GrouAI Stream is een onafhankelijk platform. Jouw koffie dekt echte kosten: servers en muziekbestanden, radio die 24/7 speelt en gratis tools voor artiesten.",
    uses: ["Servers & muziek", "Radio 24/7", "Tools voor artiesten"],
    names: ["Zwarte koffie", "Latte", "Irish coffee"], descs: ["Klein gebaar, grote kracht", "Zachte steun", "Met een vleugje whisky 🔥"],
    note: "Eenmalige betaling · geen abonnement · geen account nodig · veilig betalen via Paddle",
    cta: "Kies", err: "Betaling kon niet worden geopend", errPrice: "Dit bedrag is nog niet beschikbaar — probeer een ander", errToken: "Betalingen zijn tijdelijk niet beschikbaar",
  },
  ua: {
    badge: "Підтримка", title: "Пригости нас кавою ☕",
    lead: "GrouAI Stream — незалежна платформа. Твоя кава покриває реальні витрати: сервери й музичні файли, радіо 24/7 та безкоштовні інструменти для артистів.",
    uses: ["Сервери й музика", "Радіо 24/7", "Інструменти для артистів"],
    names: ["Чорна кава", "Лате", "Ірландська кава"], descs: ["Малий жест, велика сила", "Оксамитова підтримка", "З ноткою віскі 🔥"],
    note: "Разовий платіж · без підписки · акаунт не потрібен · безпечна оплата через Paddle",
    cta: "Обрати", err: "Не вдалося відкрити оплату", errPrice: "Ця сума ще недоступна — спробуй іншу", errToken: "Оплата тимчасово недоступна",
  },
} as const;

export const SupportSection = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = TXT[asHomeLang(language)];
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (priceId: string) => {
    // Działa też dla gości — Paddle zbierze e-mail; zalogowanym wiążemy wpłatę z kontem.
    setLoading(priceId);
    try {
      await openPaddleCheckout({
        priceId,
        ...(user?.email ? { customerEmail: user.email } : {}),
        customData: user ? { userId: user.id, kind: "coffee" } : { kind: "coffee", guest: "1" },
        successUrl: `${window.location.origin}/?coffee=success`,
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast.error(`${t.err}: ${/resolve price|not found/i.test(msg) ? t.errPrice : /token/i.test(msg) ? t.errToken : msg || "—"}`);
    } finally {
      setLoading(null);
    }
  };

  const USE_ICONS = [Server, Radio, Wrench];

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Star className="h-3.5 w-3.5" />
          {t.badge}
        </div>

        <h2 className="mb-2 text-2xl font-bold md:text-3xl">{t.title}</h2>
        <p className="mx-auto mb-4 max-w-lg text-sm text-muted-foreground">{t.lead}</p>

        <ul className="mb-8 flex flex-wrap justify-center gap-2" aria-label={t.badge}>
          {t.uses.map((u, i) => {
            const Icon = USE_ICONS[i];
            return (
              <li key={u} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {u}
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COFFEES.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleBuy(c.id)}
              disabled={loading !== null}
              aria-label={`${t.names[i]} — ${c.price} $`}
              className={cn(
                "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 text-left shadow-lg transition hover:-translate-y-1 disabled:opacity-50",
                c.border, c.color,
              )}
            >
              <div className="mb-3 text-4xl" aria-hidden="true">{c.emoji}</div>
              <div className={cn("mb-1 text-lg font-bold", c.text)}>{t.names[i]}</div>
              <div className="mb-4 text-xs text-muted-foreground">{t.descs[i]}</div>
              <div className="flex items-center justify-between">
                <span className={cn("text-2xl font-extrabold", c.text)}>{c.price} $</span>
                {loading === c.id ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
                  <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", c.text)}>
                    {t.cta} <Coffee className="h-4 w-4" />
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground/70">{t.note}</p>
      </div>
    </section>
  );
};
