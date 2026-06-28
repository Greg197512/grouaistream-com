import { MainLayout } from "@/components/layout/MainLayout";
import { ArtistMagnet } from "@/components/sections/ArtistMagnet";
import { motion } from "framer-motion";
import { Music, TrendingUp, Rocket, Mail, UserPlus, Sparkles } from "lucide-react";
import type { Easing } from "framer-motion";

const ease: Easing = [0.25, 0.1, 0.25, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease },
  }),
};

// 🧲 Strona-magnes /artysta — czysty lejek pod reklamy Google/Meta.
// Artysta zostawia maila (opt-in) → dostaje pitch GrouAI → zakłada konto.
// Legalnie, bez scrapowania, bezpiecznie dla domeny.
const ArtistLanding = () => {
  const steps = [
    { icon: Mail, title: "Zostaw maila", desc: "Bez zobowiązań. Wpisujesz adres, dostajesz pierwszy krok w sekundę." },
    { icon: UserPlus, title: "Załóż konto artysty", desc: "Dodajesz swój pierwszy utwór w kilka minut — prowadzimy Cię za rękę." },
    { icon: Rocket, title: "Rośnij na Spotify", desc: "Budujesz zasięg i zarabiasz, a my pokazujemy, co działa." },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto pb-32">
        <motion.section
          initial="hidden"
          animate="visible"
          className="text-center pt-8 space-y-4"
        >
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-primary/25 bg-primary/10 text-primary text-sm">
            <Sparkles className="h-4 w-4" /> Dla artystów
          </motion.div>
          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight"
          >
            Twoja muzyka zasługuje na{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-emerald-400 bg-clip-text text-transparent">
              słuchaczy
            </span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto"
          >
            GrouAI Stream pomaga artystom puścić muzykę w obieg, zarabiać na odsłuchaniach
            i szybciej wbić się na Spotify. Zacznij od jednego kroku.
          </motion.p>
        </motion.section>

        {/* Magnes — zapis + welcome-flow */}
        <ArtistMagnet source="artist_landing" />

        {/* Jak to działa */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-8"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-2xl font-bold text-center">
            Jak to działa — 3 kroki
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 1}
                  className="relative rounded-2xl border border-white/5 bg-secondary/30 p-6 text-center space-y-3"
                >
                  <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-xs font-bold text-primary">KROK {i + 1}</div>
                  <h3 className="font-bold text-lg">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Dlaczego GrouAI */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16"
        >
          {[
            { icon: Music, t: "Muzyka w obiegu", d: "Słuchacze, radio i playlisty — zamiast dysku." },
            { icon: TrendingUp, t: "Realne zarabianie", d: "Wypłaty za odsłuchania i napiwki." },
            { icon: Rocket, t: "Szybsze Spotify", d: "Budujesz zasięg, który Spotify nagradza." },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="flex flex-col items-center text-center gap-2 p-5 rounded-xl border border-white/5 bg-card/40"
              >
                <Icon className="h-6 w-6 text-primary" />
                <span className="font-semibold text-sm">{b.t}</span>
                <span className="text-xs text-muted-foreground">{b.d}</span>
              </motion.div>
            );
          })}
        </motion.section>

        <p className="text-center text-xs text-muted-foreground/70 mt-12">
          Zapisując się akceptujesz kontakt mailowy od GrouAI Stream. Bez spamu, wypisanie jednym kliknięciem.
        </p>
      </div>
    </MainLayout>
  );
};

export default ArtistLanding;
