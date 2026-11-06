// Elementy witryny sklepu w stylu profesjonalnego sklepu odzieżowego: baner z filmem, pasek zaufania,
// kafelki kategorii, karta produktu (drugie zdjęcie po najechaniu, szybkie dodanie z wyborem rozmiaru), FAQ.
// Animacje: framer-motion, jednorazowe (wejście / pojawienie przy przewijaniu); MotionConfig szanuje „ogranicz ruch”.
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Gift, Plus, RotateCcw, ShieldCheck, Truck, ChevronDown } from "lucide-react";
import { productImg, type ShopProduct } from "@/data/shopCatalog";
import { LivePrint } from "./LivePrint";
import { SHOP_SIZES } from "@/lib/shopOrder";
import type { ShopLang } from "@/i18n/shop";

export const STORE_TXT = {
  pl: {
    eyebrow: "Nowa kolekcja · Zima 2026", h1a: "Noś swój", h1b: "dźwięk.", lead: "Streetwear dla ludzi, którzy żyją muzyką. Drukowane na zamówienie, wysyłane prosto do Ciebie.",
    shop: "Kup kolekcję", best: "Zobacz bluzę", from: "od",
    trust: [["Dostawa {ship}", "InPost, DHL, Poczta i inni"], ["14 dni na zwrot", "Bez podawania przyczyny"], ["Bezpieczna płatność", "Revolut — aplikacja lub karta"], ["Bilet VIP gratis", "30 dni VIP do każdego zamówienia"]],
    freeShip: "gratis", shipFrom: "od {price}",
    cats: "Kategorie", sort: "Sortuj", sortFeatured: "Polecane", sortAsc: "Cena: od najniższej", sortDesc: "Cena: od najwyższej",
    add: "Dodaj", pickSize: "Wybierz rozmiar", added: "Dodano do koszyka",
    faq: "Najczęstsze pytania",
    faqs: [
      ["Ile trwa dostawa?", "Zwykle {days} dni roboczych. Ubrania drukujemy na zamówienie, a numer przesyłki dostaniesz mailem — znajdziesz go też w „Moich zamówieniach”."],
      ["Jak zapłacić?", "Kodem QR Revolut — w aplikacji albo kartą. Dane do płatności pokażemy od razu po złożeniu zamówienia."],
      ["Czy mogę zwrócić zakup?", "Tak. Masz 14 dni od otrzymania paczki na odstąpienie od umowy bez podawania przyczyny. Szczegóły w regulaminie."],
      ["Jaki rozmiar wybrać?", "Mamy rozmiary od S do 3XL. Jeśli wahasz się między dwoma, napisz do nas — doradzimy."],
      ["Co to jest bilet VIP?", "Do każdego zamówienia dostajesz kod na 30 dni VIP w Grouaistream — wklejasz go w aplikacji i gotowe."],
    ],
  },
  en: {
    eyebrow: "New collection · Winter 2026", h1a: "Wear your", h1b: "sound.", lead: "Streetwear for people who live music. Printed on demand, shipped straight to you.",
    shop: "Shop the collection", best: "See the hoodie", from: "from",
    trust: [["Shipping {ship}", "InPost, DHL, postal and more"], ["14-day returns", "No questions asked"], ["Secure payment", "Revolut — app or card"], ["Free VIP ticket", "30 days of VIP with every order"]],
    freeShip: "free", shipFrom: "from {price}",
    cats: "Categories", sort: "Sort", sortFeatured: "Featured", sortAsc: "Price: low to high", sortDesc: "Price: high to low",
    add: "Add", pickSize: "Choose size", added: "Added to cart",
    faq: "FAQ",
    faqs: [
      ["How long is delivery?", "Usually {days} business days. Clothes are printed on demand and you'll get the tracking number by email — it's also in “My orders”."],
      ["How do I pay?", "With a Revolut QR code — in the app or by card. We show the payment details right after you order."],
      ["Can I return my purchase?", "Yes. You have 14 days from delivery to withdraw without giving a reason. Details in the shop terms."],
      ["Which size should I choose?", "We have sizes S to 3XL. If you're between two sizes, message us and we'll help."],
      ["What is the VIP ticket?", "Every order comes with a code for 30 days of VIP on Grouaistream — paste it in the app and you're done."],
    ],
  },
  nl: {
    eyebrow: "Nieuwe collectie · Winter 2026", h1a: "Draag je", h1b: "sound.", lead: "Streetwear voor mensen die muziek leven. Op bestelling bedrukt en rechtstreeks naar je verzonden.",
    shop: "Shop de collectie", best: "Bekijk de hoodie", from: "vanaf",
    trust: [["Verzending {ship}", "InPost, DHL, post en meer"], ["14 dagen retour", "Zonder opgaaf van reden"], ["Veilig betalen", "Revolut — app of kaart"], ["Gratis VIP-ticket", "30 dagen VIP bij elke bestelling"]],
    freeShip: "gratis", shipFrom: "vanaf {price}",
    cats: "Categorieën", sort: "Sorteer", sortFeatured: "Aanbevolen", sortAsc: "Prijs: laag naar hoog", sortDesc: "Prijs: hoog naar laag",
    add: "Toevoegen", pickSize: "Kies maat", added: "Toegevoegd aan winkelwagen",
    faq: "Veelgestelde vragen",
    faqs: [
      ["Hoe lang duurt de levering?", "Meestal {days} werkdagen. Kleding wordt op bestelling bedrukt; het trackingnummer krijg je per e-mail en staat ook bij “Mijn bestellingen”."],
      ["Hoe betaal ik?", "Met een Revolut QR-code — in de app of met je kaart. De betaalgegevens zie je direct na je bestelling."],
      ["Kan ik mijn aankoop retourneren?", "Ja. Je hebt 14 dagen na ontvangst om zonder opgaaf van reden af te zien van de koop. Details in de voorwaarden."],
      ["Welke maat kies ik?", "We hebben maten S t/m 3XL. Twijfel je tussen twee maten? Stuur ons een bericht."],
      ["Wat is het VIP-ticket?", "Bij elke bestelling krijg je een code voor 30 dagen VIP op Grouaistream — plak hem in de app en klaar."],
    ],
  },
} as const;
export type StoreDict = (typeof STORE_TXT)[ShopLang];

const rise = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } };

/** Baner: tekst + film produktu (wyciszony, w pętli) z „pływającą” ceną. */
export function StoreHero({ t, onShop, heroId, heroName, heroPrice }: { t: StoreDict; onShop: () => void; heroId: string; heroName: string; heroPrice: string }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-8 md:grid-cols-2 md:gap-12 md:pt-14">
      <motion.div {...rise} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />{t.eyebrow}
        </p>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight [text-wrap:balance] sm:text-6xl lg:text-7xl">
          {t.h1a} <span className="bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-600 bg-clip-text text-transparent">{t.h1b}</span>
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-neutral-600">{t.lead}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={onShop} className="group inline-flex h-12 items-center gap-2 rounded-full bg-neutral-900 px-7 font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:bg-orange-500 hover:shadow-orange-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
            {t.shop}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </button>
          <Link to={`/shop/p/${heroId}`} className="inline-flex h-12 items-center rounded-full border border-neutral-300 bg-white px-7 font-semibold transition hover:border-orange-400 hover:text-orange-700">{t.best}</Link>
        </div>
      </motion.div>
      <motion.div className="relative" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
        <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-orange-200/60 via-rose-200/40 to-sky-200/50 blur-2xl" aria-hidden="true" />
        <div className="overflow-hidden rounded-[2rem] bg-neutral-900 shadow-2xl">
          <video src={`/shop/${heroId}.mp4`} poster={`/shop/${heroId}-1.jpg`} autoPlay muted loop playsInline preload="metadata" className="aspect-[4/5] w-full object-cover" aria-label={heroName} />
        </div>
        <Link to={`/shop/p/${heroId}`} className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-xl backdrop-blur transition hover:-translate-y-0.5">
          <img src={`/shop/${heroId}-1.jpg`} alt="" className="h-11 w-11 rounded-lg object-cover" />
          <span className="text-sm"><b className="block leading-tight">{heroName}</b><span className="text-orange-600">{heroPrice}</span></span>
        </Link>
      </motion.div>
    </section>
  );
}

/** Pasek zaufania: dostawa, zwroty, płatność, bilet VIP (same prawdziwe informacje). */
export function TrustBar({ t, ship }: { t: StoreDict; ship: string }) {
  const icons = [Truck, RotateCcw, ShieldCheck, Gift];
  return (
    <section className="border-y border-neutral-200 bg-white">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-neutral-200 md:grid-cols-4">
        {t.trust.map(([h, d], i) => {
          const Icon = icons[i];
          return (
            <li key={h} className="flex items-center gap-3 bg-white px-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 text-sm"><b className="block leading-tight">{h.replace("{ship}", ship)}</b><span className="text-neutral-500">{d}</span></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Kafelki kategorii ze zdjęciem; klik filtruje kolekcję. */
export function CategoryTiles({ t, tiles, onPick }: { t: StoreDict; tiles: { cat: string; label: string; img: string; count: string }[]; onPick: (cat: string) => void }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12" aria-label={t.cats}>
      <h2 className="mb-4 text-2xl font-black tracking-tight sm:text-3xl">{t.cats}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((c, i) => (
          <motion.button key={c.cat} type="button" onClick={() => onPick(c.cat)}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45, delay: i * 0.06 }}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
            <img src={c.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
              <span><b className="block text-lg leading-tight">{c.label}</b><span className="text-xs text-white/75">{c.count}</span></span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur transition group-hover:bg-orange-500"><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

/** Karta produktu: drugie zdjęcie po najechaniu, szybkie dodanie (rozmiar w karcie), widoczne też na telefonie. */
export function ProductCard({ p, index, price, t, videoLabel, onAdd }: {
  p: ShopProduct; index: number; price: string; t: StoreDict; videoLabel: string; onAdd: (p: ShopProduct, size: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const quick = () => (p.sizes ? setPicking((v) => !v) : onAdd(p, ""));
  return (
    <motion.li initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: (index % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-100">
        <Link to={`/shop/p/${p.id}`} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500" aria-label={p.name}>
          <img src={productImg(p, 1)} alt={p.name} loading="lazy" decoding="async" width={480} height={600} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          {p.fx && <span className="absolute inset-0 transition duration-700 group-hover:scale-105 group-hover:opacity-0"><LivePrint fx={p.fx} aspect={0.8} /></span>}
          <img src={productImg(p, 2)} alt="" loading="lazy" decoding="async" width={480} height={600} className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
        </Link>
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {p.tag && <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-900 shadow-sm">{p.tag}</span>}
          {p.video && <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white">▶ {videoLabel}</span>}
        </div>
        {picking ? (
          <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/95 p-2 shadow-xl backdrop-blur">
            <p className="mb-1.5 text-center text-[11px] font-semibold text-neutral-600">{t.pickSize}</p>
            <div className="grid grid-cols-6 gap-1">
              {(p.sizeList ?? SHOP_SIZES).map((s) => (
                <button key={s} type="button" onClick={() => { onAdd(p, s); setPicking(false); }}
                  className="h-8 rounded-md border border-neutral-200 text-[11px] font-bold transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <button type="button" onClick={quick} aria-label={`${t.add}: ${p.name}`}
            className="absolute bottom-2.5 right-2.5 inline-flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3 text-sm font-semibold text-neutral-900 shadow-lg backdrop-blur transition hover:bg-neutral-900 hover:text-white md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:focus-visible:translate-y-0 md:focus-visible:opacity-100">
            <Plus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t.add}</span>
          </button>
        )}
      </div>
      <Link to={`/shop/p/${p.id}`} className="mt-3 block">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 group-hover:underline group-hover:underline-offset-4">{p.name}</p>
        <p className="mt-1 text-sm font-bold text-neutral-900">{price}</p>
      </Link>
    </motion.li>
  );
}

/** FAQ jako rozwijane pytania (natywne <details> — dostępne i bez dodatkowego kodu). */
export function StoreFaq({ t, days }: { t: StoreDict; days: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-16" aria-label={t.faq}>
      <h2 className="mb-6 text-center text-2xl font-black tracking-tight sm:text-3xl">{t.faq}</h2>
      <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {t.faqs.map(([q, a]) => (
          <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {q}<ChevronDown className="h-5 w-5 shrink-0 text-neutral-400 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-3 leading-relaxed text-neutral-600">{a.replace("{days}", days)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
