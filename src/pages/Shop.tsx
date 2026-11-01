import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getPaddleEnvironment, initializePaddle } from "@/lib/paddle";
import { SHOP_ADMIN_EMAIL, SHOP_PRODUCTS, type ShopProduct } from "@/data/shopCatalog";
import { toast } from "sonner";
import { XmasDecor } from "@/components/shop/XmasDecor";
import { GiftCelebration } from "@/components/shop/GiftCelebration";

type Line = { id: string; size: string; qty: number };
const CART_KEY = "gr_cart_v2";
const eur = (c: number) => (c / 100).toLocaleString("pl-PL", { style: "currency", currency: "EUR" });
const byId = Object.fromEntries(SHOP_PRODUCTS.map((p) => [p.id, p])) as Record<string, ShopProduct>;

function Card({ p, onAdd }: { p: ShopProduct; onAdd: (p: ShopProduct, size: string) => void }) {
  const [view, setView] = useState(0);
  const [size, setSize] = useState("M");
  const [tilt, setTilt] = useState("");
  const vid = useRef<HTMLVideoElement>(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => { const v = vid.current; if (!v) return; if (view === 2) v.play().catch(() => {}); else v.pause(); }, [view]);
  const imgs = [`/shop/${p.id}-1.jpg`, `/shop/${p.id}-2.jpg`];
  return (
    <article className="grid md:grid-cols-2 gap-8 items-center">
      <div>
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-100 cursor-zoom-in" style={{ perspective: 900 }}
          onPointerMove={(e) => { if (e.pointerType === "touch") return; const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; setTilt(`rotateY(${x * 22}deg) rotateX(${-y * 16}deg) scale(1.05)`); }}
          onPointerLeave={() => setTilt("")} onClick={() => setZoom(true)}>
          <div className="absolute inset-0 transition-transform duration-200" style={{ transform: tilt }}>
            <img src={imgs[0]} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            <img src={imgs[1]} alt={`${p.name} widok 2`} loading="lazy" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${view === 1 ? "opacity-100" : "opacity-0"}`} />
            {p.video && <video ref={vid} src={`/shop/${p.id}.mp4`} muted loop playsInline preload="none" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${view === 2 ? "opacity-100" : "opacity-0"}`} />}
          </div>
          {p.tag && <span className="absolute top-3 left-3 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{p.tag}</span>}
        </div>
        <div className="flex gap-2 mt-2">
          {[0, 1, ...(p.video ? [2] : [])].map((k) => (
            <button key={k} type="button" aria-label={k === 2 ? "Film" : `Widok ${k + 1}`} onClick={() => setView(k)} className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 ${view === k ? "border-orange-500" : "border-neutral-200"}`}>
              <img src={imgs[k === 1 ? 1 : 0]} alt="" className="h-full w-full object-cover" />
              {k === 2 && <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">▶</span>}
            </button>
          ))}
        </div>
        {zoom && (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-white/95 backdrop-blur" onClick={() => setZoom(false)} role="dialog" aria-label={p.name}>
            <img src={imgs[view === 1 ? 1 : 0]} alt={p.name} className="max-h-[88vh] max-w-[92vw] rounded-2xl shadow-2xl" />
            <button className="absolute top-4 right-4 h-12 w-12 rounded-full border border-neutral-900 bg-white text-xl" aria-label="Zamknij">✕</button>
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">{p.cat}</p>
        <h3 className="text-3xl font-black leading-tight">{p.name}</h3>
        <p className="mt-1 text-xl font-extrabold">{p.pln} zł <span className="text-neutral-500 font-semibold">· {eur(p.eurCents)}</span></p>
        <p className="mt-3">{p.desc}</p>
        {p.use && <p className="mt-2 text-neutral-500"><b>Do czego:</b> {p.use}</p>}
        <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 text-sm">{p.spec.map((s) => <li key={s} className="py-2">{s}</li>)}</ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {p.sizes && <select value={size} onChange={(e) => setSize(e.target.value)} aria-label="Rozmiar" className="h-11 rounded-full border border-neutral-300 bg-white px-4">{["S", "M", "L", "XL", "XXL"].map((s) => <option key={s}>{s}</option>)}</select>}
          <button type="button" onClick={() => onAdd(p, size)} className="h-11 rounded-full bg-neutral-900 px-6 font-semibold text-white transition hover:bg-orange-500">{p.preorder ? "Zamów z wyprzedzeniem" : "Dodaj do koszyka"}</button>
        </div>
      </div>
    </article>
  );
}

export default function Shop() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Line[]>(() => { try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; } });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[] | null>(null);
  const [gift, setGift] = useState<string | null>(null);
  const [ship, setShip] = useState({ name: "", street: "", city: "", zip: "", country: "", phone: "" });
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* */ } }, [cart]);
  useEffect(() => { document.title = "Sklep Grouarock | Grouaistream"; }, []);

  const total = useMemo(() => cart.reduce((a, l) => a + byId[l.id].eurCents * l.qty, 0), [cart]);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const add = (p: ShopProduct, size: string) => {
    setCart((c) => { const k = c.find((l) => l.id === p.id && l.size === (p.sizes ? size : "")); return k ? c.map((l) => (l === k ? { ...l, qty: l.qty + 1 } : l)) : [...c, { id: p.id, size: p.sizes ? size : "", qty: 1 }]; });
    toast.success("Dodano do koszyka"); setOpen(true);
  };
  const bump = (i: number, d: number) => setCart((c) => c.flatMap((l, k) => (k !== i ? [l] : l.qty + d < 1 ? [] : [{ ...l, qty: l.qty + d }])));

  const loadOrders = useCallback(async () => {
    if (!user) return setOrders(null);
    const { data } = await (supabase as any).from("shop_orders").select("id,total_cents,status,created_at,items").order("created_at", { ascending: false }).limit(20);
    setOrders(data ?? []);
  }, [user]);
  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("paid")) { toast.success("Dziękujemy! Płatność przyjęta."); setCart([]); } }, []);

  // Bilet VIP pojawia się, gdy zamówienie zostanie opłacone (webhook albo admin) — pokaż fanfary.
  const checkGift = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("gift_codes").select("code").eq("owner_user_id", user.id).is("redeemed_by", null).order("created_at", { ascending: false }).limit(5);
    for (const g of data ?? []) {
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
    if (!Object.values({ ...ship, phone: "x" }).every((v) => String(v).trim().length > 1)) { toast.error("Uzupełnij adres wysyłki"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("shop-checkout", { body: { items: cart.map((l) => ({ id: l.id, qty: l.qty, size: l.size })), shipping: ship, environment: getPaddleEnvironment() } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Błąd zamówienia");
      if (data.payment === "paddle" && data.transactionId) {
        await initializePaddle();
        window.Paddle.Checkout.open({ transactionId: data.transactionId, customer: user.email ? { email: user.email } : undefined, settings: { displayMode: "overlay", successUrl: `${window.location.origin}/shop?paid=1`, allowLogout: false } });
      } else { setCart([]); setDone(String(data.orderId).slice(0, 8)); setOpen(false); }
      loadOrders();
    } catch (e: any) { toast.error(e?.message || "Nie udało się złożyć zamówienia"); }
    finally { setBusy(false); }
  };

  const admin = isAdmin || user?.email === SHOP_ADMIN_EMAIL;
  const inp = "h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm w-full";
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white text-neutral-900" style={{ colorScheme: "light" }}>
      <XmasDecor />
      {gift && <GiftCelebration code={gift} onClose={() => setGift(null)} onGo={() => { setGift(null); navigate("/"); toast.info("Wklej kod w pasku wyszukiwania i naciśnij Enter"); }} />}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-4"><span className="text-2xl font-black">GROUA<span className="text-orange-500">ROCK</span></span><Link to="/" className="text-sm text-neutral-600 hover:text-neutral-900">← Grouaistream</Link></div>
        <div className="flex flex-wrap items-center gap-2">
          {admin && <button type="button" onClick={() => navigate("/admin?tab=shop")} className="h-11 rounded-full bg-orange-500 px-5 text-sm font-bold text-white">Panel admina</button>}
          {user ? (<><span className="hidden text-sm text-neutral-600 sm:inline">{user.email}</span><button type="button" onClick={() => signOut()} className="h-11 rounded-full border border-neutral-300 px-4 text-sm">Wyloguj</button></>)
            : <button type="button" onClick={() => navigate("/auth?next=/shop")} className="h-11 rounded-full border border-neutral-900 px-5 text-sm font-semibold">Zaloguj się</button>}
          <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white">Koszyk ({count})</button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-6 pt-14">
        <p className="mb-2 text-sm font-bold uppercase tracking-[.25em] text-red-600">🎄 Świąteczna edycja · Drop 01</p>
        <h1 className="text-5xl font-black leading-none sm:text-7xl">Noś swój <span className="bg-gradient-to-r from-red-600 via-orange-500 to-pink-500 bg-clip-text text-transparent">dźwięk.</span></h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-600">Odzież, dodatki i gadżety AI od Grouarock. Jedno konto z Grouaistream. Każdy zakup daje bilet z kodem: VIP w Grouaistream na 30 dni za darmo.</p>
        {done && <p className="mt-4 rounded-xl bg-orange-50 p-4 text-orange-900">Zamówienie #{done} przyjęte. Link do płatności wyślemy na Twój e-mail.</p>}
      </section>

      <main className="mx-auto max-w-5xl space-y-20 px-4 pb-24">
        {SHOP_PRODUCTS.map((p) => <Card key={p.id} p={p} onAdd={add} />)}
        {user && orders && orders.length > 0 && (
          <section><h2 className="mb-4 text-3xl font-black">Moje zamówienia</h2>
            <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">{orders.map((o) => <li key={o.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm"><span>#{String(o.id).slice(0, 8)} · {new Date(o.created_at).toLocaleDateString("pl-PL")}</span><span>{eur(o.total_cents)} · {o.status}</span></li>)}</ul></section>
        )}
      </main>

      {open && <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />}
      <aside className={`fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-md flex-col bg-white p-5 shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`} aria-label="Koszyk">
        <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Koszyk</h2><button type="button" onClick={() => setOpen(false)} aria-label="Zamknij" className="h-10 w-10 rounded-full border border-neutral-300">✕</button></div>
        <div className="mt-3 flex-1 space-y-3 overflow-auto">
          {cart.length === 0 && <p className="text-neutral-500">Koszyk jest pusty.</p>}
          {cart.map((l, i) => { const p = byId[l.id]; return (
            <div key={l.id + l.size} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-neutral-200 pb-3">
              <img src={`/shop/${p.id}-1.jpg`} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <div className="text-sm"><b>{p.name}</b><br /><span className="text-neutral-500">{l.size ? `Rozmiar ${l.size} · ` : ""}{eur(p.eurCents)}</span></div>
              <div className="flex items-center gap-1"><button type="button" onClick={() => bump(i, -1)} aria-label="Mniej" className="h-8 w-8 rounded-lg border border-neutral-300">−</button><span className="w-5 text-center">{l.qty}</span><button type="button" onClick={() => bump(i, 1)} aria-label="Więcej" className="h-8 w-8 rounded-lg border border-neutral-300">+</button></div>
            </div>); })}
          {cart.length > 0 && user && (
            <div className="space-y-2 pt-2"><h3 className="font-bold">Adres wysyłki</h3>
              {([["name", "Imię i nazwisko"], ["street", "Ulica i numer"], ["zip", "Kod pocztowy"], ["city", "Miasto"], ["country", "Kraj"], ["phone", "Telefon (opcjonalnie)"]] as const).map(([k, ph]) => (
                <input key={k} className={inp} placeholder={ph} aria-label={ph} value={(ship as any)[k]} onChange={(e) => setShip({ ...ship, [k]: e.target.value })} />))}
            </div>)}
        </div>
        <div className="flex justify-between border-t border-neutral-200 py-3 text-xl font-black"><span>Razem</span><span>{eur(total)}</span></div>
        <button type="button" disabled={busy || !cart.length} onClick={checkout} className="h-12 rounded-full bg-neutral-900 font-bold text-white transition hover:bg-orange-500 disabled:opacity-50">{busy ? "Przetwarzanie…" : user ? "Zamawiam i płacę" : "Zaloguj się, aby kupić"}</button>
        {!user && <p className="mt-2 text-xs text-neutral-500">Używasz tego samego konta co w Grouaistream.</p>}
      </aside>
    </div>
  );
}
