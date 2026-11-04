import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { SHOP_ADMIN_EMAIL, SHOP_PRODUCTS, type ShopProduct } from "@/data/shopCatalog";
import { localizeProduct } from "@/data/shopCatalogI18n";
import { SHOP_SERVICE_TYPE, SHOP_SIZES, orderRef, toShopOrder, type PayMethod, type ShopOrderView } from "@/lib/shopOrder";
import { invoiceHtml, openInvoice, type ShopConfig } from "@/lib/shopInvoice";
import { EU_COUNTRIES } from "@/lib/vatOss";
import { LOCALE, SHOP_LANGS, SHOP_TEXT, countryName, shopLang, type ShopDict, type ShopLang } from "@/i18n/shop";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { XmasDecor } from "@/components/shop/XmasDecor";
import { GiftCelebration } from "@/components/shop/GiftCelebration";

type Line = { id: string; size: string; qty: number };
type Bank = { holder: string; iban: string; bic: string | null; revolut: string | null; amountCents: number; reference: string };
const CART_KEY = "gr_cart_v2";
const byId = Object.fromEntries(SHOP_PRODUCTS.map((p) => [p.id, p])) as Record<string, ShopProduct>;

function Card({ p, onAdd, t }: { p: ShopProduct; onAdd: (p: ShopProduct, size: string) => void; t: ShopDict & { eur: (c: number) => string } }) {
  // Film w karcie gra tylko po wybraniu miniatury ▶ i tylko, gdy karta jest na ekranie.
  const [view, setView] = useState(0);
  const [size, setSize] = useState("M");
  const [tilt, setTilt] = useState("");
  const vid = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el || !p.video || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el); return () => io.disconnect();
  }, [p.video]);
  useEffect(() => { const v = vid.current; if (!v) return; if (view === 2 && inView) v.play().catch(() => {}); else v.pause(); }, [view, inView]);
  const imgs = [`/shop/${p.id}-1.jpg`, `/shop/${p.id}-2.jpg`];
  return (
    <article ref={box} id={`p-${p.id}`} className="grid scroll-mt-24 md:grid-cols-2 gap-8 items-center">
      <div>
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-100 cursor-zoom-in" style={{ perspective: 900 }}
          onPointerMove={(e) => { if (e.pointerType === "touch") return; const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; setTilt(`rotateY(${x * 22}deg) rotateX(${-y * 16}deg) scale(1.05)`); }}
          onPointerLeave={() => setTilt("")} onClick={() => setZoom(true)}>
          <div className="absolute inset-0 transition-transform duration-200" style={{ transform: tilt }}>
            <img src={imgs[0]} alt={p.name} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
            <img src={imgs[1]} alt={`${p.name} · 2`} loading="lazy" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${view === 1 ? "opacity-100" : "opacity-0"}`} />
            {p.video && <video ref={vid} src={`/shop/${p.id}.mp4`} poster={imgs[0]} muted loop playsInline preload={inView ? "auto" : "none"} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${view === 2 ? "opacity-100" : "opacity-0"}`} />}
          </div>
          {p.tag && <span className="absolute top-3 left-3 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{p.tag}</span>}
        </div>
        <div className="flex gap-2 mt-2">
          {[0, 1, ...(p.video ? [2] : [])].map((k) => (
            <button key={k} type="button" aria-label={k === 2 ? t.video : `${t.view} ${k + 1}`} onClick={() => setView(k)} className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 ${view === k ? "border-orange-500" : "border-neutral-200"}`}>
              <img src={imgs[k === 1 ? 1 : 0]} alt="" className="h-full w-full object-cover" />
              {k === 2 && <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">▶</span>}
            </button>
          ))}
        </div>
        {zoom && (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-white/95 backdrop-blur" onClick={() => setZoom(false)} role="dialog" aria-label={p.name}>
            <img src={imgs[view === 1 ? 1 : 0]} alt={p.name} className="max-h-[88vh] max-w-[92vw] rounded-2xl shadow-2xl" />
            <button className="absolute top-4 right-4 h-12 w-12 rounded-full border border-neutral-900 bg-white text-xl" aria-label={t.close}>✕</button>
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">{p.cat}</p>
        <h3 className="text-3xl font-black leading-tight">{p.name}</h3>
        <p className="mt-1 text-xl font-extrabold">{t.eur(p.eurCents)}{t.vatIncl === SHOP_TEXT.pl.vatIncl && <span className="font-semibold text-neutral-500"> · ok. {p.pln} zł</span>}</p>
        <p className="mt-3">{p.desc}</p>
        {p.use && <p className="mt-2 text-neutral-500"><b>{t.use}</b> {p.use}</p>}
        <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 text-sm">{p.spec.map((s) => <li key={s} className="py-2">{s}</li>)}</ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {p.sizes && <select value={size} onChange={(e) => setSize(e.target.value)} aria-label={t.size} className="h-11 rounded-full border border-neutral-300 bg-white px-4">{SHOP_SIZES.map((s) => <option key={s}>{s}</option>)}</select>}
          <button type="button" onClick={() => onAdd(p, size)} className="h-11 rounded-full bg-neutral-900 px-6 font-semibold text-white transition hover:bg-orange-500">{p.preorder ? t.preorder : t.addToCart}</button>
        </div>
      </div>
    </article>
  );
}

/** Film produktu w pasku na górze: gra (wyciszony) tylko, gdy jest widoczny. */
function VideoTile({ p, onOpen, price, see }: { p: ShopProduct; onOpen: () => void; price: string; see: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current; if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause(); }, { threshold: 0.5 });
    io.observe(v); return () => io.disconnect();
  }, []);
  return (
    <button type="button" onClick={onOpen} className="group relative w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl bg-neutral-900 text-left sm:w-[44%] lg:w-[31%]">
      <video ref={ref} src={`/shop/${p.id}.mp4`} poster={`/shop/${p.id}-1.jpg`} muted loop playsInline preload="none" className="aspect-square w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-white">
        <span className="block text-sm font-bold leading-snug">{p.name}</span>
        <span className="mt-1 flex items-center justify-between text-sm"><b className="text-orange-300">{price}</b><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-neutral-900">{see} →</span></span>
      </span>
    </button>
  );
}

function CopyRow({ label, value, copyValue, t }: { label: string; value: string; copyValue?: string; t: ShopDict }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0"><div className="text-xs text-neutral-500">{label}</div><div className="break-all font-mono font-semibold">{value}</div></div>
      <button type="button" className="h-9 shrink-0 rounded-full border border-neutral-300 px-3 text-xs" onClick={() => navigator.clipboard?.writeText(copyValue ?? value).then(() => toast.success(t.copied)).catch(() => {})}>{t.copy}</button>
    </div>
  );
}

function TransferBox({ bank, t, eur, onClose }: { bank: Bank; t: ShopDict; eur: (c: number) => string; onClose?: () => void }) {
  const tag = bank.revolut?.replace(/^https?:\/\/revolut\.me\//i, "").replace(/[/?#].*$/, "");
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-neutral-900">
      <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-black">{t.transferTitle}</h3>{onClose && <button type="button" onClick={onClose} aria-label={t.close} className="h-8 w-8 rounded-full border border-neutral-300 bg-white">✕</button>}</div>
      <p className="mt-1 text-sm text-neutral-700">{t.transferText}</p>
      {bank.revolut && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-white p-4">
          <QRCodeSVG value={bank.revolut} size={208} level="M" marginSize={1} aria-label={`Revolut @${tag}`} />
          <p className="font-mono text-sm font-semibold text-neutral-700">@{tag}</p>
          <a href={bank.revolut} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-6 text-sm font-bold text-white">{t.openRevolut}</a>
        </div>
      )}
      <div className="mt-3 divide-y divide-orange-200">
        <CopyRow label={t.amount} value={eur(bank.amountCents)} copyValue={(bank.amountCents / 100).toFixed(2)} t={t} />
        <CopyRow label={t.reference} value={bank.reference} t={t} />
      </div>
    </div>
  );
}

export default function Shop() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { language, setLanguage } = useLanguage();
  const lang: ShopLang = shopLang(language);
  const T = SHOP_TEXT[lang];
  const eur = useCallback((c: number) => (c / 100).toLocaleString(LOCALE[lang], { style: "currency", currency: "EUR" }), [lang]);
  const tc = useMemo(() => ({ ...T, eur }), [T, eur]);
  const products = useMemo(() => SHOP_PRODUCTS.map((p) => localizeProduct(p, lang)), [lang]);
  const cats = useMemo(() => [...new Set(SHOP_PRODUCTS.map((p) => p.cat))], []);
  const [cat, setCat] = useState("");
  const shown = useMemo(() => products.filter((p) => !cat || SHOP_PRODUCTS.find((x) => x.id === p.id)?.cat === cat), [products, cat]);
  const navigate = useNavigate();
  const [cart, setCart] = useState<Line[]>(() => { try { const c = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(c) ? c.filter((l: Line) => byId[l?.id] && l.qty > 0) : []; } catch { return []; } });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string; bank: Bank | null } | null>(null);
  const [orders, setOrders] = useState<ShopOrderView[] | null>(null);
  const [invoices, setInvoices] = useState<Record<string, Record<string, unknown>>>({});
  const [payFor, setPayFor] = useState<Bank | null>(null);
  const [cfg, setCfg] = useState<ShopConfig | null>(null);
  const [gift, setGift] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [ship, setShip] = useState({ name: "", street: "", city: "", zip: "", country: lang === "nl" ? "NL" : lang === "pl" ? "PL" : "", phone: "", company: "", taxId: "" });
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* */ } }, [cart]);
  useEffect(() => { document.title = T.title; document.documentElement.lang = lang; }, [T, lang]);

  useEffect(() => {
    fetch("/api/shop-checkout").then((r) => (r.ok ? r.json() : null)).then((j: ShopConfig | null) => {
      setCfg(j);
      if (j) setMethod((m) => m ?? (j.stripe ? "card" : j.transfer ? "transfer" : null));
    }).catch(() => setCfg(null));
  }, []);

  const shipCents = cfg?.shippingCents ?? 0;
  const subtotal = useMemo(() => cart.reduce((a, l) => a + byId[l.id].eurCents * l.qty, 0), [cart]);
  const total = subtotal + (cart.length ? shipCents : 0);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const add = (p: ShopProduct, size: string) => {
    setCart((c) => { const k = c.find((l) => l.id === p.id && l.size === (p.sizes ? size : "")); return k ? c.map((l) => (l === k ? { ...l, qty: l.qty + 1 } : l)) : [...c, { id: p.id, size: p.sizes ? size : "", qty: 1 }]; });
    toast.success(T.added); setOpen(true);
  };
  const bump = (i: number, d: number) => setCart((c) => c.flatMap((l, k) => (k !== i ? [l] : l.qty + d < 1 ? [] : [{ ...l, qty: l.qty + d }])));

  const loadOrders = useCallback(async () => {
    if (!user) return setOrders(null);
    const { data } = await supabase.from("aurora_business_orders")
      .select("id,user_id,client_email,price_eur,status,payment_status,paid_at,payload,created_at")
      .eq("service_type", SHOP_SERVICE_TYPE).eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20);
    const list = (data ?? []).map((r) => toShopOrder(r as Record<string, unknown>));
    setOrders(list);
    if (list.length) {
      const { data: inv } = await supabase.from("aurora_invoices").select("*").in("order_id", list.map((o) => o.id));
      setInvoices(Object.fromEntries((inv ?? []).map((i) => [String(i.order_id), i as Record<string, unknown>])));
    }
  }, [user]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const api = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/shop-checkout", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(T.errors[j?.error] || T.errors.generic);
    return j;
  }, [T]);

  // Powrót ze Stripe: potwierdź płatność po stronie serwera i wyczyść koszyk.
  useEffect(() => {
    if (!user) return;
    const q = new URLSearchParams(window.location.search);
    const order = q.get("order");
    if (!order) return;
    const clean = () => window.history.replaceState(null, "", "/shop");
    if (q.get("cancelled")) { toast.info(T.cancelled); clean(); return; }
    if (!q.get("paid")) return;
    setCart([]);
    api({ action: "confirm", orderId: order })
      .then((j) => (j.paid ? toast.success(T.paidThanks) : toast.info(T.paidPending)))
      .catch(() => toast.info(T.paidPending))
      .finally(() => { clean(); loadOrders(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko raz po powrocie
  }, [user]);

  // Bilet VIP (tabela gift_codes może jeszcze nie istnieć w bazie — wtedy przestajemy pytać).
  const giftOff = useRef(false);
  const checkGift = useCallback(async () => {
    if (!user || giftOff.current) return;
    const { data, error } = await (supabase as unknown as { from: (t: string) => any }).from("gift_codes").select("code").eq("owner_user_id", user.id).is("redeemed_by", null).order("created_at", { ascending: false }).limit(5); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error) { giftOff.current = true; return; }
    for (const g of (data ?? []) as { code: string }[]) {
      let seen = false; try { seen = localStorage.getItem("gr_gift_seen_" + g.code) === "1"; } catch { /* */ }
      if (!seen) { try { localStorage.setItem("gr_gift_seen_" + g.code, "1"); } catch { /* */ } setGift(g.code); break; }
    }
  }, [user]);
  useEffect(() => {
    if (!user) return;
    checkGift();
    const t = setInterval(checkGift, 7000);
    return () => clearInterval(t);
  }, [user, checkGift]);

  const checkout = async () => {
    if (!cart.length) return;
    if (!user) { navigate("/auth?next=/shop"); return; }
    if (![ship.name, ship.street, ship.city, ship.zip, ship.country].every((v) => v.trim().length > 1)) { toast.error(T.fillAddress); return; }
    if (!agree) { toast.error(T.acceptTerms); return; }
    setBusy(true);
    try {
      const data = await api({ action: "create", items: cart.map((l) => ({ id: l.id, qty: l.qty, size: l.size })), shipping: ship, method, lang });
      if (data.payment === "stripe" && data.url) { window.location.href = data.url; return; }
      setCart([]); setOpen(false);
      setDone({ ref: data.ref ?? orderRef(String(data.orderId)), bank: data.payment === "transfer" ? data.bank : null });
      window.scrollTo({ top: 0, behavior: "smooth" });
      loadOrders();
    } catch (e) { toast.error((e as Error)?.message || T.errors.generic); }
    finally { setBusy(false); }
  };

  const showPayInfo = async (orderId: string) => {
    try { const j = await api({ action: "payinfo", orderId }); setPayFor(j.bank); } catch (e) { toast.error((e as Error).message); }
  };
  const showInvoice = (orderId: string) => {
    const inv = invoices[orderId];
    if (!inv) return;
    openInvoice(invoiceHtml(inv as never, lang, { mode: cfg?.vatMode, exemptNote: cfg?.exemptNote }));
  };

  const admin = isAdmin || user?.email === SHOP_ADMIN_EMAIL;
  const inp = "h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm w-full";
  const countries = useMemo(() => EU_COUNTRIES.map((c) => ({ c, n: countryName(c, lang) })).sort((a, b) => a.n.localeCompare(b.n, LOCALE[lang])), [lang]);
  const methods: { id: PayMethod; label: string }[] = [
    ...(cfg?.stripe ? [{ id: "card" as const, label: T.payCard }] : []),
    ...(cfg?.transfer ? [{ id: "transfer" as const, label: T.payTransfer }] : []),
  ];
  const buttonLabel = busy ? T.processing : !user ? T.loginToBuy : method === "card" ? T.orderPay : T.orderOblig;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-neutral-900" style={{ colorScheme: "light" }}>
      <XmasDecor />
      {gift && <GiftCelebration lang={lang} code={gift} onClose={() => setGift(null)} onGo={() => { setGift(null); navigate("/"); }} />}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3">
        <div className="flex items-center gap-4"><span className="text-2xl font-black">GROUA<span className="text-orange-500">ROCK</span></span><Link to="/" className="text-sm text-neutral-600 hover:text-neutral-900">{T.back}</Link></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-11 items-center rounded-full border border-neutral-300 p-1" role="group" aria-label="Language">
            {SHOP_LANGS.map((l) => <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={lang === l} className={`h-9 rounded-full px-3 text-xs font-bold uppercase ${lang === l ? "bg-neutral-900 text-white" : "text-neutral-600"}`}>{l}</button>)}
          </div>
          {admin && <button type="button" onClick={() => navigate("/admin?tab=shop")} className="h-11 rounded-full bg-orange-500 px-5 text-sm font-bold text-white">{T.admin}</button>}
          {user ? (<><span className="hidden text-sm text-neutral-600 sm:inline">{user.email}</span><button type="button" onClick={() => signOut()} className="h-11 rounded-full border border-neutral-300 px-4 text-sm">{T.logout}</button></>)
            : <button type="button" onClick={() => navigate("/auth?next=/shop")} className="h-11 rounded-full border border-neutral-900 px-5 text-sm font-semibold">{T.login}</button>}
          <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white">{T.cart} ({count})</button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl pb-2 pt-6" aria-label={T.inMotion}>
        <h2 className="mb-3 px-4 text-2xl font-black">{T.inMotion}</h2>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          {products.filter((p) => p.video).map((p) => (
            <VideoTile key={p.id} p={p} price={eur(p.eurCents)} see={T.see} onOpen={() => { setCat(""); setTimeout(() => document.getElementById(`p-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-6 pt-8">
        <p className="mb-2 text-sm font-bold uppercase tracking-[.25em] text-red-600">{T.xmas}</p>
        <h1 className="text-5xl font-black leading-none sm:text-7xl">{T.heroA} <span className="bg-gradient-to-r from-red-600 via-orange-500 to-pink-500 bg-clip-text text-transparent">{T.heroB}</span></h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-600">{T.heroText}</p>
        {done && (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-orange-50 p-4 text-orange-900"><b>{T.orderAccepted.replace("{id}", done.ref)}</b>{!done.bank && <> {T.linkSoon.replace("{email}", user?.email ? ` (${user.email})` : "")}</>}</p>
            {done.bank && <TransferBox bank={done.bank} t={T} eur={eur} />}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12" aria-label={T.collection}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-black">{T.collection} <span className="text-neutral-400">({shown.length})</span></h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label={T.collection}>
            {["", ...cats].map((c) => (
              <button key={c || "all"} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
                className={`h-9 rounded-full border px-4 text-sm font-semibold ${cat === c ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700"}`}>
                {c ? localizeProduct(SHOP_PRODUCTS.find((x) => x.cat === c)!, lang).cat : T.all}
              </button>))}
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <li key={p.id}>
              <a href={`#p-${p.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`p-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-square bg-neutral-100">
                  <img src={`/shop/${p.id}-1.jpg`} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  {p.video && <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">▶ {T.video}</span>}
                  {p.tag && <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{p.tag}</span>}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</p>
                  <p className="mt-1 text-sm font-extrabold text-orange-600">{eur(p.eurCents)}</p>
                </div>
              </a>
            </li>))}
        </ul>
      </section>

      <main className="mx-auto max-w-5xl space-y-20 px-4 pb-16">
        {shown.map((p) => <Card key={p.id} p={p} onAdd={add} t={tc} />)}
        {user && orders && orders.length > 0 && (
          <section><h2 className="mb-4 text-3xl font-black">{T.myOrders}</h2>
            {payFor && <div className="mb-4"><TransferBox bank={payFor} t={T} eur={eur} onClose={() => setPayFor(null)} /></div>}
            <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">{orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span>#{orderRef(o.id)} · {new Date(o.created_at).toLocaleDateString(LOCALE[lang])}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span>{eur(o.total_cents)} · {T.status[o.status] ?? o.status}</span>
                  {o.payment_status !== "paid" && o.status === "new" && cfg?.transfer && <button type="button" onClick={() => showPayInfo(o.id)} className="h-9 rounded-full border border-neutral-300 px-3 text-xs">{T.howToPay}</button>}
                  {invoices[o.id] && <button type="button" onClick={() => showInvoice(o.id)} className="h-9 rounded-full border border-neutral-300 px-3 text-xs">{T.invoice}</button>}
                </span>
              </li>))}</ul></section>
        )}
      </main>

      <footer className="border-t border-neutral-200 px-4 py-8 text-sm text-neutral-600">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2">
          <Link to="/shop/terms" className="underline underline-offset-4 hover:text-neutral-900">{T.terms}</Link>
          <Link to="/legal" className="underline underline-offset-4 hover:text-neutral-900">Privacy</Link>
          {cfg?.seller?.email && <a href={`mailto:${cfg.seller.email}`} className="underline underline-offset-4 hover:text-neutral-900">{T.contact}: {cfg.seller.email}</a>}
          {cfg?.seller && <span>{cfg.seller.name}, {cfg.seller.address}</span>}
        </div>
      </footer>

      {open && <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />}
      <aside className={`fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-md flex-col bg-white p-5 shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`} aria-label={T.cart}>
        <div className="flex items-center justify-between"><h2 className="text-2xl font-black">{T.cart}</h2><button type="button" onClick={() => setOpen(false)} aria-label={T.close} className="h-10 w-10 rounded-full border border-neutral-300">✕</button></div>
        <div className="mt-3 flex-1 space-y-3 overflow-auto">
          {cart.length === 0 && <p className="text-neutral-500">{T.emptyCart}</p>}
          {cart.map((l, i) => { const p = localizeProduct(byId[l.id], lang); return (
            <div key={l.id + l.size} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-neutral-200 pb-3">
              <img src={`/shop/${p.id}-1.jpg`} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <div className="text-sm"><b>{p.name}</b><br /><span className="text-neutral-500">{l.size ? `${T.size} ${l.size} · ` : ""}{eur(p.eurCents)}</span></div>
              <div className="flex items-center gap-1"><button type="button" onClick={() => bump(i, -1)} aria-label={T.less} className="h-8 w-8 rounded-lg border border-neutral-300">−</button><span className="w-5 text-center">{l.qty}</span><button type="button" onClick={() => bump(i, 1)} aria-label={T.more} className="h-8 w-8 rounded-lg border border-neutral-300">+</button></div>
            </div>); })}
          {cart.length > 0 && user && (
            <div className="space-y-2 pt-2"><h3 className="font-bold">{T.shipTitle}</h3>
              {([["name", T.fName], ["street", T.fStreet], ["zip", T.fZip], ["city", T.fCity]] as const).map(([k, ph]) => (
                <input key={k} className={inp} placeholder={ph} aria-label={ph} value={ship[k]} onChange={(e) => setShip({ ...ship, [k]: e.target.value })} />))}
              <select className={inp} aria-label={T.fCountry} value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value })}>
                <option value="">{T.pickCountry}</option>
                {countries.map(({ c, n }) => <option key={c} value={c}>{n}</option>)}
              </select>
              <p className="text-xs text-neutral-500">{T.euOnly}</p>
              {([["phone", T.fPhone], ["company", T.fCompany], ["taxId", T.fTaxId]] as const).map(([k, ph]) => (
                <input key={k} className={inp} placeholder={ph} aria-label={ph} value={ship[k]} onChange={(e) => setShip({ ...ship, [k]: e.target.value })} />))}
              {methods.length > 0 && (
                <fieldset className="space-y-2 pt-2"><legend className="font-bold">{T.payTitle}</legend>
                  {methods.map((m) => (
                    <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${method === m.id ? "border-neutral-900" : "border-neutral-300"}`}>
                      <input type="radio" name="pay" checked={method === m.id} onChange={() => setMethod(m.id)} className="h-4 w-4" />{m.label}
                    </label>))}
                </fieldset>)}
              <label className="flex items-start gap-2 pt-1 text-xs text-neutral-600">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>{T.agreeA} <Link to="/shop/terms" target="_blank" className="underline underline-offset-2">{T.agreeLink}</Link> {T.agreeB}</span>
              </label>
            </div>)}
        </div>
        {cart.length > 0 && shipCents > 0 && <div className="flex justify-between pt-3 text-sm text-neutral-600"><span>{T.shipping}</span><span>{eur(shipCents)}</span></div>}
        <div className="flex justify-between border-t border-neutral-200 py-3 text-xl font-black"><span>{T.total}</span><span>{eur(total)}</span></div>
        <p className="-mt-2 pb-2 text-xs text-neutral-500">{T.vatIncl}</p>
        <button type="button" disabled={busy || !cart.length} onClick={checkout} className="h-12 rounded-full bg-neutral-900 font-bold text-white transition hover:bg-orange-500 disabled:opacity-50">{buttonLabel}</button>
        {!user && <p className="mt-2 text-xs text-neutral-500">{T.sameAccount}</p>}
        {user && methods.length === 0 && cart.length > 0 && <p className="mt-2 text-xs text-neutral-500">{T.linkByEmail}</p>}
      </aside>
    </div>
  );
}
