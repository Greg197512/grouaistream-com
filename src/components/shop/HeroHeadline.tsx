// Czołówka sklepu: „Noś swój …” — ostatnie słowo zmienia się co kilka sekund (dźwięk → bas → rytm → beat → vibe).
// Litery wjeżdżają jak słupki korektora, wypełnia je płynna tekstura z Canvy (chrom + neon), która stale płynie.
// Ogranicz ruch / słaby sprzęt = pierwsze słowo, bez ruchu.
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type L = "pl" | "en" | "nl";
const WORDS: Record<L, string[]> = {
  pl: ["dźwięk.", "bas.", "rytm.", "beat.", "vibe."],
  en: ["sound.", "bass.", "beat.", "rhythm.", "vibe."],
  nl: ["sound.", "bas.", "beat.", "ritme.", "vibe."],
};
const TEXTURE = "/shop/hero-liquid.jpg";

const CSS = `
@keyframes hh-flow{0%{background-position:0% 50%}50%{background-position:100% 40%}100%{background-position:0% 50%}}
.hh-l{display:inline-block;color:transparent;-webkit-background-clip:text;background-clip:text;
  background-image:url(${TEXTURE}),linear-gradient(100deg,#ff7a1a,#ff2bd6,#22d3ee,#ff7a1a);
  background-size:340% 150%;animation:hh-flow 9s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.hh-l{animation:none}}
html[data-lowpower="on"] .hh-l{animation:none}
`;


export function HeroHeadline({ lang, lead, accent }: { lang: L; lead: string; accent: string }) {
  const words = WORDS[lang] ?? WORDS.en;
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [lang]);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => { if (!document.hidden) setI((v) => (v + 1) % words.length); }, 2800);
    return () => window.clearInterval(id);
  }, [reduce, words.length]);
  const word = words[i];
  return (
    <>
      <style>{CSS}</style>
      <h1 aria-label={`${lead} ${accent}`} className="text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
        <span aria-hidden="true" className="block">{lead}</span>
        <span aria-hidden="true" className="relative block h-[1.08em] overflow-hidden pb-[0.06em]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={word} className="inline-flex whitespace-nowrap" initial="in" animate="on" exit="out">
              {Array.from(word).map((ch, k) => (
                <motion.span key={k} className="hh-l" style={{ animationDelay: `-${k * 0.8}s`, transformOrigin: "50% 100%" }}
                  variants={{
                    in: { y: "105%", scaleY: 0.25, opacity: 0 },
                    on: { y: "0%", scaleY: [0.25, 1.18, 1], opacity: 1, transition: { delay: k * 0.045, duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                    out: { y: "-80%", scaleY: 0.6, opacity: 0, transition: { delay: k * 0.025, duration: 0.25, ease: "easeIn" } },
                  }}>
                  {ch}
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        </span>
      </h1>
    </>
  );
}
