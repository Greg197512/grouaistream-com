// Komplety GrouaDrop: każda kolekcja to spójny zestaw (ta sama paleta i klimat, każdy produkt z innym wzorem).
// Karta kompletu = kolaż produktów + cena całości + „Zobacz komplet” (filtr katalogu na tę kolekcję).
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { productImg, type ShopProduct } from "@/data/shopCatalog";

type L = "pl" | "en" | "nl";
export type ShopSet = { cat: string; title: Record<L, string>; line: Record<L, string>; bg: string; glow: string; ids: string[] };

export const SHOP_SETS: ShopSet[] = [
  {
    cat: "Kolekcja Studio",
    title: { pl: "Komplet Studio", en: "Studio Set", nl: "Studio-set" },
    line: { pl: "Chrom, pomarańcz i bas. Dla tych, co siedzą przy konsolecie do rana.", en: "Chrome, orange and bass. For those who stay at the desk till sunrise.", nl: "Chroom, oranje en bas. Voor wie tot zonsopgang achter de mengtafel zit." },
    bg: "linear-gradient(135deg,#1a0f05 0%,#2b1306 45%,#0b0b0f 100%)", glow: "#ff7a1a",
    ids: ["bassdept", "louder", "kubekbeats", "padstudio"],
  },
  {
    cat: "Nocna zmiana",
    title: { pl: "Komplet Nocna zmiana", en: "Night Shift Set", nl: "Nachtploeg-set" },
    line: { pl: "Neon, lasery i 23:00 na zegarku. Rave zaczyna się, gdy miasto zasypia.", en: "Neon, lasers and 23:00 on the clock. The rave starts when the city sleeps.", nl: "Neon, lasers en 23:00 op de klok. De rave begint als de stad slaapt." },
    bg: "linear-gradient(135deg,#14021f 0%,#1d0640 50%,#020b1a 100%)", glow: "#ff2bd6",
    ids: ["afterhours", "nightshift", "etuieq", "plakatnight"],
  },
];

const TXT = {
  pl: { h: "Komplety", sub: "Kolekcje, które pasują do siebie — każdy produkt z innym wzorem.", items: "produkty", from: "razem", see: "Zobacz komplet" },
  en: { h: "Sets", sub: "Collections that belong together — every piece with its own design.", items: "items", from: "together", see: "See the set" },
  nl: { h: "Sets", sub: "Collecties die bij elkaar horen — elk stuk met een eigen ontwerp.", items: "items", from: "samen", see: "Bekijk de set" },
};

export function CollectionSets({ lang, products, eur, onPick }: { lang: L; products: ShopProduct[]; eur: (c: number) => string; onPick: (cat: string) => void }) {
  const t = TXT[lang];
  const byId = new Map(products.map((p) => [p.id, p]));
  const sets = SHOP_SETS.map((s) => ({ ...s, items: s.ids.map((id) => byId.get(id)).filter(Boolean) as ShopProduct[] })).filter((s) => s.items.length);
  if (!sets.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14" aria-label={t.h}>
      <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t.h}</h2>
      <p className="mt-1 max-w-xl text-sm text-neutral-500">{t.sub}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {sets.map((s, i) => {
          const total = s.items.reduce((a, p) => a + p.eurCents, 0);
          return (
            <motion.button key={s.cat} type="button" onClick={() => onPick(s.cat)}
              initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-3xl p-5 text-left text-white shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:p-6"
              style={{ background: s.bg }}>
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl transition duration-700 group-hover:opacity-70" style={{ background: s.glow }} />
              <div className="relative flex h-40 items-end sm:h-48" aria-hidden>
                {s.items.slice(0, 4).map((p, k) => (
                  <img key={p.id} src={productImg(p, 1)} alt="" loading="lazy" decoding="async"
                    className="h-28 w-[22%] min-w-0 rounded-2xl border border-white/15 bg-white object-cover shadow-2xl transition duration-500 sm:h-40 sm:w-32"
                    style={{ marginLeft: k ? -26 : 0, transform: `rotate(${(k - (Math.min(s.items.length, 4) - 1) / 2) * 6}deg) translateY(${k % 2 ? -8 : 0}px)`, zIndex: 10 - k }} />
                ))}
              </div>
              <div className="relative mt-5 flex items-end justify-between gap-3">
                <div>
                  <b className="block text-xl font-black leading-tight sm:text-2xl">{s.title[lang]}</b>
                  <span className="mt-1 block max-w-sm text-sm text-white/75">{s.line[lang]}</span>
                  <span className="mt-2 block text-xs font-semibold uppercase tracking-wider text-white/60">{s.items.length} {t.items} · {t.from} {eur(total)}</span>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition group-hover:gap-2.5">
                  {t.see} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
