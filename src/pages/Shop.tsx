import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useShopCart } from "@/lib/shopCart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CollectionSets } from "@/components/shop/CollectionSets";
import { SHOP_ADMIN_EMAIL, SHOP_PRODUCTS, productImg, type ShopProduct } from "@/data/shopCatalog";
import { localizeProduct } from "@/data/shopCatalogI18n";
import { SHOP_SERVICE_TYPE, orderRef, toShopOrder, type PayMethod, type ShopOrderView } from "@/lib/shopOrder";
import { invoiceHtml, openInvoice, type ShopConfig } from "@/lib/shopInvoice";
import { EU_COUNTRIES } from "@/lib/vatOss";
import { LOCALE, SHOP_LANGS, SHOP_TEXT, countryName, shopLang, type ShopDict, type ShopLang } from "@/i18n/shop";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { XmasDecor } from "@/components/shop/XmasDecor";
import { CategoryTiles, ProductCard, STORE_TXT, StoreFaq, StoreHero, TrustBar } from "@/components/shop/Storefront";
import { MotionConfig, motion } from "framer-motion";
import { LogOut, Package, ShoppingBag, User } from "lucide-react";
import { INPOST_MAP_URL, carrierById, carriersFor, isPointCode, trackingUrl } from "@/data/shopCarriers";
import { GiftCelebration } from "@/components/shop/GiftCelebration";

type Bank = { holder: string; iban: string; bic: string | null; revolut: string | null; amountCents: number; reference: string };
const byId = Object.fromEntries(SHOP_PRODUCTS.map((p) => [p.id, p])) as Record<string, ShopProduct>;

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
        <span className="mt-1 flex items-center justify-between text-sm"><b className="text-orange-300">{price}</b><span className="rounded-full border border-white/50 bg-white/25 px-3 py-1 text-xs font-bold text-white backdrop-blur-md transition group-hover:border-orange-400 group-hover:bg-orange-500 group-hover:shadow-lg group-hover:shadow-orange-500/40">{see} →</span></span>
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
  const { language, setLanguage } = useLanguage();
  const lang: ShopLang = shopLang(language);
  const T = SHOP_TEXT[lang];
  const eur = useCallback((c: number) => (c / 100).toLocaleString(LOCALE[lang], { style: "currency", currency: "EUR" }), [lang]);
  // Gadżety mają własną kartę (/shop/gadzety) — w głównym katalogu ich nie ma.
  const allProducts = useMemo(() => SHOP_PRODUCTS.map((p) => localizeProduct(p, lang)), [lang]);
  const products = useMemo(() => allProducts.filter((p) => SHOP_PRODUCTS.find((x) => x.id === p.id)?.cat !== "Gadżety"), [allProducts]);
  const cats = useMemo(() => [...new Set(SHOP_PRODUCTS.filter((p) => p.cat !== "Gadżety").map((p) => p.cat))], []);
  const [cat, setCat] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => products.filter((p) => !cat || SHOP_PRODUCTS.find((x) => x.id === p.id)?.cat === cat), [products, cat]);
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, setCart, bump, add, count, subtotal } = useShopCart();
  const S = STORE_TXT[lang];
  const [sort, setSort] = useState<"featured" | "asc" | "desc">("featured");
  const sorted = useMemo(() => (sort === "featured" ? shown : [...shown].sort((a, b) => (sort === "asc" ? a.eurCents - b.eurCents : b.eurCents - a.eurCents))), [shown, sort]);
  const hero = useMemo(() => products.find((p) => p.id === "bluza") ?? products.find((p) => p.video) ?? products[0], [products]);
  const tiles = useMemo(() => cats.map((c) => {
    const items = products.filter((p) => SHOP_PRODUCTS.find((x) => x.id === p.id)?.cat === c);
    const n = items.length;
    const word = lang === "pl" ? (n === 1 ? "produkt" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "produkty" : "produktów") : lang === "nl" ? (n === 1 ? "product" : "producten") : n === 1 ? "product" : "products";
    return { cat: c, label: localizeProduct(SHOP_PRODUCTS.find((x) => x.cat === c)!, lang).cat, img: items[0] ? productImg(items[0], 1) : "", count: `${n} ${word}` };
  }), [cats, products, lang]);
  // /shop?cart=1 (ze strony produktu) — od razu otwórz koszyk.
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get("cart") === "1");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string; bank: Bank | null; carrier?: string; point?: string | null } | null>(null);
  const [orders, setOrders] = useState<ShopOrderView[] | null>(null);
  const [invoices, setInvoices] = useState<Record<string, Record<string, unknown>>>({});
  const [payFor, setPayFor] = useState<Bank | null>(null);
  const [cfg, setCfg] = useState<ShopConfig | null>(null);
  const [gift, setGift] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [ship, setShip] = useState({ name: "", street: "", city: "", zip: "", country: lang === "nl" ? "NL" : lang === "pl" ? "PL" : "", phone: "", company: "", taxId: "", carrier: "", point: "" });
  const [ordersOpen, setOrdersOpen] = useState(false);
  // Esc zamyka koszyk i okno zamówień.
  useEffect(() => {
    if (!open && !ordersOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setOrdersOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, ordersOpen]);
  // Przewoźnicy dostępni w wybranym kraju; po zmianie kraju zły wybór się zeruje.
  const carrierOptions = useMemo(() => (ship.country ? carriersFor(ship.country) : []), [ship.country]);
  useEffect(() => {
    if (ship.carrier && !carrierOptions.some((c) => c.id === ship.carrier)) setShip((s) => ({ ...s, carrier: "", point: "" }));
  }, [carrierOptions, ship.carrier]);
  const carrierPrice = useCallback((id: string) => cfg?.carriers?.find((c) => c.id === id)?.cents ?? cfg?.shippingCents ?? 0, [cfg]);
  useEffect(() => { document.title = T.title; document.documentElement.lang = lang; }, [T, lang]);

  useEffect(() => {
    fetch("/api/shop-checkout").then((r) => (r.ok ? r.json() : null)).then((j: ShopConfig | null) => {
      setCfg(j);
      if (j) setMethod((m) => m ?? (j.stripe ? "card" : j.transfer ? "transfer" : null));
    }).catch(() => setCfg(null));
  }, []);

  // Najtańsza dostawa do paska zaufania (0 = gratis).
  const shipLabel = useMemo(() => {
    const prices = (cfg?.carriers ?? []).map((c) => c.cents);
    const min = prices.length ? Math.min(...prices) : (cfg?.shippingCents ?? 0);
    return min > 0 ? S.shipFrom.replace("{price}", eur(min)) : S.freeShip;
  }, [cfg, S, eur]);
  const quickAdd = useCallback((p: ShopProduct, size: string) => {
    const base = SHOP_PRODUCTS.find((x) => x.id === p.id);
    if (!base) return;
    add(base, size);
    toast.success(`${S.added}: ${p.name}${size ? ` (${size})` : ""}`, { action: { label: T.cart, onClick: () => setOpen(true) } });
  }, [add, S, T]);
  const shipCents = ship.carrier ? carrierPrice(ship.carrier) : (cfg?.shippingCents ?? 0);
  const total = subtotal + (cart.length ? shipCents : 0);

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
    const car = carrierById(ship.carrier);
    if (!car) { toast.error(T.errors.bad_carrier); return; }
    if (car.point && !isPointCode(ship.point)) { toast.error(T.errors.bad_point); return; }
    if (!agree) { toast.error(T.acceptTerms); return; }
    setBusy(true);
    try {
      const data = await api({ action: "create", items: cart.map((l) => ({ id: l.id, qty: l.qty, size: l.size })), shipping: ship, method, lang });
      if (data.payment === "stripe" && data.url) { window.location.href = data.url; return; }
      setCart([]); setOpen(false);
      setDone({ ref: data.ref ?? orderRef(String(data.orderId)), bank: data.payment === "transfer" ? data.bank : null, carrier: car.name, point: car.point ? ship.point : null });
      window.scrollTo({ top: 0, behavior: "smooth" });
      loadOrders();
    } catch (e) { toast.error((e as Error)?.message || T.errors.generic); }
    finally { setBusy(false); }
  };

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm(T.cancelAsk)) return;
    try {
      const j = await api({ action: "cancel", orderId });
      toast.success(j.state === "requested" ? T.cancelRequested : T.cancelDone);
      loadOrders();
    } catch (e) { toast.error((e as Error).message); }
  };
  const showPayInfo = async (orderId: string) => {
    try { const j = await api({ action: "payinfo", orderId }); setPayFor(j.bank); } catch (e) { toast.error((e as Error).message); }
  };
  const showInvoice = (orderId: string) => {
    const inv = invoices[orderId];
    if (!inv) return;
    openInvoice(invoiceHtml(inv as never, lang, { mode: cfg?.vatMode, exemptNote: cfg?.exemptNote }));
  };

  // Przycisk panelu widzi wyłącznie właściciel sklepu (nie każdy admin).
  const admin = user?.email?.toLowerCase() === SHOP_ADMIN_EMAIL;
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
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/shop" className="text-xl font-black tracking-tight sm:text-2xl">GROUA<span className="text-orange-500">ROCK</span></Link>
            <Link to="/" className="hidden text-sm text-neutral-500 transition hover:text-neutral-900 sm:inline">{T.back}</Link>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex h-10 items-center rounded-full border border-neutral-200 bg-white p-1" role="group" aria-label="Language">
              {SHOP_LANGS.map((l) => <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={lang === l} className={`h-8 rounded-full px-2.5 text-xs font-bold uppercase transition ${lang === l ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"}`}>{l}</button>)}
            </div>
            {admin && <button type="button" onClick={() => navigate("/admin?tab=shop")} className="h-10 rounded-full bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600">{T.admin}</button>}
            {user && <button type="button" onClick={() => { setOrdersOpen(true); loadOrders(); }} aria-label={T.myOrders} title={T.myOrders} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-sm font-semibold transition hover:border-orange-400 hover:text-orange-700"><Package className="h-4 w-4" aria-hidden="true" /><span className="hidden md:inline">{T.myOrders}</span>{orders && orders.length ? <span className="text-xs text-neutral-500">({orders.length})</span> : null}</button>}
            {user
              ? <button type="button" onClick={() => signOut()} aria-label={T.logout} title={user.email ?? T.logout} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-sm transition hover:border-neutral-400"><LogOut className="h-4 w-4" aria-hidden="true" /><span className="hidden md:inline">{T.logout}</span></button>
              : <button type="button" onClick={() => navigate("/auth?next=/shop")} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-neutral-900 px-3 text-sm font-semibold transition hover:bg-neutral-900 hover:text-white sm:px-4"><User className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{T.login}</span></button>}
            <button type="button" onClick={() => setOpen(true)} aria-label={`${T.cart} (${count})`} className="relative inline-flex h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-orange-500">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{T.cart}</span>
              <motion.span key={count} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold">{count}</motion.span>
            </button>
          </div>
        </div>
      </header>

      <MotionConfig reducedMotion="user">
      <StoreHero t={S} lang={lang} onShop={() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} heroId={hero.id} heroName={hero.name} heroPrice={eur(hero.eurCents)} />
      {done && (
        <div className="mx-auto max-w-6xl space-y-3 px-4 pb-8">
          <p className="rounded-xl bg-orange-50 p-4 text-orange-900"><b>{T.orderAccepted.replace("{id}", done.ref)}</b>{!done.bank && <> {T.linkSoon.replace("{email}", user?.email ? ` (${user.email})` : "")}</>}{done.carrier && <span className="mt-1 block">🚚 {T.deliveryBy}: <b>{done.carrier}</b>{done.point ? ` · ${done.point}` : ""}</span>}</p>
          {done.bank && <TransferBox bank={done.bank} t={T} eur={eur} />}
        </div>
      )}
      <TrustBar t={S} ship={shipLabel} />

      <section className="mx-auto max-w-6xl px-4 pt-6" aria-label={lang === "pl" ? "Gadżety" : "Gadgets"}>
        <Link to="/shop/gadzety" className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl bg-[#07070c] p-5 text-white shadow-xl sm:p-7">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(50% 80% at 10% 20%, #ff7a1a33, transparent 70%), radial-gradient(50% 80% at 90% 80%, #c026d333, transparent 70%)" }} />
          <span className="relative">
            <b className="block text-2xl font-black sm:text-3xl">✨ {lang === "pl" ? "Gadżety" : "Gadgets"}</b>
            <span className="mt-1 block max-w-sm text-sm text-white/70">{lang === "pl" ? "Słuchawki, projektor galaktyki, pad, klawiatura MIDI — obejrzyj w 3D." : lang === "nl" ? "Koptelefoons, sterrenprojector, controller, MIDI-keyboard — bekijk ze in 3D." : "Headphones, galaxy projector, controller, MIDI keyboard — see them in 3D."}</span>
          </span>
          <span className="relative flex shrink-0 -space-x-6" aria-hidden="true">
            {SHOP_PRODUCTS.filter((p) => p.cat === "Gadżety").slice(0, 4).map((p, i) => <img key={p.id} src={productImg(p, 1)} alt="" loading="lazy" className="h-16 w-16 rounded-2xl border border-white/20 object-cover shadow-lg transition duration-500 group-hover:-translate-y-1 sm:h-24 sm:w-24" style={{ transform: `rotate(${(i - 1.5) * 7}deg)` }} />)}
          </span>
        </Link>
      </section>
      <CollectionSets lang={lang} products={allProducts} eur={eur} onPick={(c) => { setCat(c); requestAnimationFrame(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
      <CategoryTiles t={S} tiles={tiles} onPick={(c) => { setCat(c); requestAnimationFrame(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />

      <section className="mx-auto max-w-6xl pt-14" aria-label={T.inMotion}>
        <h2 className="mb-4 px-4 text-2xl font-black tracking-tight sm:text-3xl">{T.inMotion}</h2>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          {products.filter((p) => p.video).map((p) => (
            <VideoTile key={p.id} p={p} price={eur(p.eurCents)} see={T.see} onOpen={() => navigate(`/shop/p/${p.id}`)} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14" aria-label={T.collection}>
        <div ref={gridRef} className="scroll-mt-20" />
        <div className="z-30 -mx-4 mb-6 md:sticky md:top-[64px] border-b border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{T.collection} <span className="text-base font-semibold text-neutral-400">({shown.length})</span></h2>
            <label className="flex items-center gap-2 text-sm text-neutral-500">{S.sort}
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 rounded-full border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900">
                <option value="featured">{S.sortFeatured}</option><option value="asc">{S.sortAsc}</option><option value="desc">{S.sortDesc}</option>
              </select>
            </label>
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={T.collection}>
            {["", ...cats].map((c) => (
              <button key={c || "all"} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
                className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 ${cat === c
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-orange-400 hover:text-orange-700"}`}>
                {c ? localizeProduct(SHOP_PRODUCTS.find((x) => x.cat === c)!, lang).cat : T.all}
              </button>))}
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
          {sorted.map((p, i) => (
            <ProductCard key={`${cat}-${sort}-${p.id}`} p={p} index={i} price={eur(p.eurCents)} t={S} videoLabel={T.video} onAdd={quickAdd} />
          ))}
        </ul>
      </section>

      <StoreFaq t={S} days={cfg?.deliveryDays ?? "5–14"} />
      </MotionConfig>

      <div className="pb-16" />

      <footer className="border-t border-neutral-200 bg-white px-4 py-10 text-sm text-neutral-600">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          <div>
            <p className="text-lg font-black text-neutral-900">GROUA<span className="text-orange-500">ROCK</span></p>
            {cfg?.seller ? <p className="mt-2">{cfg.seller.name}<br />{cfg.seller.address}</p> : cfg?.contact?.name ? <p className="mt-2">{cfg.contact.name}</p> : null}
          </div>
          <nav className="flex flex-col gap-2" aria-label={T.terms}>
            <Link to="/shop/terms" className="hover:text-neutral-900">{T.terms}</Link>
            <Link to="/legal" className="hover:text-neutral-900">Privacy</Link>
            <Link to="/" className="hover:text-neutral-900">{T.back}</Link>
          </nav>
          <div>
            {(cfg?.seller?.email || cfg?.contact?.email) && <a href={`mailto:${cfg.seller?.email || cfg.contact?.email}`} className="font-semibold text-neutral-900 underline-offset-4 hover:underline">{T.contact}: {cfg.seller?.email || cfg.contact?.email}</a>}
            <p className="mt-2 text-xs text-neutral-500">{T.vatIncl}</p>
          </div>
        </div>
      </footer>

      {ordersOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setOrdersOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={T.myOrders} onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-black">📦 {T.myOrders}</h2><button type="button" onClick={() => setOrdersOpen(false)} aria-label={T.close} className="h-10 w-10 rounded-full border border-neutral-300 transition hover:border-orange-400 hover:bg-orange-50">✕</button></div>
            <div className="mt-3 flex-1 space-y-3 overflow-auto">
              {payFor && <TransferBox bank={payFor} t={T} eur={eur} onClose={() => setPayFor(null)} />}
              {orders === null ? <p className="text-neutral-500">{T.ordersLoading}</p> : orders.length === 0 ? <p className="text-neutral-500">{T.noOrders}</p> : orders.map((o) => {
                const tr = o.tracking; const url = tr ? trackingUrl(tr.carrier, tr.number) : null;
                const car = carrierById(tr?.carrier ?? o.shipping?.carrier);
                return (
                  <div key={o.id} className="rounded-2xl border border-neutral-200 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>#{orderRef(o.id)}</b>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${o.status === "shipped" ? "bg-emerald-100 text-emerald-800" : o.status === "paid" ? "bg-sky-100 text-sky-800" : o.status === "new" ? "bg-orange-100 text-orange-800" : "bg-neutral-100 text-neutral-700"}`}>{T.status[o.status] ?? o.status}</span>
                    </div>
                    <p className="mt-1 text-neutral-500">{new Date(o.created_at).toLocaleDateString(LOCALE[lang])} · {eur(o.total_cents)}</p>
                    <ul className="mt-2 space-y-0.5">{o.items.map((i, k) => <li key={k}>{i.qty} × {i.name}{i.size ? ` (${i.size})` : ""}</li>)}</ul>
                    {car && <p className="mt-2 text-neutral-600">🚚 {car.name}{o.shipping?.point ? ` · ${o.shipping.point}` : ""}{tr ? ` · ${T.parcel}: ${tr.number}` : ""}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full bg-orange-500 px-4 text-xs font-bold text-white transition hover:bg-orange-600">{T.track} ↗</a>}
                      {(o.status === "new" || o.status === "paid") && !o.tracking && !o.cancelRequested && (
                        <button type="button" onClick={() => cancelOrder(o.id)} className="h-9 rounded-full border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50">{T.cancelOrder}</button>)}
                      {o.cancelRequested && o.status !== "cancelled" && <span className="inline-flex h-9 items-center rounded-full bg-red-50 px-3 text-xs font-semibold text-red-700">{T.cancelPending}</span>}
                      {o.payment_status !== "paid" && o.status === "new" && cfg?.transfer && <button type="button" onClick={() => showPayInfo(o.id)} className="h-9 rounded-full border border-neutral-300 px-3 text-xs transition hover:border-orange-400 hover:bg-orange-50">{T.howToPay}</button>}
                      {invoices[o.id] && <button type="button" onClick={() => showInvoice(o.id)} className="h-9 rounded-full border border-neutral-300 px-3 text-xs transition hover:border-orange-400 hover:bg-orange-50">{T.invoice}</button>}
                    </div>
                  </div>);
              })}
            </div>
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />}
      <aside className={`fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-md flex-col bg-white p-5 shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`} aria-label={T.cart} aria-hidden={!open} {...(!open ? { inert: "" } : {})}>
        <div className="flex items-center justify-between"><h2 className="text-2xl font-black">{T.cart}</h2><button type="button" onClick={() => setOpen(false)} aria-label={T.close} className="h-10 w-10 rounded-full border border-neutral-300">✕</button></div>
        <div className="mt-3 flex-1 space-y-3 overflow-auto">
          {cart.length === 0 && <p className="text-neutral-500">{T.emptyCart}</p>}
          {cart.map((l, i) => { const p = localizeProduct(byId[l.id], lang); return (
            <div key={l.id + l.size} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-neutral-200 pb-3">
              <img src={productImg(p, 1)} alt="" className="h-14 w-14 rounded-lg object-cover" />
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
              <fieldset className="space-y-2 pt-2"><legend className="font-bold">🚚 {T.carrierTitle}</legend>
                {!ship.country ? <p className="text-xs text-neutral-500">{T.pickCountryFirst}</p> : (
                  <div className="grid grid-cols-2 gap-2">
                    {carrierOptions.map((c) => {
                      const cents = carrierPrice(c.id);
                      const on = ship.carrier === c.id;
                      return (
                        <label key={c.id} className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 text-sm transition ${on ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-neutral-300 hover:border-orange-400"}`}>
                          <span className="flex items-center gap-2"><input type="radio" name="carrier" checked={on} onChange={() => setShip({ ...ship, carrier: c.id })} className="h-4 w-4 accent-orange-500" /><span aria-hidden="true">{c.logo}</span><b className="leading-tight">{c.name}</b></span>
                          <span className="pl-6 text-xs text-neutral-500">{cents ? eur(cents) : T.free}</span>
                        </label>);
                    })}
                  </div>)}
                {carrierById(ship.carrier)?.point && (
                  <div className="space-y-1">
                    <input className={inp} placeholder={T.pointLabel} aria-label={T.pointLabel} value={ship.point} maxLength={12} onChange={(e) => setShip({ ...ship, point: e.target.value.toUpperCase() })} />
                    <a href={INPOST_MAP_URL} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-orange-600 underline underline-offset-2">{T.pointMap} ↗</a>
                  </div>)}
              </fieldset>
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
        {cart.length > 0 && ship.carrier && <div className="flex justify-between pt-3 text-sm text-neutral-600"><span>{T.shipping} · {carrierById(ship.carrier)?.name}</span><span>{shipCents ? eur(shipCents) : T.free}</span></div>}
        <div className="flex justify-between border-t border-neutral-200 py-3 text-xl font-black"><span>{T.total}</span><span>{eur(total)}</span></div>
        <p className="-mt-2 pb-2 text-xs text-neutral-500">{T.vatIncl}</p>
        <button type="button" disabled={busy || !cart.length} onClick={checkout} className="h-12 rounded-full bg-neutral-900 font-bold text-white transition hover:bg-orange-500 disabled:opacity-50">{buttonLabel}</button>
        {!user && <p className="mt-2 text-xs text-neutral-500">{T.sameAccount}</p>}
        {user && methods.length === 0 && cart.length > 0 && <p className="mt-2 text-xs text-neutral-500">{T.linkByEmail}</p>}
      </aside>
    </div>
  );
}
