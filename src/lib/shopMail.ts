// E-maile sklepu GrouaDrop: szablony (PL/EN/NL) i wysyłka przez HTTP (Resend albo Brevo), działa na edge.
import { orderRef, type PricedLine, type Shipping } from "./shopOrder";

export type MailCfg = { provider: "resend" | "brevo"; key: string; from: string; fromName: string };
export type Mail = { to: string; subject: string; html: string; replyTo?: string };
type Lang = "pl" | "en" | "nl";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const LOC: Record<Lang, string> = { pl: "pl-PL", en: "en-GB", nl: "nl-NL" };
const money = (cents: number, lang: Lang = "pl") => (cents / 100).toLocaleString(LOC[lang], { style: "currency", currency: "EUR" });

const wrap = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#f4f4f5;font:15px/1.5 Arial,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:16px;padding:24px">
<div style="font-weight:900;font-size:20px;margin-bottom:12px">GROUA<span style="color:#f97316">DROP</span></div>
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${body}</div>
<p style="color:#71717a;font-size:12px;text-align:center">grouaistream.com/shop</p></div></body></html>`;

const itemsTable = (lines: PricedLine[], lang: Lang) => `<table style="width:100%;border-collapse:collapse;margin:12px 0">${lines.map((l) =>
  `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${l.qty} × ${esc(l.name)}${l.size ? ` (${esc(l.size)})` : ""}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${money(l.unitCents * l.qty, lang)}</td></tr>`).join("")}</table>`;
const address = (s: Shipping) => `${esc(s.name)}${s.company ? `, ${esc(s.company)}` : ""}<br>${esc(s.street)}<br>${esc(s.zip)} ${esc(s.city)}, ${esc(s.country)}${s.phone ? `<br>tel. ${esc(s.phone)}` : ""}`;

const C = {
  pl: { paidS: "Płatność przyjęta: zamówienie {ref}", paidT: "Dziękujemy! Zamówienie przyjęte do realizacji", paidB: "Twoje zamówienie trafiło do produkcji. Wysyłka zwykle w ciągu {days} dni roboczych. Gdy paczka wyruszy, dostaniesz e-mail.", newS: "Zamówienie {ref}: dane do przelewu", newT: "Zamówienie przyjęte. Czekamy na przelew", newB: "Zapłać przez Revolut (aplikacja albo karta): kliknij przycisk, wpisz dokładną kwotę, a w notatce numer zamówienia. Zaczniemy realizację po otrzymaniu wpłaty.", total: "Razem", ship: "Adres dostawy", holder: "Odbiorca", amount: "Kwota", ref: "Notatka", help: "Pytania? Odpowiedz na tego e-maila." },
  en: { paidS: "Payment received: order {ref}", paidT: "Thank you! Your order is being made", paidB: "Your order has gone into production. It usually ships within {days} business days. You will get an email when it is on its way.", newS: "Order {ref}: bank transfer details", newT: "Order received. Waiting for your transfer", newB: "Pay with Revolut (app or card): tap the button, enter the exact amount and put your order number in the note. We start production once the payment arrives.", total: "Total", ship: "Delivery address", holder: "Beneficiary", amount: "Amount", ref: "Note", help: "Questions? Just reply to this email." },
  nl: { paidS: "Betaling ontvangen: bestelling {ref}", paidT: "Bedankt! Je bestelling wordt gemaakt", paidB: "Je bestelling is in productie. Verzending meestal binnen {days} werkdagen. Je krijgt een e-mail zodra het pakket onderweg is.", newS: "Bestelling {ref}: gegevens voor overschrijving", newT: "Bestelling ontvangen. We wachten op je betaling", newB: "Betaal via Revolut (app of kaart): tik op de knop, vul het exacte bedrag in en zet je bestelnummer in de notitie. We starten zodra de betaling binnen is.", total: "Totaal", ship: "Bezorgadres", holder: "Begunstigde", amount: "Bedrag", ref: "Notitie", help: "Vragen? Beantwoord deze e-mail." },
};

export type MailOrder = { id: string; lines: PricedLine[]; totalCents: number; shipping: Shipping; email: string | null; lang: Lang };

export function customerPaidMail(o: MailOrder, days: string): Omit<Mail, "to"> {
  const t = C[o.lang]; const ref = orderRef(o.id);
  return {
    subject: t.paidS.replace("{ref}", ref),
    html: wrap(t.paidT, `<p>${esc(t.paidB.replace("{days}", days))}</p>${itemsTable(o.lines, o.lang)}<p><b>${t.total}: ${money(o.totalCents, o.lang)}</b></p><p style="color:#52525b"><b>${t.ship}</b><br>${address(o.shipping)}</p><p style="color:#71717a">${t.help}</p>`),
  };
}

export function customerTransferMail(o: MailOrder, bank: { holder: string; iban: string; bic: string | null; revolut?: string | null }): Omit<Mail, "to"> {
  const t = C[o.lang]; const ref = orderRef(o.id);
  const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#71717a">${esc(k)}</td><td style="padding:4px 0;font-family:monospace;font-weight:bold">${esc(v)}</td></tr>`;
  const pay = bank.revolut
    ? `<p><a href="${esc(bank.revolut)}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Revolut · ${esc(bank.revolut.replace(/^https?:\/\//, ""))}</a></p>`
    : "";
  const rows = bank.revolut ? "" : `${row(t.holder, bank.holder)}${row("IBAN", bank.iban)}${bank.bic ? row("BIC", bank.bic) : ""}`;
  return {
    subject: t.newS.replace("{ref}", ref),
    html: wrap(t.newT, `<p>${esc(t.newB)}</p>${pay}<table style="margin:12px 0;background:#fff7ed;border-radius:12px;padding:12px">${rows}${row(t.amount, money(o.totalCents, o.lang))}${row(t.ref, ref)}</table>${itemsTable(o.lines, o.lang)}<p style="color:#71717a">${t.help}</p>`),
  };
}

/** Powiadomienie dla Ciebie (po polsku): nowe/opłacone zamówienie i co się stało z realizacją. */
export function adminMail(o: MailOrder, kind: "paid" | "awaiting_transfer", notes: string[]): Omit<Mail, "to"> {
  const ref = orderRef(o.id);
  const head = kind === "paid" ? `Opłacone zamówienie ${ref}: ${money(o.totalCents)}` : `Nowe zamówienie ${ref} czeka na przelew: ${money(o.totalCents)}`;
  return {
    subject: `[GrouaDrop] ${head}`,
    html: wrap(head, `${itemsTable(o.lines, "pl")}<p><b>Klient:</b> ${esc(o.email ?? "—")} · język ${o.lang.toUpperCase()}</p><p><b>Adres</b><br>${address(o.shipping)}</p>${notes.length ? `<p><b>Realizacja</b></p><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}<p><a href="https://grouaistream.com/admin?tab=shop">Panel admina → Sklep</a></p>`),
  };
}

/** Zlecenie dla dostawcy (po angielsku): wyprodukuj / wyślij prosto do klienta. */
export function supplierMail(o: MailOrder, lines: PricedLine[], sellerName: string): Omit<Mail, "to"> {
  const ref = orderRef(o.id);
  return {
    subject: `Order ${ref} from ${sellerName}: please ship to customer`,
    html: wrap(`New order ${ref}`, `<p>Please prepare and ship the items below directly to our customer (dropshipping, no invoice or prices in the parcel). Reply with the tracking number.</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0">${lines.map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${l.qty} × ${esc(l.name)}${l.size ? ` (size ${esc(l.size)})` : ""}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">product: ${esc(l.id)}</td></tr>`).join("")}</table>
<p><b>Ship to</b><br>${address(o.shipping)}${o.email ? `<br>${esc(o.email)}` : ""}</p><p>Reference: <b>${ref}</b></p>`),
  };
}

export async function sendMail(cfg: MailCfg, m: Mail): Promise<boolean> {
  try {
    const r = cfg.provider === "resend"
      ? await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { authorization: `Bearer ${cfg.key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: `${cfg.fromName} <${cfg.from}>`, to: [m.to], subject: m.subject, html: m.html, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
        signal: AbortSignal.timeout(10000),
      })
      : await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST", headers: { "api-key": cfg.key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: cfg.fromName, email: cfg.from }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, ...(m.replyTo ? { replyTo: { email: m.replyTo } } : {}) }),
        signal: AbortSignal.timeout(10000),
      });
    return r.ok;
  } catch {
    return false;
  }
}
