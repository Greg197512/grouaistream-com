/**
 * Obieg zlecenia B2B — maile i dane płatności (statusy admin zapisuje bezpośrednio w bazie, RLS admina).
 *
 * POST (Authorization: Bearer <token Supabase>):
 *  - { action:"payinfo", orderId }        klient: dane do zapłaty (Revolut QR / IBAN) za własną ofertę
 *  - { action:"accept", orderId }         klient: akceptuje ofertę → mail do zespołu (+ status confirmed, gdy RLS pozwala)
 *  - { action:"paid-notice", orderId }    klient: „Zapłaciłem” → mail do zespołu
 *  - { action:"notify", orderId, event }  admin: mail do klienta po zmianie (offer | paid | started | progress | completed | cancelled)
 * Wysyłka: ten sam transport co reszta maili (mailConfigFromEnv — bez kluczy przez główny projekt). Bez kosztów.
 */
import { env, esc, getUser, isAdmin, json, rest, supa } from "../src/lib/serverSupa";
import { mailConfigFromEnv, sendMail } from "../src/lib/shopMail";
import { b2bRef, B2B_STATUS_LABEL } from "../src/lib/b2b";

export const config = { runtime: "edge" };

type Order = {
  id: string; user_id: string | null; service_type: string | null; brief: string | null; status: string | null;
  payment_status: string | null; price_eur: number | null; deadline: string | null; progress_pct: number | null;
  result_url: string | null; client_email: string | null; client_name: string | null; notes: string | null;
};
const COLS = "id,user_id,service_type,brief,status,payment_status,price_eur,deadline,progress_pct,result_url,client_email,client_name,notes";
const SITE = "https://grouaistream.com";

function frame(title: string, body: string, orderId?: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0712;font:15px/1.6 Arial,sans-serif;color:#18181b">
<div style="max-width:600px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:18px;padding:28px">
<div style="font-weight:900;font-size:20px;margin-bottom:6px">GrouAI <span style="color:#f97316">Business</span></div>
<h1 style="font-size:20px;margin:8px 0 12px">${esc(title)}</h1>${body}
<p style="margin-top:20px"><a href="${SITE}/client-dashboard${orderId ? `/${orderId}` : ""}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">Otwórz panel klienta</a></p>
</div><p style="color:#a1a1aa;font-size:12px;text-align:center;margin-top:16px">GrouAI Stream · Aurora B2B · odpowiedz na tę wiadomość, jeśli masz pytania</p></div></body></html>`;
}
const money = (v: number | null) => (v == null ? "—" : `${Number(v).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`);
const briefBox = (o: Order) => `<div style="background:#f4f4f5;border-radius:12px;padding:14px;margin:12px 0">${esc(o.brief ?? "").replace(/\n/g, "<br>")}</div>`;

function bank() {
  const revolut = env("SHOP_REVOLUT_LINK") ?? null;
  const iban = env("SHOP_BANK_IBAN") ?? null;
  if (!revolut && !iban) return null;
  return { revolut, iban, holder: env("SHOP_BANK_HOLDER") ?? null, bic: env("SHOP_BANK_BIC") ?? null };
}

async function loadOrder(auth: string, id: string, ownerId?: string): Promise<Order | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const own = ownerId ? `&user_id=eq.${ownerId}` : "";
  const r = await rest(auth, `aurora_business_orders?id=eq.${id}${own}&service_type=neq.shop&select=${COLS}&limit=1`);
  return Array.isArray(r.data) ? ((r.data[0] as Order) ?? null) : null;
}

function clientMail(o: Order, event: string): { subject: string; html: string } | null {
  const ref = b2bRef(o.id);
  const b = bank();
  const pay = b ? `<p><b>Do zapłaty:</b> ${money(o.price_eur)} · tytuł przelewu: <b>${ref}</b><br>
Zapłać w panelu klienta (kod QR Revolut)${b.iban ? ` albo przelewem na ${esc(b.iban)}${b.holder ? ` (${esc(b.holder)})` : ""}` : ""}.</p>` : "";
  switch (event) {
    case "offer":
      return { subject: `Oferta do zlecenia ${ref} — ${money(o.price_eur)}`, html: frame("Twoja oferta jest gotowa", `<p>Przygotowaliśmy wycenę Twojego zlecenia (${esc(o.service_type)}).</p>${briefBox(o)}
<p><b>Cena:</b> ${money(o.price_eur)}${o.deadline ? `<br><b>Termin:</b> ${new Date(o.deadline).toLocaleDateString("pl-PL")}` : ""}</p>
${o.notes ? `<p>${esc(o.notes).replace(/\n/g, "<br>")}</p>` : ""}${pay}<p>Akceptujesz? Kliknij „Akceptuję i płacę” w panelu klienta.</p>`, o.id) };
    case "paid":
      return { subject: `Płatność za ${ref} potwierdzona`, html: frame("Dziękujemy — płatność potwierdzona", `<p>Otrzymaliśmy ${money(o.price_eur)}. Zaczynamy pracę nad zleceniem — postęp zobaczysz w panelu.</p>`, o.id) };
    case "started":
      return { subject: `Zlecenie ${ref} w realizacji`, html: frame("Ruszyliśmy z realizacją", `<p>Twoje zlecenie jest w realizacji${o.deadline ? ` — planowany termin: ${new Date(o.deadline).toLocaleDateString("pl-PL")}` : ""}.</p>${briefBox(o)}`, o.id) };
    case "progress":
      return { subject: `Postęp zlecenia ${ref}: ${o.progress_pct ?? 0}%`, html: frame(`Postęp: ${o.progress_pct ?? 0}%`, `<p>Aktualny stan: <b>${esc(B2B_STATUS_LABEL[o.status ?? ""] ?? o.status)}</b>, ${o.progress_pct ?? 0}% gotowe.</p>`, o.id) };
    case "completed":
      return { subject: `Zlecenie ${ref} gotowe 🎉`, html: frame("Gotowe!", `<p>Twoje zlecenie jest ukończone.</p>${o.result_url ? `<p><a href="${esc(o.result_url)}" style="color:#f97316;font-weight:700">Pobierz wynik</a></p>` : ""}<p>Dziękujemy za współpracę!</p>`, o.id) };
    case "cancelled":
      return { subject: `Zlecenie ${ref} anulowane`, html: frame("Zlecenie anulowane", `<p>Zlecenie zostało anulowane. Jeśli to pomyłka — odpowiedz na tę wiadomość.</p>`, o.id) };
    default:
      return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!supa()) return json({ ok: false, error: "Brak konfiguracji Supabase" }, 500);
  const auth = req.headers.get("authorization") ?? "";
  const user = await getUser(auth);
  if (!user) return json({ ok: false, error: "Zaloguj się" }, 401);
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* */ }
  const action = String(body.action ?? "");
  const orderId = String(body.orderId ?? "");
  const cfg = mailConfigFromEnv(env, "GrouAI Business");
  const notify = env("SHOP_NOTIFY_EMAIL");

  if (action === "payinfo" || action === "accept" || action === "paid-notice") {
    const o = await loadOrder(auth, orderId, user.id);
    if (!o) return json({ ok: false, error: "Nie znaleziono zlecenia" }, 404);
    const ref = b2bRef(o.id);
    if (action === "payinfo") {
      if (!o.price_eur) return json({ ok: false, error: "Oferta nie jest jeszcze gotowa" }, 409);
      return json({ ok: true, ref, amount: o.price_eur, bank: bank() });
    }
    if (action === "accept") {
      if (o.status !== "offer_sent") return json({ ok: false, error: "Brak oferty do akceptacji" }, 409);
      // Status zmieniamy, jeśli RLS pozwala klientowi; mail do zespołu idzie zawsze.
      const up = await rest(auth, `aurora_business_orders?id=eq.${o.id}&user_id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
      const saved = up.ok && Array.isArray(up.data) && up.data.length > 0;
      if (cfg && notify) await sendMail(cfg, { to: notify, key: `b2b-accept-${o.id}`, subject: `✅ Klient akceptuje ofertę ${ref} (${money(o.price_eur)})`,
        html: frame("Oferta zaakceptowana", `<p>${esc(o.client_name || user.name || "Klient")} &lt;${esc(o.client_email || user.email)}&gt; akceptuje ofertę ${ref}.</p>${briefBox(o)}<p>Czekaj na wpłatę z tytułem <b>${ref}</b>, potem „Opłacone” w panelu admina.</p>`, o.id) });
      return json({ ok: true, saved });
    }
    if (cfg && notify) await sendMail(cfg, { to: notify, key: `b2b-paid-${o.id}-${new Date().toISOString().slice(0, 13)}`,
      subject: `💸 Klient zgłasza wpłatę ${ref} (${money(o.price_eur)})`,
      html: frame("Zgłoszona wpłata", `<p>Sprawdź w Revolut wpłatę z tytułem <b>${ref}</b> na ${money(o.price_eur)}. Jeśli jest — ustaw „Opłacone” w panelu admina (klient dostanie potwierdzenie).</p>`, o.id) });
    return json({ ok: true });
  }

  if (action === "notify") {
    if (!(await isAdmin(auth, user.id))) return json({ ok: false, error: "Tylko admin" }, 403);
    const o = await loadOrder(auth, orderId);
    if (!o) return json({ ok: false, error: "Nie znaleziono zlecenia" }, 404);
    const to = o.client_email && /@/.test(o.client_email) ? o.client_email : null;
    const m = clientMail(o, String(body.event ?? ""));
    if (!m) return json({ ok: false, error: "Nieznane zdarzenie" }, 400);
    if (!to || !cfg) return json({ ok: false, error: to ? "Wysyłka nieskonfigurowana" : "Zlecenie nie ma e-maila klienta" }, 409);
    const sent = await sendMail(cfg, { to, replyTo: notify, ...m });
    return json({ ok: sent, ...(sent ? {} : { error: "Serwer pocztowy odrzucił wiadomość" }) });
  }
  return json({ ok: false, error: "Nieznana akcja" }, 400);
}
