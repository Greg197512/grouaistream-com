import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { ShieldCheck, Users, Music2, BadgeCheck, Bot, HandCoins, X, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Licznik Uczciwości — wyróżnik marki GrouAI Stream.
 * Pokazuje na żywo realne liczby platformy (utwory, artyści) i zestawia
 * uczciwy model (weryfikowane odsłuchania, wysoki % dla twórcy, zero botów)
 * z korporacyjnym streamingiem. Dane utworów/artystów lecą z bazy na żywo;
 * przy braku sieci pokazujemy sensowne wartości zapasowe (nie zeruje sekcji).
 */

/** Animowany licznik liczbowy — odlicza od 0 do wartości, gdy wejdzie w kadr. */
const CountUp = ({ value, suffix = "", duration = 1.6 }: { value: number; suffix?: string; duration?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString("pl-PL"));
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [rounded]);

  useEffect(() => {
    if (inView) {
      const controls = animate(count, value, { duration, ease: "easeOut" });
      return () => controls.stop();
    }
  }, [inView, value, count, duration]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
};

interface Stats {
  tracks: number;
  artists: number;
}

export const FairnessCounter = () => {
  // Wartości zapasowe = realny stan na 2026-07 (gdyby zapytanie nie doszło).
  const [stats, setStats] = useState<Stats>({ tracks: 330, artists: 32 });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { count } = await supabase
          .from("tracks")
          .select("id", { count: "exact", head: true })
          .not("audio_url", "is", null);

        const { data: artistRows } = await supabase
          .from("tracks")
          .select("artist")
          .not("audio_url", "is", null)
          .limit(2000);

        if (!active) return;
        const artists = new Set((artistRows || []).map((r: any) => r.artist).filter(Boolean)).size;
        setStats({
          tracks: count ?? 330,
          artists: artists || 32,
        });
      } catch {
        /* zostają wartości zapasowe */
      }
    })();
    return () => { active = false; };
  }, []);

  const counters = [
    { icon: Music2, value: stats.tracks, suffix: "+", label: "utworów w bibliotece", color: "text-primary" },
    { icon: Users, value: stats.artists, suffix: "+", label: "artystów zarabia z nami", color: "text-emerald-400" },
    { icon: HandCoins, value: 65, suffix: "%", label: "min. przychodu dla twórcy", color: "text-amber-400" },
    { icon: Bot, value: 0, suffix: "", label: "botów i fałszywych odsłuchań", color: "text-rose-400" },
  ];

  const compare = [
    { feature: "Zweryfikowane, ludzkie odsłuchania", groua: true, others: false },
    { feature: "Twórca dostaje 65–90% przychodu", groua: true, others: false },
    { feature: "Wypłata bezpośrednio na konto (od 50 $)", groua: true, others: false },
    { feature: "Zero botów i sztucznego nabijania", groua: true, others: false },
    { feature: "Przejrzysty, uczciwy model AI", groua: true, others: false },
  ];

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            Uczciwy streaming
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Uczciwość w liczbach
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Nie jesteśmy kolejnym streamingiem, gdzie boty nabijają odsłuchania, a artysta dostaje grosze.
            Tu każde odsłuchanie jest prawdziwe, a twórca zarabia realne pieniądze.
          </p>
        </motion.div>

        {/* Liczniki na żywo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {counters.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center hover:bg-white/[0.06] transition-colors"
              >
                <Icon className={cn("h-6 w-6 mx-auto mb-3", c.color)} />
                <div className={cn("text-3xl md:text-4xl font-extrabold tracking-tight", c.color)}>
                  <CountUp value={c.value} suffix={c.suffix} />
                </div>
                <div className="text-[11px] md:text-xs text-muted-foreground mt-2 leading-tight">{c.label}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Porównanie z korporacyjnym streamingiem */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/10 overflow-hidden"
        >
          <div className="grid grid-cols-[1fr_auto_auto] items-stretch text-sm">
            {/* Nagłówek */}
            <div className="p-4 font-semibold bg-white/[0.03]">Co nas wyróżnia</div>
            <div className="p-4 font-bold text-center bg-emerald-500/10 text-emerald-400 flex items-center justify-center gap-1.5 min-w-[92px]">
              <BadgeCheck className="h-4 w-4" /> GrouAI
            </div>
            <div className="p-4 font-medium text-center bg-white/[0.02] text-muted-foreground min-w-[92px]">
              Inne
            </div>

            {compare.map((row, i) => (
              <div key={i} className="contents">
                <div className={cn("p-4 border-t border-white/5", i % 2 ? "bg-transparent" : "bg-white/[0.015]")}>
                  {row.feature}
                </div>
                <div className={cn("p-4 border-t border-white/5 flex items-center justify-center bg-emerald-500/[0.06]")}>
                  <Check className="h-5 w-5 text-emerald-400" />
                </div>
                <div className={cn("p-4 border-t border-white/5 flex items-center justify-center")}>
                  {row.others ? (
                    <Check className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <X className="h-5 w-5 text-rose-400/70" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="text-[11px] text-muted-foreground/60 text-center mt-6">
          Liczby utworów i artystów aktualizują się na żywo. Model wypłat: 65% ze streamów, 90% z napiwków, 70% z pakietów Boost.
        </p>
      </div>
    </section>
  );
};
