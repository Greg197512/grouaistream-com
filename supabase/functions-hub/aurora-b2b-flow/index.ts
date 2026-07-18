// GROUAI HUB — aurora-b2b-flow
// Przyciskowa maszyna stanów zlecenia B2B (wszystko przez podpisane linki w mailach):
//  1) start          → mail do ADMINA z przyciskiem "Potwierdź zlecenie"
//  2) confirm_order  → admin widzi stronę z polem KWOTY (admin ustala cenę)
//  3) send_offer     → zapis kwoty → PDF oferta do KLIENTA z przyciskiem "Zapłaciłem"
//  4) client_paid    → klient zgłasza wpłatę → mail do ADMINA "Potwierdzam wpłatę"
//  5) confirm_payment→ admin potwierdza → PDF FAKTURA do klienta + odpalenie GENERACJI
//                      (oddajemy do istniejącego aurora-fulfill: utwór → pliki do klienta)
//
// Klucze HMAC rozdzielają role: adminKey (etapy admina) vs clientKey (klik klienta).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const page = (title: string, msg: string, ok = true, extra = "") =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#0b0b0f;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="max-width:520px;padding:40px;text-align:center"><div style="font-weight:700;font-size:18px;margin-bottom:6px">Grou<span style="color:#FF6B00">AI</span> Stream <span style="background:#2E7BFF;color:#fff;font-size:11px;padding:2px 8px;border-radius:5px;box-shadow:0 0 10px rgba(46,123,255,.7)">B2B</span></div><h1 style="font-size:22px;color:${ok ? "#4ade80" : "#f87171"}">${title}</h1><p style="line-height:1.6;color:#bbb">${msg}</p>${extra}</div></body>`,
    { headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } },
  );

const emailOk = (e: unknown) => typeof e === "string" && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e.trim());
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

const SERVICE_LABELS: Record<string, string> = {
  music_production: "Muzyka / produkcja audio", video_edit: "Montaż video",
  video_ad: "Reklama / klip video", graphic_design: "Grafika / branding",
  seo_audit: "Audyt SEO", seo_content: "SEO Content", landing_page: "Landing Page",
  social_post: "Social / TikTok / Reels", automation_flow: "Automatyzacja",
  lead_research: "Lead Research", other: "Projekt B2B",
};

// Dane sprzedawcy do faktury (z dokumentacji projektu).
const SELLER = {
  name: "Grzegorz Karon — GrouAI Stream",
  iban: "LT39 3250 0225 7672 5699",
  bic: "REVOLT21",
  email: "grouarock@gmail.com",
};

async function hmacKey(hubToken: string, role: string, orderId: string) {
  const data = new TextEncoder().encode(`${hubToken}:${role}:${orderId}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
// Klucz zgodny z aurora-fulfill (rola "approve") — pozwala oddać generację tam.
const fulfillKey = (hubToken: string, orderId: string) => hmacKey(hubToken, "approve", orderId);

async function sendMail(
  key: string, from: string, to: string[], subject: string, html: string,
  replyTo?: string, attachments?: { filename: string; content: string }[],
) {
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  if (attachments?.length) payload.attachments = attachments;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const b = await r.json().catch(() => ({}));
    return r.ok ? (b?.id ?? "sent") : null;
  } catch { return null; }
}

function brandHeader() {
  return `<div style="border-bottom:3px solid #FF6B00;padding-bottom:10px;margin-bottom:16px"><span style="font-weight:700;font-size:16px">Grou<span style="color:#FF6B00">AI</span> Stream</span><span style="display:inline-block;background:#2E7BFF;color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:5px;margin-left:8px;box-shadow:0 0 8px rgba(46,123,255,.6)">B2B</span></div>`;
}

// ── PDF: oferta / faktura ─────────────────────────────────────────────
async function buildPdf(kind: "offer" | "invoice", d: {
  orderId: string; label: string; brief: string; amount: number; currency: string;
  clientName?: string; clientEmail?: string; company?: string; invoiceNo?: string;
}): Promise<string | null> {
  try {
    const pdf = await PDFDocument.create();
    const p = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const orange = rgb(1, 0.42, 0);
    const dark = rgb(0.07, 0.07, 0.09);
    const gray = rgb(0.4, 0.4, 0.4);
    let y = 792;
    const line = (t: string, opts: { size?: number; f?: typeof font; color?: typeof dark; x?: number } = {}) => {
      p.drawText(t, { x: opts.x ?? 48, y, size: opts.size ?? 11, font: opts.f ?? font, color: opts.color ?? dark });
      y -= (opts.size ?? 11) + 7;
    };
    p.drawText("GrouAI Stream", { x: 48, y, size: 20, font: bold, color: dark });
    p.drawText("B2B", { x: 205, y: y + 2, size: 10, font: bold, color: orange });
    y -= 30;
    line(kind === "offer" ? "OFERTA / WYCENA" : "FAKTURA", { size: 16, f: bold, color: orange });
    y -= 4;
    line(`Numer zlecenia: ${d.orderId}`, { color: gray });
    if (kind === "invoice") line(`Faktura nr: ${d.invoiceNo}`, { color: gray });
    line(`Data: ${new Date().toLocaleDateString("pl-PL")}`, { color: gray });
    y -= 8;
    line("Sprzedawca:", { f: bold });
    line(SELLER.name);
    line(`IBAN: ${SELLER.iban} · BIC: ${SELLER.bic}`, { size: 10, color: gray });
    line(`Kontakt: ${SELLER.email}`, { size: 10, color: gray });
    y -= 6;
    line("Nabywca:", { f: bold });
    line(d.clientName || d.clientEmail || "—");
    if (d.company) line(d.company, { size: 10, color: gray });
    if (d.clientEmail) line(d.clientEmail, { size: 10, color: gray });
    y -= 10;
    line("Zakres:", { f: bold });
    line(d.label);
    // brief zawijany
    const words = String(d.brief || "").replace(/\s+/g, " ").trim().split(" ");
    let ln = "";
    for (const w of words) {
      if ((ln + " " + w).length > 90) { line(ln, { size: 10, color: gray }); ln = w; }
      else ln = ln ? ln + " " + w : w;
    }
    if (ln) line(ln, { size: 10, color: gray });
    y -= 12;
    p.drawRectangle({ x: 44, y: y - 6, width: 507, height: 34, color: rgb(0.96, 0.96, 0.97) });
    p.drawText(kind === "offer" ? "Do zapłaty:" : "Kwota:", { x: 54, y, size: 13, font: bold, color: dark });
    p.drawText(`${d.amount.toFixed(2)} ${d.currency}`, { x: 430, y, size: 15, font: bold, color: orange });
    y -= 44;
    if (kind === "offer") {
      line("Płatność: przelew (IBAN powyżej, tytuł = numer zlecenia) lub karta (link w mailu).", { size: 9, color: gray });
      line("Po opłaceniu potwierdź przyciskiem w mailu — ruszamy z realizacją.", { size: 9, color: gray });
    } else {
      line("Dziękujemy za płatność. Realizacja w toku — pliki trafią na Twój e-mail.", { size: 9, color: gray });
    }
    const bytes = await pdf.save();
    return btoa(String.fromCharCode(...bytes));
  } catch (_e) {
    return null; // brak PDF — mail pójdzie bez załącznika
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";
  const hubToken = cfg["hub_token"] || "";
  const admin = cfg["lead_notify_email"] || "grouarock@gmail.com";
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const resend = cfg["resend_api_key"];
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const self = `${baseUrl}/functions/v1/aurora-b2b-flow`;

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") || "";
  const orderId = url.searchParams.get("order") || "";

  const leadByOrder = async () =>
    (await db.from("hub_leads").select("*").eq("aurora_order_id", orderId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()).data as any;

  const log = (level: string, message: string, data: unknown = {}) =>
    db.from("hub_log").insert({ source: "aurora-b2b-flow", level, message, data });

  // ── 1) START: aurora-b2b-chat woła to po zebraniu briefu (ready). Mail do admina. ──
  // start (POST, z hub_token) lub kick (GET/POST, publiczny — tylko mail do admina dla
  // istniejącego zlecenia, idempotentny przez flow_started). Kick wołany z frontu po złożeniu.
  if (stage === "start" || stage === "kick") {
    if (stage === "start") {
      const token = req.headers.get("x-hub-token") || url.searchParams.get("t") || "";
      if (!hubToken || token !== hubToken) return json({ error: "unauthorized" }, 401);
    }
    const lead = await leadByOrder();
    if (!lead) return json({ error: "lead_not_found" }, 404);
    if (lead.meta?.flow_started) return json({ ok: true, already: true });

    const label = SERVICE_LABELS[lead.segment] ?? "Projekt B2B";
    const kAdmin = await hmacKey(hubToken, "admin", orderId);
    const confirmUrl = `${self}?stage=confirm_order&order=${encodeURIComponent(orderId)}&k=${kAdmin}`;
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:620px;margin:0 auto">
${brandHeader()}
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Nowe zlecenie · wymaga potwierdzenia i wyceny</p>
<h2 style="margin:0 0 12px">${esc(orderId)} — ${esc(label)}</h2>
<p style="margin:0 0 6px"><strong>Klient:</strong> ${esc(lead.name ?? "—")} ${lead.company ? "(" + esc(lead.company) + ")" : ""} · ${esc(lead.email ?? "—")}</p>
<p style="margin:0 0 6px;color:#888;font-size:13px">Brief:</p>
<div style="background:#f6f6f6;border-radius:8px;padding:12px 14px;white-space:pre-wrap">${esc(String(lead.brief ?? "").slice(0, 1200))}</div>
<p style="margin:16px 0 6px">Kliknij, aby potwierdzić zlecenie i <strong>ustawić cenę</strong> — Aurora wyśle klientowi ofertę PDF z przyciskiem do zapłaty:</p>
<p style="margin:14px 0"><a href="${confirmUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;display:inline-block;font-weight:700;font-size:16px">✅ Potwierdź zlecenie i wyceń</a></p>
</div>`;
    const mid = resend ? await sendMail(resend, from, [admin], `🆕 Nowe zlecenie B2B: ${label} — ${orderId}`, html, emailOk(lead.email) ? lead.email : undefined) : null;
    await db.from("hub_leads").update({ meta: { ...(lead.meta ?? {}), flow_started: new Date().toISOString() } }).eq("id", lead.id);
    await log(mid ? "info" : "error", mid ? `Flow start ${orderId} → admin [${mid}]` : `Flow start ${orderId}: mail nie wyszedł`, { order_id: orderId });
    return json({ ok: true, sent: !!mid });
  }

  // ── 2) CONFIRM_ORDER: admin klika → strona z polem kwoty ──
  if (stage === "confirm_order" && req.method === "GET") {
    const k = url.searchParams.get("k") || "";
    if (!orderId || k !== await hmacKey(hubToken, "admin", orderId)) return page("Nieprawidłowy link", "Link jest niepoprawny lub wygasł.", false);
    const lead = await leadByOrder();
    if (!lead) return page("Nie znaleziono zlecenia", `Zlecenie ${esc(orderId)} nie istnieje.`, false);
    if (lead.meta?.offer_sent_at) return page("Oferta już wysłana", `Ofertę dla ${esc(orderId)} już wysłano klientowi (${esc(lead.meta.offer_amount)} €).`);
    const label = SERVICE_LABELS[lead.segment] ?? "Projekt B2B";
    const form = `<form method="POST" action="${self}?stage=send_offer&order=${encodeURIComponent(orderId)}&k=${k}" style="margin-top:24px;text-align:left">
<label style="display:block;color:#fff;font-size:14px;font-weight:600;margin-bottom:8px">💶 Kwota do zapłaty (€)</label>
<input name="amount" type="number" inputmode="decimal" step="0.01" min="1" required autofocus placeholder="np. 150" style="width:100%;box-sizing:border-box;padding:18px;border-radius:12px;border:2px solid #FF6B00;background:#ffffff;color:#111;font-size:22px;font-weight:700;text-align:center">
<label style="display:block;color:#bbb;font-size:13px;margin:16px 0 6px">Notatka do oferty (opcjonalnie)</label>
<input name="note" type="text" placeholder="np. termin, zakres prac" style="width:100%;box-sizing:border-box;padding:14px;border-radius:10px;border:1px solid #666;background:#ffffff;color:#111;font-size:15px">
<button type="submit" style="width:100%;margin-top:20px;background:#FF6B00;color:#fff;border:0;padding:18px;border-radius:12px;font-weight:800;font-size:17px;cursor:pointer">Wyślij ofertę do klienta →</button>
</form>`;
    return page(`Wyceń: ${esc(label)}`, `Zlecenie ${esc(orderId)} dla ${esc(lead.email ?? "klienta")}. Wpisz kwotę — Aurora wyśle klientowi ofertę PDF z przyciskiem do zapłaty.`, true, form);
  }

  // ── 3) SEND_OFFER: admin wysłał kwotę → PDF oferta do klienta + przycisk "Zapłaciłem" ──
  if (stage === "send_offer" && req.method === "POST") {
    const k = url.searchParams.get("k") || "";
    if (!orderId || k !== await hmacKey(hubToken, "admin", orderId)) return page("Nieprawidłowy link", "Link jest niepoprawny lub wygasł.", false);
    const lead = await leadByOrder();
    if (!lead) return page("Nie znaleziono zlecenia", `Zlecenie ${esc(orderId)} nie istnieje.`, false);
    const form = await req.formData().catch(() => null);
    const amountRaw = (form?.get("amount") ?? url.searchParams.get("amount") ?? "") as string;
    const noteRaw = (form?.get("note") ?? url.searchParams.get("note") ?? "") as string;
    const amount = Math.round(parseFloat(String(amountRaw)) * 100) / 100;
    const note = String(noteRaw).slice(0, 400);
    if (!isFinite(amount) || amount <= 0) return page("Zła kwota", "Wpisz poprawną kwotę większą od zera.", false);
    if (!emailOk(lead.email)) return page("Brak e-maila klienta", "Zlecenie nie ma poprawnego adresu klienta.", false);

    const label = SERVICE_LABELS[lead.segment] ?? "Projekt B2B";
    const kClient = await hmacKey(hubToken, "client", orderId);
    const paidUrl = `${self}?stage=client_paid&order=${encodeURIComponent(orderId)}&kc=${kClient}`;
    const pdfB64 = await buildPdf("offer", {
      orderId, label, brief: String(lead.brief ?? ""), amount, currency: "EUR",
      clientName: lead.name, clientEmail: lead.email, company: lead.company,
    });
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:620px;margin:0 auto">
${brandHeader()}
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Twoja oferta · ${esc(orderId)}</p>
<h1 style="font-size:22px;margin:0 0 10px">${lead.name ? "Cześć " + esc(lead.name) + "!" : "Cześć!"} Oto wycena 🎯</h1>
<p style="margin:0 0 6px"><strong>Usługa:</strong> ${esc(label)}</p>
<p style="margin:0 0 6px"><strong>Do zapłaty:</strong> <span style="color:#FF6B00;font-weight:700;font-size:18px">${amount.toFixed(2)} €</span></p>
${note ? `<p style="margin:8px 0;color:#555">${esc(note)}</p>` : ""}
<p style="margin:12px 0 6px">Szczegóły w załączonym PDF. Płatność przelewem:</p>
<div style="background:#f6f6f6;border-radius:8px;padding:12px 14px;font-size:14px">Odbiorca: ${esc(SELLER.name)}<br>IBAN: ${esc(SELLER.iban)} · BIC: ${esc(SELLER.bic)}<br>Tytuł przelewu: <strong>${esc(orderId)}</strong></div>
<p style="margin:16px 0 6px">Po opłaceniu kliknij, aby potwierdzić — zespół zweryfikuje wpływ i ruszamy z realizacją:</p>
<p style="margin:14px 0"><a href="${paidUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;display:inline-block;font-weight:700;font-size:16px">✅ Zapłaciłem / Akceptuję ofertę</a></p>
<p style="font-size:12px;color:#888">Pytania? Odpisz na tego maila.</p>
</div>`;
    const attachments = pdfB64 ? [{ filename: `Oferta-${orderId}.pdf`, content: pdfB64 }] : undefined;
    const mid = resend ? await sendMail(resend, from, [lead.email], `Oferta ${orderId}: ${label} — ${amount.toFixed(2)} €`, html, admin, attachments) : null;
    const meta = { ...(lead.meta ?? {}), offer_amount: amount, offer_note: note, offer_sent_at: new Date().toISOString() };
    await db.from("hub_leads").update({ meta, status: "offer_sent" }).eq("id", lead.id);
    await log(mid ? "info" : "error", mid ? `Oferta ${orderId} (${amount} €) → klient [${mid}]` : `Oferta ${orderId}: mail nie wyszedł`, { order_id: orderId });
    return page(mid ? "Oferta wysłana ✅" : "Uwaga", mid
      ? `Oferta ${esc(orderId)} na ${amount.toFixed(2)} € poszła do klienta (${esc(lead.email)}) z PDF i przyciskiem do potwierdzenia płatności.`
      : `Zapisano kwotę, ale maila nie udało się wysłać (sprawdź resend_api_key).`, !!mid);
  }

  // ── 4) CLIENT_PAID: klient klika "Zapłaciłem" → mail do admina z przyciskiem potwierdzenia ──
  if (stage === "client_paid" && req.method === "GET") {
    const kc = url.searchParams.get("kc") || "";
    if (!orderId || kc !== await hmacKey(hubToken, "client", orderId)) return page("Nieprawidłowy link", "Link jest niepoprawny lub wygasł.", false);
    const lead = await leadByOrder();
    if (!lead) return page("Nie znaleziono zlecenia", `Zlecenie ${esc(orderId)} nie istnieje.`, false);
    if (lead.meta?.payment_confirmed_at) return page("Już potwierdzone", `Płatność za ${esc(orderId)} jest już potwierdzona — realizacja w toku.`);

    const label = SERVICE_LABELS[lead.segment] ?? "Projekt B2B";
    const kAdmin = await hmacKey(hubToken, "admin", orderId);
    const confirmUrl = `${self}?stage=confirm_payment&order=${encodeURIComponent(orderId)}&k=${kAdmin}`;
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:620px;margin:0 auto">
${brandHeader()}
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Klient zgłosił wpłatę · do weryfikacji</p>
<h2 style="margin:0 0 12px">${esc(orderId)} — ${esc(label)} · ${esc(String(lead.meta?.offer_amount ?? "?"))} €</h2>
<p style="margin:0 0 6px"><strong>Klient:</strong> ${esc(lead.name ?? "—")} · ${esc(lead.email ?? "—")}</p>
<p style="margin:12px 0 6px">Sprawdź wpływ na koncie (Revolut ${esc(SELLER.bic)}, tytuł ${esc(orderId)}). Gdy się zgadza, kliknij — Aurora wyśle fakturę PDF i uruchomi realizację utworu:</p>
<p style="margin:14px 0"><a href="${confirmUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;display:inline-block;font-weight:700;font-size:16px">💳 Potwierdzam wpłatę — wystaw fakturę i realizuj</a></p>
</div>`;
    const mid = resend ? await sendMail(resend, from, [admin], `💳 Zgłoszona wpłata: ${orderId} (${lead.meta?.offer_amount ?? "?"} €)`, html, emailOk(lead.email) ? lead.email : undefined) : null;
    await db.from("hub_leads").update({ status: "payment_reported", meta: { ...(lead.meta ?? {}), client_paid_reported_at: new Date().toISOString() } }).eq("id", lead.id);
    await log(mid ? "info" : "error", mid ? `Klient zgłosił wpłatę ${orderId} → admin [${mid}]` : `client_paid ${orderId}: mail nie wyszedł`, { order_id: orderId });
    return page("Dziękujemy! 🙌", `Zapisaliśmy Twoje zgłoszenie płatności dla ${esc(orderId)}. Zespół zweryfikuje wpływ i ruszamy — fakturę oraz gotowe pliki dostaniesz na e-mail.`);
  }

  // ── 5) CONFIRM_PAYMENT: admin potwierdza → faktura PDF do klienta + oddanie generacji do aurora-fulfill ──
  if (stage === "confirm_payment" && req.method === "GET") {
    const k = url.searchParams.get("k") || "";
    if (!orderId || k !== await hmacKey(hubToken, "admin", orderId)) return page("Nieprawidłowy link", "Link jest niepoprawny lub wygasł.", false);
    const lead = await leadByOrder();
    if (!lead) return page("Nie znaleziono zlecenia", `Zlecenie ${esc(orderId)} nie istnieje.`, false);
    if (lead.meta?.payment_confirmed_at) return page("Już potwierdzone", `Płatność za ${esc(orderId)} była już potwierdzona — realizacja idzie.`);

    const label = SERVICE_LABELS[lead.segment] ?? "Projekt B2B";
    const amount = Number(lead.meta?.offer_amount ?? 0);
    const invoiceNo = `FV-${new Date().getFullYear()}-${String(orderId).replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase()}`;

    // Faktura PDF do klienta
    if (emailOk(lead.email)) {
      const pdfB64 = await buildPdf("invoice", {
        orderId, label, brief: String(lead.brief ?? ""), amount, currency: "EUR",
        clientName: lead.name, clientEmail: lead.email, company: lead.company, invoiceNo,
      });
      const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:620px;margin:0 auto">
${brandHeader()}
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Płatność potwierdzona · faktura</p>
<h1 style="font-size:22px;margin:0 0 10px">Dziękujemy! 🎉 Ruszamy z realizacją</h1>
<p style="margin:0 0 6px">Potwierdziliśmy Twoją płatność za <strong>${esc(label)}</strong> (${amount.toFixed(2)} €). W załączniku faktura <strong>${esc(invoiceNo)}</strong>.</p>
<p style="margin:10px 0 6px">Aurora właśnie tworzy Twój utwór w GrouAI Studio. Gotowe pliki (MP3/WAV) trafią na ten adres, gdy tylko będą gotowe.</p>
<p style="font-size:12px;color:#888">Pytania? Odpisz na tego maila.</p>
</div>`;
      const attachments = pdfB64 ? [{ filename: `${invoiceNo}.pdf`, content: pdfB64 }] : undefined;
      const mid = resend ? await sendMail(resend, from, [lead.email], `Faktura ${invoiceNo} — realizujemy ${orderId}`, html, admin, attachments) : null;
      await log(mid ? "info" : "error", mid ? `Faktura ${invoiceNo} → klient [${mid}]` : `Faktura ${orderId}: mail nie wyszedł`, { order_id: orderId });
    }

    await db.from("hub_leads").update({
      status: "paid",
      meta: { ...(lead.meta ?? {}), payment_confirmed_at: new Date().toISOString(), invoice_no: invoiceNo },
    }).eq("id", lead.id);

    // Oddaj GENERACJĘ do istniejącego aurora-fulfill (utwór → pliki do klienta + dokumentacja).
    let genStatus = 0;
    try {
      const kFulfill = await fulfillKey(hubToken, orderId);
      const r = await fetch(`${baseUrl}/functions/v1/aurora-fulfill?order=${encodeURIComponent(orderId)}&k=${kFulfill}`, { method: "GET" });
      genStatus = r.status;
    } catch { genStatus = 0; }
    await log("info", `Płatność ${orderId} potwierdzona → faktura + aurora-fulfill [${genStatus}]`, { order_id: orderId });

    return page("Potwierdzono i realizujemy 🚀",
      `Płatność za ${esc(orderId)} potwierdzona. Faktura ${esc(invoiceNo)} poszła do klienta, a Aurora uruchomiła generację utworu — gotowe pliki (MP3/WAV) trafią na e-mail klienta.`);
  }

  return json({ error: "not_found" }, 404);
});
