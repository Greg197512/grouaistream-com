import { motion } from "framer-motion";
import { Coffee, Star, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { openPaddleCheckout } from "@/lib/paddle";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COFFEES = [
  {
    id: "grouai_coffee_black",
    name: "Czarna kawa",
    price: 1,
    emoji: "☕",
    desc: "Mały gest, wielka moc",
    color: "from-amber-900/30 to-stone-800/30",
    border: "border-amber-700/40",
    text: "text-amber-300",
  },
  {
    id: "grouai_coffee_latte",
    name: "Latte",
    price: 3,
    emoji: "☕🥛",
    desc: "Aksamitne wsparcie",
    color: "from-orange-500/20 to-amber-400/20",
    border: "border-orange-400/40",
    text: "text-orange-300",
  },
  {
    id: "grouai_coffee_irish",
    name: "Kawa irlandzka",
    price: 5,
    emoji: "☕🥃",
    desc: "Z nutą whisky 🔥",
    color: "from-rose-500/20 to-amber-600/20",
    border: "border-rose-500/40",
    text: "text-rose-300",
  },
];

export const SupportSection = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (priceId: string) => {
    if (!user) {
      toast.error("Zaloguj się, aby postawić kawę");
      return;
    }
    setLoading(priceId);
    try {
      await openPaddleCheckout({
        priceId,
        customerEmail: user.email,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/?coffee=success`,
      });
    } catch (e: any) {
      toast.error("Nie udało się otworzyć płatności: " + (e?.message || "spróbuj ponownie"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
          <Star className="h-3.5 w-3.5" />
          Wsparcie
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          Postaw nam kawę ☕
        </h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-lg mx-auto">
          Budujemy GrouAI Stream sercem i kodem o 4 nad ranem. Twoja kawa pomaga nam zostać czujnym i tworzyć dalej.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COFFEES.map((c) => (
            <motion.button
              key={c.id}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleBuy(c.id)}
              disabled={loading !== null}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-6 text-left transition-all bg-gradient-to-br shadow-lg disabled:opacity-50",
                c.border,
                c.color
              )}
            >
              <div className="text-4xl mb-3">{c.emoji}</div>
              <div className={cn("font-bold text-lg mb-1", c.text)}>{c.name}</div>
              <div className="text-xs text-muted-foreground mb-4">{c.desc}</div>
              <div className="flex items-center justify-between">
                <span className={cn("text-2xl font-extrabold", c.text)}>{c.price}€</span>
                {loading === c.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Coffee className={cn("h-5 w-5", c.text)} />
                )}
              </div>
            </motion.button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground/60 mt-6">
          Płatność jednorazowa · bez subskrypcji · obsługiwana przez Paddle
        </p>
      </motion.div>
    </section>
  );
};
