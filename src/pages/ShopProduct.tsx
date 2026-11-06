// Strona jednego produktu sklepu (/shop/p/:id): galeria (zdjęcia + film), opis, rozmiar, koszyk, „Zobacz też”.
// Lekka: jeden produkt naraz, bez efektów przechylania i bez wielu filmów jednocześnie.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { SHOP_PRODUCTS, productImg } from "@/data/shopCatalog";
import { LivePrint } from "@/components/shop/LivePrint";
import { localizeProduct } from "@/data/shopCatalogI18n";
import { SHOP_SIZES } from "@/lib/shopOrder";
import { useShopCart } from "@/lib/shopCart";
import { LOCALE, SHOP_LANGS, SHOP_TEXT, shopLang } from "@/i18n/shop";
import { STORE_TXT } from "@/components/shop/Storefront";
import { Gift, RotateCcw, ShieldCheck, ShoppingBag, Truck } from "lucide-react";

export default function ShopProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const lang = shopLang(language);
  const T = SHOP_TEXT[lang];
  const S = STORE_TXT[lang];
  const base = SHOP_PRODUCTS.find((p) => p.id === id);
  const p = useMemo(() => (base ? localizeProduct(base, lang) : null), [base, lang]);
  const { add, count } = useShopCart();
  const [view, setView] = useState(0);
  const [size, setSize] = useState("M");
  const [zoom, setZoom] = useState(false);
  const vid = useRef<HTMLVideoElement>(null);
  const eur = (c: number) => (c / 100).toLocaleString(LOCALE[lang], { style: "currency", currency: "EUR" });

  useEffect(() => { setView(base?.video ? 2 : 0); setSize("M"); window.scrollTo(0, 0); }, [id, base?.video]);
  useEffect(() => { if (p) document.title = `${p.name} | Grouarock`; }, [p]);
  useEffect(() => { const v = vid.current; if (!v) return; if (view === 2) v.play().catch(() => {}); else v.pause(); }, [view]);

  if (!p || !base) {
    return (
      <div className="grid min-h-screen place-items-center bg-white p-6 text-neutral-900" style={{ colorScheme: "light" }}>
        <div className="text-center"><p className="text-xl font-bold">404</p><Link to="/shop" className="mt-2 inline-block underline">← {T.collection}</Link></div>
      </div>
    );
  }

  const imgs = p.img?.length ? p.img : [productImg(p, 1), productImg(p, 2)];
  const related = SHOP_PRODUCTS.filter((x) => x.id !== p.id && x.cat === base.cat).concat(SHOP_PRODUCTS.filter((x) => x.cat !== base.cat)).slice(0, 4).map((x) => localizeProduct(x, lang));
  const onAdd = () => {
    add(base, size);
    toast.success(T.added, { action: { label: T.cart, onClick: () => navigate("/shop?cart=1") } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-neutral-900" style={{ colorScheme: "light" }}>
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link to="/shop" className="text-2xl font-black">GROUA<span className="text-orange-500">ROCK</span></Link>
          <Link to="/shop" className="text-sm text-neutral-600 hover:text-neutral-900">← {T.collection}</Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-11 items-center rounded-full border border-neutral-300 p-1" role="group" aria-label="Language">
            {SHOP_LANGS.map((l) => <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={lang === l} className={`h-9 rounded-full px-3 text-xs font-bold uppercase ${lang === l ? "bg-neutral-900 text-white" : "text-neutral-600"}`}>{l}</button>)}
          </div>
          <button type="button" onClick={() => navigate("/shop?cart=1")} className="h-11 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white">{T.cart} ({count})</button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
        <div>
          <div className="relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl bg-neutral-100" onClick={() => view !== 2 && setZoom(true)}>
            {view === 2 && base.video
              ? <video ref={vid} src={`/shop/${p.id}.mp4`} poster={imgs[0]} muted loop playsInline autoPlay className="h-full w-full object-cover" />
              : <img src={imgs[view]} alt={p.name} decoding="async" className="h-full w-full object-cover" />}
            {view === 0 && p.fx && <LivePrint fx={p.fx} aspect={1} />}
            {p.tag && <span className="absolute left-3 top-3 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{p.tag}</span>}
          </div>
          <div className="mt-2 flex gap-2">
            {[...(base.video ? [2] : []), 0, 1].map((k) => (
              <button key={k} type="button" aria-label={k === 2 ? T.video : `${T.view} ${k + 1}`} onClick={() => setView(k)} className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 ${view === k ? "border-orange-500" : "border-neutral-200"}`}>
                <img src={imgs[k === 1 ? 1 : 0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                {k === 2 && <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">▶</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">{p.cat}</p>
          <h1 className="text-3xl font-black leading-tight [text-wrap:balance] sm:text-4xl">{p.name}</h1>
          <p className="mt-2 text-2xl font-extrabold">{eur(p.eurCents)}{lang === "pl" && <span className="text-base font-semibold text-neutral-500"> · ok. {p.pln} zł</span>}</p>
          <p className="text-xs text-neutral-500">{T.vatIncl}</p>
          <p className="mt-4">{p.desc}</p>
          {p.use && <p className="mt-2 text-neutral-600"><b>{T.use}</b> {p.use}</p>}
          <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 text-sm">{p.spec.map((s) => <li key={s} className="py-2">{s}</li>)}</ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {base.sizes && (
              <div className="w-full">
                <p className="mb-2 text-sm font-semibold">{T.size}: <span className="text-neutral-500">{size}</span></p>
                <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={T.size}>
                  {(p.sizeList ?? SHOP_SIZES).map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => setSize(s)}
                      className={`h-11 rounded-xl border text-sm font-bold transition ${size === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:border-neutral-900"}`}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={onAdd} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-7 text-base font-semibold text-white shadow-lg shadow-neutral-900/20 transition hover:bg-orange-500 hover:shadow-orange-500/30"><ShoppingBag className="h-5 w-5" aria-hidden="true" />{base.preorder ? T.preorder : T.addToCart} · {eur(p.eurCents)}</button>
            <ul className="grid w-full grid-cols-2 gap-2 text-xs text-neutral-600">
              {S.trust.map(([h, d], i) => { const Icon = [Truck, RotateCcw, ShieldCheck, Gift][i]; return (
                <li key={h} className="flex items-start gap-2 rounded-xl bg-neutral-50 p-2.5"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" /><span><b className="block text-neutral-900">{h.replace("{ship}", S.freeShip)}</b>{d}</span></li>); })}
            </ul>
          </div>
          <Link to="/shop/terms" className="mt-4 inline-block text-xs text-neutral-500 underline underline-offset-4">{T.terms}</Link>
        </div>
      </main>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="mb-3 text-2xl font-black">{T.related}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {related.map((r) => (
            <li key={r.id}>
              <Link to={`/shop/p/${r.id}`} className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-lg">
                <img src={productImg(r, 1)} alt={r.name} loading="lazy" decoding="async" width={400} height={400} className="aspect-square w-full object-cover" />
                <div className="p-3"><p className="line-clamp-2 text-sm font-bold leading-snug">{r.name}</p><p className="mt-1 text-sm font-extrabold text-orange-600">{eur(r.eurCents)}</p></div>
              </Link>
            </li>))}
        </ul>
      </section>

      {zoom && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-white/95" onClick={() => setZoom(false)} role="dialog" aria-label={p.name}>
          <img src={imgs[view === 1 ? 1 : 0]} alt={p.name} className="max-h-[88vh] max-w-[92vw] rounded-2xl shadow-2xl" />
          <button className="absolute right-4 top-4 h-12 w-12 rounded-full border border-neutral-900 bg-white text-xl" aria-label={T.close}>✕</button>
        </div>
      )}
    </div>
  );
}
