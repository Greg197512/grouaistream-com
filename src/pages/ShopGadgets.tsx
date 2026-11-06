// GrouaDrop → karta „Gadżety”: karuzela przewijana w lewo/prawo. Po kliknięciu karta rośnie, powoli obraca się
// wokół osi Y (przód: zdjęcie, tył: znak GROUAROCK), zatrzymuje i zaczyna delikatnie świecić neonem; obok wysuwa się
// szklany panel z opisem, cechami i przyciskiem zamówienia. „Ogranicz ruch” = bez obrotu i pulsowania.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { SHOP_PRODUCTS, productImg, type ShopProduct } from "@/data/shopCatalog";
import { localizeProduct } from "@/data/shopCatalogI18n";
import { useShopCart } from "@/lib/shopCart";
import { LOCALE, SHOP_LANGS, SHOP_TEXT, shopLang } from "@/i18n/shop";

const TXT = {
  pl: { title: "Gadżety", lead: "Nowości, które każdy chce mieć — przewiń, kliknij i obejrzyj z bliska.", feat: "Co potrafi", full: "Pełna karta produktu", tap: "Kliknij kartę", back: "Sklep" },
  en: { title: "Gadgets", lead: "New gear everyone wants — scroll, tap and take a closer look.", feat: "What it does", full: "Full product page", tap: "Tap a card", back: "Shop" },
  nl: { title: "Gadgets", lead: "Nieuwe gadgets die iedereen wil — scroll, tik en bekijk ze van dichtbij.", feat: "Wat hij kan", full: "Volledige productpagina", tap: "Tik op een kaart", back: "Winkel" },
};
// Kolor neonu każdej karty (pasuje do zdjęcia produktu).
const GLOW: Record<string, string> = { sluchawkianc: "#ff7a1a", flipsound: "#22d3ee", galaxy: "#c026d3", gamepad: "#ff2bd6", midi25: "#fb923c", clearbuds: "#38bdf8", pixelbox: "#f59e0b" };
const glowOf = (id: string) => GLOW[id] ?? "#ff7a1a";

const CSS = `
@keyframes gg-neon{0%,100%{box-shadow:0 0 0 1px var(--g),0 0 18px 2px color-mix(in srgb,var(--g) 55%,transparent),0 0 60px 8px color-mix(in srgb,var(--g) 25%,transparent)}
50%{box-shadow:0 0 0 2px var(--g),0 0 30px 6px color-mix(in srgb,var(--g) 75%,transparent),0 0 110px 22px color-mix(in srgb,var(--g) 38%,transparent)}}
.gg-neon{animation:gg-neon 2.6s ease-in-out infinite}
.gg-rail{scrollbar-width:none}.gg-rail::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion:reduce){.gg-neon{animation:none;box-shadow:0 0 0 2px var(--g),0 0 40px 6px color-mix(in srgb,var(--g) 40%,transparent)}}
`;

function CardFace({ p, big }: { p: ShopProduct; big?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[22px] bg-neutral-900 [backface-visibility:hidden]">
      <img src={productImg(p, 1)} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent" aria-hidden="true" />
      {p.tag && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-900">{p.tag}</span>}
      {!big && <span className="absolute inset-x-0 bottom-0 p-4 text-left text-white"><b className="block text-base font-black leading-tight">{p.name}</b></span>}
    </div>
  );
}

function CardBack({ glow }: { glow: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-[22px] [backface-visibility:hidden] [transform:rotateY(180deg)]"
      style={{ background: `radial-gradient(circle at 50% 40%, ${glow}55, #0b0b12 65%)` }} aria-hidden="true">
      <div className="text-center">
        <div className="text-3xl font-black tracking-tight text-white">GROUA<span style={{ color: glow }}>ROCK</span></div>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/60">GrouaDrop · gadgets</div>
      </div>
    </div>
  );
}

export default function ShopGadgets() {
  const { language, setLanguage } = useLanguage();
  const lang = shopLang(language);
  const T = SHOP_TEXT[lang], t = TXT[lang];
  const navigate = useNavigate();
  const { add, count } = useShopCart();
  const reduce = useReducedMotion();
  const eur = (c: number) => (c / 100).toLocaleString(LOCALE[lang], { style: "currency", currency: "EUR" });
  const items = useMemo(() => SHOP_PRODUCTS.filter((p) => p.cat === "Gadżety").map((p) => localizeProduct(p, lang)), [lang]);
  const [open, setOpen] = useState<string | null>(null);
  const [phase, setPhase] = useState<"spin" | "glow">("spin");
  const rail = useRef<HTMLDivElement>(null);
  const sel = items.find((p) => p.id === open) ?? null;

  useEffect(() => { document.title = `${t.title} · GrouaDrop`; }, [t.title]);
  useEffect(() => {
    if (!open) return;
    setPhase(reduce ? "glow" : "spin");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, reduce]);
  const scrollBy = useCallback((dir: number) => {
    const el = rail.current; if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 280) + 20), behavior: reduce ? "auto" : "smooth" });
  }, [reduce]);
  const order = (p: ShopProduct) => {
    add(SHOP_PRODUCTS.find((x) => x.id === p.id)!, "");
    toast.success(T.added, { action: { label: T.cart, onClick: () => navigate("/shop?cart=1") } });
  };

  return (
    <MotionConfig reducedMotion="user">
      <style>{CSS}</style>
      <div className="min-h-screen overflow-x-hidden bg-[#07070c] text-white" style={{ colorScheme: "dark" }}>
        <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(60% 50% at 15% 10%, #ff7a1a22, transparent 70%), radial-gradient(50% 45% at 90% 30%, #c026d322, transparent 70%), radial-gradient(60% 50% at 50% 100%, #22d3ee18, transparent 70%)" }} />
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#07070c]/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-4">
            <Link to="/shop" className="text-2xl font-black">GROUA<span className="text-orange-500">ROCK</span></Link>
            <Link to="/shop" className="text-sm text-white/60 hover:text-white">← {t.back}</Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-11 items-center rounded-full border border-white/15 p-1" role="group" aria-label="Language">
              {SHOP_LANGS.map((l) => <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={lang === l} className={`h-9 rounded-full px-3 text-xs font-bold uppercase ${lang === l ? "bg-white text-neutral-900" : "text-white/70 hover:text-white"}`}>{l}</button>)}
            </div>
            <button type="button" onClick={() => navigate("/shop?cart=1")} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-900"><ShoppingBag className="h-4 w-4" aria-hidden="true" />{count}</button>
          </div>
        </header>

        <main className="relative mx-auto max-w-6xl pb-20 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4 px-4">
            <div>
              <h1 className="text-5xl font-black tracking-tight sm:text-6xl">{t.title}<span className="text-orange-500">.</span></h1>
              <p className="mt-2 max-w-lg text-white/65">{t.lead}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => scrollBy(-1)} aria-label="←" className="grid h-12 w-12 place-items-center rounded-full border border-white/20 transition hover:border-orange-400 hover:bg-white/5"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button>
              <button type="button" onClick={() => scrollBy(1)} aria-label="→" className="grid h-12 w-12 place-items-center rounded-full border border-white/20 transition hover:border-orange-400 hover:bg-white/5"><ArrowRight className="h-5 w-5" aria-hidden="true" /></button>
            </div>
          </div>

          <LayoutGroup>
            <div ref={rail} className="gg-rail mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-8 pt-2 [perspective:1400px]" role="list">
              {items.map((p, i) => (
                <motion.button key={p.id} data-card type="button" role="listitem" onClick={() => setOpen(p.id)} aria-label={p.name}
                  initial={{ opacity: 0, y: 24, rotateY: -12 }} animate={{ opacity: 1, y: 0, rotateY: 0 }} transition={{ duration: 0.6, delay: i * 0.07 }}
                  whileHover={{ y: -8, rotateY: 6 }}
                  className="group relative w-[72vw] max-w-[300px] shrink-0 snap-center text-left focus-visible:outline-none sm:w-[280px]">
                  {open !== p.id
                    ? <motion.div layoutId={`gg-${p.id}`} className="relative aspect-[3/4] rounded-[22px] ring-1 ring-white/10 transition group-hover:ring-white/30 group-focus-visible:ring-2 group-focus-visible:ring-orange-500"
                        style={{ boxShadow: `0 20px 50px -20px ${glowOf(p.id)}80` }}><CardFace p={p} /></motion.div>
                    : <div className="aspect-[3/4] rounded-[22px] border border-dashed border-white/15" aria-hidden="true" />}
                  <div className="mt-3 flex items-baseline justify-between gap-2 px-1">
                    <span className="text-sm text-white/60">{p.cat}</span>
                    <b className="text-lg">{eur(p.eurCents)}</b>
                  </div>
                </motion.button>
              ))}
            </div>
            <p className="px-4 text-center text-xs uppercase tracking-[0.3em] text-white/40">{t.tap} ↔</p>

            <AnimatePresence>
              {sel && (
                <motion.div key="ov" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
                  <div role="dialog" aria-modal="true" aria-label={sel.name} onClick={(e) => e.stopPropagation()}
                    className="relative my-auto grid w-full max-w-5xl items-center gap-6 md:grid-cols-[minmax(0,420px)_1fr] md:gap-10">
                    <button type="button" onClick={() => setOpen(null)} aria-label={T.close} autoFocus
                      className="absolute -top-2 right-0 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/50 text-white transition hover:border-orange-400 md:-right-4 md:-top-4"><X className="h-5 w-5" aria-hidden="true" /></button>

                    {/* Karta: rośnie (wspólny layoutId), obraca się raz wokół osi Y, potem świeci neonem. */}
                    <div className="mx-auto w-[78vw] max-w-[420px] [perspective:1600px]">
                      <motion.div layoutId={`gg-${sel.id}`} className="relative aspect-[3/4]">
                        <motion.div className={`relative h-full w-full rounded-[22px] [transform-style:preserve-3d] ${phase === "glow" ? "gg-neon" : ""}`}
                          style={{ ["--g" as string]: glowOf(sel.id) }}
                          initial={{ rotateY: 0 }} animate={{ rotateY: reduce ? 0 : 360 }}
                          transition={{ duration: reduce ? 0 : 2.6, ease: [0.45, 0, 0.2, 1], delay: reduce ? 0 : 0.35 }}
                          onAnimationComplete={() => setPhase("glow")}>
                          <CardFace p={sel} big />
                          <CardBack glow={glowOf(sel.id)} />
                        </motion.div>
                      </motion.div>
                    </div>

                    {/* Opis: szklany panel z neonową krawędzią, wjeżdża po zatrzymaniu karty. */}
                    <AnimatePresence>
                      {phase === "glow" && (
                        <motion.section initial={{ opacity: 0, x: 40, filter: "blur(6px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="relative rounded-3xl border bg-white/[0.06] p-6 backdrop-blur-md sm:p-8"
                          style={{ borderColor: `${glowOf(sel.id)}66`, boxShadow: `inset 0 0 40px -18px ${glowOf(sel.id)}` }}>
                          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: glowOf(sel.id) }}>{sel.tag}</span>
                          <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{sel.name}</h2>
                          <p className="mt-3 text-white/75">{sel.desc}</p>
                          {sel.use && <p className="mt-2 text-sm text-white/55">{sel.use}</p>}
                          <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-white/50">{t.feat}</h3>
                          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                            {sel.spec.map((s, k) => (
                              <motion.li key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + k * 0.07 }}
                                className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85">
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: glowOf(sel.id), boxShadow: `0 0 10px ${glowOf(sel.id)}` }} aria-hidden="true" />{s}
                              </motion.li>
                            ))}
                          </ul>
                          <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button type="button" onClick={() => order(sel)} className="inline-flex h-12 items-center gap-2 rounded-full px-6 font-bold text-neutral-950 transition hover:brightness-110" style={{ background: glowOf(sel.id) }}>
                              <ShoppingBag className="h-5 w-5" aria-hidden="true" />{T.preorder} · {eur(sel.eurCents)}
                            </button>
                            <Link to={`/shop/p/${sel.id}`} className="text-sm font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline">{t.full} →</Link>
                          </div>
                        </motion.section>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </main>
      </div>
    </MotionConfig>
  );
}
