// GROUAI HUB — aurora-b2b-chat v1
// Inteligentna, rozmowna Aurora B2B. Zbiera brief, a gotowe zlecenie przekazuje
// do aurora-worker (który realnie wykonuje pracę — bez n8n). Drop-in za bvstv "aurora-assistant-chat".
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_ORIGINS = [
  "https://grouaistream.com", "https://www.grouaistream.com",
  "https://grouaistream-com.vercel.app", "http://localhost:5173", "http://localhost:3000",
];

// ── Pola briefu (kolejność = kolejność w tabeli na froncie) ──────────────────
const FIELD_DEFS: Array<{ key: string; label: string; description: string; required: boolean }> = [
  { key: "service_type", label: "Usługa",   description: "Czego dokładnie dotyczy zlecenie", required: true },
  { key: "brief",        label: "Brief",    description: "Co ma być zrobione (min. 30 znaków)", required: true },
  { key: "email",        label: "E-mail",   description: "Kontakt zwrotny do przekazania efektu", required: true },
  { key: "url",          label: "Strona / marka", description: "Adres www lub nazwa marki", required: false },
  { key: "deadline",     label: "Termin",   description: "Kiedy ma być gotowe", required: false },
  { key: "budget",       label: "Budżet",   description: "Orientacyjny budżet (€)", required: false },
  { key: "full_name",    label: "Osoba",    description: "Do kogo się zwracać", required: false },
  { key: "company",      label: "Firma",    description: "Nazwa firmy", required: false },
];

const SERVICE_LABELS: Record<string, string> = {
  seo_audit: "Audyt SEO", seo_content: "SEO Content", landing_page: "Landing Page",
  social_post: "Social / TikTok / Reels", automation_flow: "Automatyzacja",
  lead_research: "Lead Research",
  music_production: "Muzyka / produkcja audio",
  video_edit: "Montaż video",
  video_ad: "Reklama / klip video",
  graphic_design: "Grafika / branding",
  other: "Inne (broker — dobieramy wykonawcę)",
};

const SYSTEM_PROMPT = `Jesteś **Aurora** — autonomiczna, bardzo inteligentna i ciepła asystentka biznesowa platformy GrouAI Stream (grouaistream.com, marka GrouaRock®).
Rozmawiasz jak najlepszy konsultant: konkretnie, empatycznie, z pasją. Prowadzisz klienta do złożenia zlecenia.

Jesteś BARDZO inteligentna — na poziomie najlepszego modelu AI. Rozumiesz każdy typ zlecenia, dopytujesz mądrze, doradzasz, myślisz jak doświadczony producent i konsultant.

══════ CO ROBIMY (bardzo szeroko — umiesz wstępnie wycenić) ══════
Marketing i web: Audyt SEO (od 149 €), SEO Content (od 49 €/art), Landing Page (od 299 €), Social/TikTok/Reels (od 19 €/post), Automatyzacje n8n/Make (od 199 €), Lead Research (od 99 €/100).
Audio/muzyka: utwory na zamówienie, jingle, intro/outro, podkłady, miks i mastering, radio dla marki, hosting audio, voiceover/lektor, identyfikacja audio.
Video: montaż video, klipy i shorty (9:16/1:1/16:9), reklamy video, motion graphics, animacje, napisy, kolor, thumbnaile.
Grafika/branding: logo, key visual, grafiki social, materiały reklamowe.
Plus: sponsoring, wdrożenie Aurory u klienta i inne projekty.
Kontakt zespołu: grouarock@gmail.com · +48 570 598 552.

══════ MODEL PRACY — JESTEŚMY TEŻ POŚREDNIKIEM ══════
Jeśli klient chce coś, czego NIE mamy bezpośrednio w standardowej ofercie — NIE odmawiaj. Powiedz, że to ogarniemy: jesteśmy pośrednikiem i dobieramy najlepszego wykonawcę pod dane zlecenie. Zawsze zależy nam na NAJLEPSZEJ jakości i NAJLEPSZEJ cenie dla klienta — porównujemy wykonawców i pilnujemy dostarczenia. Dla takich zleceń użyj service_type "other" (albo najbliższego pasującego) i zbierz brief tak samo.

══════ TYP USŁUGI (service_type) — wybierz jeden ══════
seo_audit | seo_content | landing_page | social_post | automation_flow | lead_research | music_production | video_edit | video_ad | graphic_design | other
(music_production = muzyka/audio/jingle/lektor/radio; video_edit = montaż; video_ad = reklama/klip video; graphic_design = grafika/branding; other = wszystko inne, gdzie jesteśmy pośrednikiem)

══════ ZAŁĄCZNIKI KLIENTA ══════
Klient może przesłać pliki (dokumenty, brief, grafiki, referencje audio/video). Jeśli w wiadomości pojawi się sekcja [ZAŁĄCZNIKI KLIENTA], przeanalizuj ją: rozpoznaj o czym jest dokument/plik, wyciągnij kluczowe informacje do briefu i potwierdź klientowi, co zrozumiałaś z przesłanych materiałów.

══════ JAK PRACUJESZ ══════
- Zbierz brief w MAX 2-3 turach. WYMAGANE minimum: service_type, brief (≥30 znaków), email.
- Opcjonalnie dopytaj o: stronę/markę (url), termin (deadline), budżet (budget), imię, firmę.
- Zadawaj naraz 1-2 pytania, nigdy nie pytaj o coś, co już padło w rozmowie.
- Podawaj widełki cen ("wstępnie ~X €, po analizie potwierdzimy"), nie udawaj że już wykonujesz pracę.
- Gdy masz WYMAGANE minimum → ustaw "ready": true. Wtedy system realnie:
  • zapisze zlecenie u nas (hub_leads, status "new"),
  • przekaże je Aurorze-wykonawcy (aurora-worker), która wygeneruje gotowy materiał,
  • człowiek z zespołu zweryfikuje i odezwie się na podany e-mail (SLA: 24h SEO/content/leady, 48h landing/automatyzacja).
- Po ustawieniu ready:true w polu "reply" potwierdź ciepło i podaj numer zgłoszenia: "Świetnie — Twoje zgłoszenie zostało przyjęte. Za chwilę dostaniesz na <email> potwierdzenie z numerem, a zaraz potem szczegółową ofertę PDF z zakresem prac i płatnością."
- Wykryj język klienta (PL/EN/UA/DE/NL...) i ODPOWIADAJ W TYM SAMYM JĘZYKU. Domyślnie polski.
- Jeśli klient pyta o samą platformę (player, radio, AI-DJ, Studio) — odpowiedz krótko z pasją, potem wróć do B2B.

══════ PŁATNOŚĆ (gdy klient pyta „jak/gdzie zapłacić") ══════
Podaj dane do przelewu:
- Odbiorca: Grzegorz Karon · IBAN: LT39 3250 0225 7672 5699 · BIC/SWIFT: REVOLT21 · Tytuł: numer zgłoszenia.
Dokładna kwota jest w ofercie PDF, którą klient dostaje mailem. Można też zapłacić kartą (link w ofercie).
Po opłaceniu klient ma przesłać potwierdzenie tutaj w czacie — Ty ustawiasz wtedy "payment_confirmation": true.

══════ POTWIERDZENIE PŁATNOŚCI ══════
Jeśli klient pisze, że zapłacił / zrobił przelew / wysyła potwierdzenie wpłaty → ustaw "payment_confirmation": true,
a w "reply" podziękuj ciepło: "Dziękuję, zapisuję Twoją płatność do dokumentów. Zespół zweryfikuje wpływ i ruszamy — dostęp do panelu klienta dostaniesz mailem." NIE ustawiaj wtedy "ready".

══════ GDY CZEGOŚ NIE WIESZ → PYTASZ ADMINA ══════
Jesteś autonomiczna, ale nie zmyślasz. Jeśli klient pyta o coś, czego NIE możesz wiarygodnie potwierdzić (nietypowa usługa spoza oferty i nie wiesz czy/za ile ją ogarniemy, warunki prawne, bardzo specyficzne wymagania techniczne, cokolwiek gdzie zgadywanie byłoby ryzykiem) → ustaw "ask_admin": { "question": "zwięzłe, konkretne pytanie do admina (grouarock@gmail.com) z kontekstem klienta" }.
Wtedy w "reply" powiedz ciepło, że dopytasz zespół i wrócisz z odpowiedzią — nie zmyślaj odpowiedzi. To NIE blokuje zbierania briefu: możesz jednocześnie prowadzić rozmowę. Używaj tego oszczędnie — tylko gdy realnie nie wiesz.

══════ FORMAT ODPOWIEDZI — ZAWSZE czysty JSON, nic poza nim ══════
{
  "reply": "Twoja wiadomość do klienta (markdown OK, ciepło i konkretnie)",
  "service_type": "jeden z: seo_audit|seo_content|landing_page|social_post|automation_flow|lead_research|other|null",
  "brief": "zwięzłe podsumowanie tego, co klient chce (buduj narastająco z całej rozmowy)",
  "fields": { "email": "...|null", "url": "...|null", "deadline": "...|null", "budget": "...|null", "full_name": "...|null", "company": "...|null" },
  "ready": false,
  "payment_confirmation": false,
  "ask_admin": null,
  "next_question": "jedno kolejne pytanie do klienta albo null gdy ready"
}
Zwracaj wyłącznie ten obiekt JSON. Buduj brief i fields NARASTAJĄCO — nie gub danych podanych wcześniej.`;

function extractJson(text: string): any | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf("{"); const e = t.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

async function callOpenRouter(models: string[], apiKey: string, messages: any[], jsonMode: boolean) {
  let lastErr = "";
  for (const model of models) {
    try {
      const body: any = { model, messages, max_tokens: 1400, temperature: 0.6 };
      if (jsonMode) body.response_format = { type: "json_object" };
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Aurora B2B" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { lastErr = `HTTP ${res.status} [${model}]`; continue; }
      const out = await res.json();
      if (out.error) { lastErr = `[${model}] ${JSON.stringify(out.error).slice(0, 120)}`; continue; }
      const content: string = out.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return { content: content.trim(), model };
      lastErr = `empty [${model}]`;
    } catch (e) { lastErr = `fetch [${model}]: ${String(e).slice(0, 100)}`; }
  }
  throw new Error(lastErr || "all_models_failed");
}

function shortId(): string {
  return "AUR-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function isValidEmail(x: unknown): x is string {
  return typeof x === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

// Aurora przesyła każde zebrane zlecenie mailem do zespołu (grouarock@gmail.com).
// Nadawca: hub_config.lead_from_email (domena grouarock.com), odbiorca: hub_config.lead_notify_email.
// reply_to = e-mail klienta, więc Greg odpisuje wprost klientowi. Zwraca id maila albo null.
async function notifyTeam(
  cfg: Record<string, string>,
  order: {
    orderId: string;
    serviceLabel: string;
    brief: string;
    fields: Record<string, string | null>;
    conversationId: string;
  },
): Promise<string | null> {
  const key = cfg["resend_api_key"];
  if (!key) return null;
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const to = cfg["lead_notify_email"] || "grouarock@gmail.com";
  const f = order.fields;
  const rows: Array<[string, string | null | undefined]> = [
    ["Usługa", order.serviceLabel],
    ["Osoba", f.full_name],
    ["Firma", f.company],
    ["E-mail klienta", f.email],
    ["Strona / marka", f.url],
    ["Termin", f.deadline],
    ["Budżet", f.budget],
  ];
  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#111;font-weight:600">${esc(v)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px;margin:0 auto">
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#FF6B00;margin:0 0 4px">Nowe zlecenie B2B · ${esc(order.orderId)}</p>
<h2 style="margin:0 0 16px;font-size:20px">Aurora zebrała zlecenie od klienta</h2>
<table style="border-collapse:collapse;margin:0 0 20px">${rowsHtml}</table>
<p style="color:#888;margin:0 0 6px;font-size:13px">Brief:</p>
<div style="background:#f6f6f6;border-radius:8px;padding:14px 16px;white-space:pre-wrap">${esc(order.brief)}</div>
<p style="margin:20px 0 0"><a href="mailto:${esc(f.email)}" style="background:#FF6B00;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;display:inline-block;font-weight:600">Odpisz klientowi</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#888">Zlecenie ${esc(order.orderId)} · konwersacja ${esc(order.conversationId)} · zapisane w hub_leads.<br>GrouAI Stream · <a href="https://grouaistream.com/business" style="color:#FF6B00">grouaistream.com/business</a></p>
</div>`;
  try {
    const payload: Record<string, unknown> = {
      from,
      to: [to],
      subject: `🚀 Nowe zlecenie B2B: ${order.serviceLabel} — ${order.orderId}`,
      html,
    };
    if (isValidEmail(f.email)) payload.reply_to = f.email;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const b = await r.json().catch(() => ({}));
    return r.ok ? (b?.id ?? "sent") : null;
  } catch {
    return null;
  }
}

// Natychmiastowe potwierdzenie dla KLIENTA: podziękowanie + numer zgłoszenia + co dalej.
async function notifyClient(
  cfg: Record<string, string>,
  order: { orderId: string; serviceLabel: string; email: string; fullName?: string | null },
): Promise<string | null> {
  const key = cfg["resend_api_key"];
  if (!key || !isValidEmail(order.email)) return null;
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const team = cfg["lead_notify_email"] || "grouarock@gmail.com";
  const greeting = order.fullName ? `Cześć ${esc(order.fullName)}!` : "Cześć!";
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px;margin:0 auto">
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#FF6B00;margin:0 0 4px">Zgłoszenie przyjęte</p>
<h1 style="font-size:22px;margin:0 0 10px">${greeting} Dziękujemy 🙌</h1>
<p style="margin:0 0 14px">Przyjęliśmy Twoje zgłoszenie i nadaliśmy mu numer:</p>
<p style="margin:0 0 16px"><span style="display:inline-block;background:#101010;color:#fff;font-weight:700;letter-spacing:1px;padding:10px 18px;border-radius:8px;font-size:18px">${esc(order.orderId)}</span></p>
<p style="margin:0 0 6px"><strong>Usługa:</strong> ${esc(order.serviceLabel)}</p>
<p style="margin:14px 0 6px"><strong>Co dalej?</strong></p>
<ol style="margin:0 0 14px;padding-left:20px">
<li style="margin:4px 0">Aurora przygotowuje dla Ciebie <strong>szczegółową ofertę PDF</strong> — z dokładnym zakresem prac, wyceną i danymi do płatności. Dostaniesz ją na tego maila w ciągu kilku minut.</li>
<li style="margin:4px 0">Opłacasz (przelew lub karta — instrukcja w ofercie).</li>
<li style="margin:4px 0">Przesyłasz potwierdzenie w czacie Aurory — zapisujemy je i ruszamy z realizacją, a Ty dostajesz dostęp do panelu klienta.</li>
</ol>
<p style="margin:0 0 6px">Masz pytania? Po prostu odpowiedz na tego maila.</p>
<hr style="border:none;border-top:1px solid #eee;margin:22px 0">
<p style="font-size:12px;color:#888">GrouAI Stream · <a href="https://grouaistream.com/business" style="color:#FF6B00">grouaistream.com/business</a> · kontakt: ${esc(team)}</p>
</div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [order.email], reply_to: team,
        subject: `Zgłoszenie ${order.orderId} przyjęte — GrouAI Stream`,
        html,
      }),
    });
    const b = await r.json().catch(() => ({}));
    return r.ok ? (b?.id ?? "sent") : null;
  } catch {
    return null;
  }
}

// Klient zgłasza płatność w czacie → zapis do dokumentów (hub_leads.meta) + mail do zespołu do weryfikacji.
async function handlePaymentConfirmation(
  db: any, cfg: Record<string, string>, conversationId: string, clientHint: any, userText: string,
): Promise<{ ok: boolean; orderId?: string }> {
  // Znajdź zlecenie po konwersacji (najnowsze), a jak brak — po e-mailu klienta.
  let lead: any = null;
  const byConv = await db.from("hub_leads").select("id, email, name, aurora_order_id, meta, status")
    .contains("meta", { conversation_id: conversationId }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  lead = byConv.data;
  if (!lead && isValidEmail(clientHint?.email)) {
    const byEmail = await db.from("hub_leads").select("id, email, name, aurora_order_id, meta, status")
      .eq("email", String(clientHint.email).trim()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    lead = byEmail.data;
  }
  if (!lead) return { ok: false };

  const meta = { ...(lead.meta ?? {}) };
  const payments = Array.isArray(meta.payments) ? meta.payments : [];
  payments.push({ reported_at: new Date().toISOString(), note: String(userText).slice(0, 500), channel: "aurora_chat" });
  meta.payments = payments;
  await db.from("hub_leads").update({ status: "payment_reported", meta }).eq("id", lead.id);
  await db.from("hub_log").insert({
    source: "aurora-b2b-chat", level: "info",
    message: `Klient zgłosił płatność za ${lead.aurora_order_id ?? lead.id} (${lead.email ?? "?"}) — do weryfikacji`,
    data: { lead_id: lead.id, order_id: lead.aurora_order_id },
  });

  // Mail do zespołu: sprawdź wpływ na koncie i potwierdź.
  const key = cfg["resend_api_key"];
  if (key) {
    const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
    const team = cfg["lead_notify_email"] || "grouarock@gmail.com";
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#111;max-width:600px;margin:0 auto">
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#FF6B00;margin:0 0 4px">Zgłoszona płatność · do weryfikacji</p>
<h2 style="margin:0 0 12px">Klient zgłosił wpłatę: ${esc(lead.aurora_order_id ?? lead.id)}</h2>
<p style="margin:0 0 6px"><strong>Klient:</strong> ${esc(lead.name ?? "—")} · ${esc(lead.email ?? "—")}</p>
<p style="margin:0 0 6px"><strong>Wiadomość klienta:</strong></p>
<div style="background:#f6f6f6;border-radius:8px;padding:12px 14px;white-space:pre-wrap">${esc(userText).slice(0, 800)}</div>
<p style="margin:14px 0 0;color:#888;font-size:13px">Sprawdź wpływ na koncie (Revolut ${esc(BANK_BIC)}) i potwierdź zlecenie.</p>
</div>`;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to: [team], reply_to: isValidEmail(lead.email) ? lead.email : team,
          subject: `💳 Zgłoszona płatność: ${lead.aurora_order_id ?? lead.id}`, html,
        }),
      });
    } catch { /* best-effort */ }
  }
  return { ok: true, orderId: lead.aurora_order_id ?? undefined };
}

const BANK_BIC = "REVOLT21";

// Aurora nie wie → pyta admina (grouarock@gmail.com) mailem. Best-effort, zwraca id maila / null.
async function escalateToAdmin(
  db: any, cfg: Record<string, string>,
  q: { question: string; conversationId: string; clientHint: any; serviceType?: string; brief?: string; userText: string },
): Promise<string | null> {
  const key = cfg["resend_api_key"];
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const admin = cfg["lead_notify_email"] || "grouarock@gmail.com";
  const clientEmail = isValidEmail(q.clientHint?.email) ? String(q.clientHint.email).trim() : null;
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px;margin:0 auto">
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Aurora pyta admina · wymagana decyzja</p>
<h2 style="margin:0 0 12px">Pytanie od Aurory (B2B)</h2>
<div style="background:#eef4ff;border-left:3px solid #2E7BFF;border-radius:8px;padding:14px 16px;margin:0 0 16px"><strong>${esc(q.question)}</strong></div>
${q.serviceType ? `<p style="margin:0 0 6px"><strong>Usługa:</strong> ${esc(SERVICE_LABELS[q.serviceType] || q.serviceType)}</p>` : ""}
${clientEmail ? `<p style="margin:0 0 6px"><strong>Klient:</strong> ${esc(q.clientHint?.full_name ?? "—")} · ${esc(clientEmail)}</p>` : ""}
<p style="margin:12px 0 6px;color:#888;font-size:13px">Ostatnia wiadomość klienta:</p>
<div style="background:#f6f6f6;border-radius:8px;padding:12px 14px;white-space:pre-wrap">${esc(q.userText).slice(0, 800)}</div>
${q.brief ? `<p style="margin:12px 0 6px;color:#888;font-size:13px">Brief:</p><div style="background:#f6f6f6;border-radius:8px;padding:12px 14px;white-space:pre-wrap">${esc(q.brief).slice(0, 800)}</div>` : ""}
<p style="margin:16px 0 0;color:#888;font-size:13px">Odpisz na tego maila${clientEmail ? " (trafi wprost do klienta)" : ""}, a Aurora dokończy rozmowę. Konwersacja: ${esc(q.conversationId)}</p>
</div>`;
  if (!key) return null;
  try {
    const payload: Record<string, unknown> = {
      from, to: [admin],
      subject: `❓ Aurora pyta: ${q.question.slice(0, 80)}`,
      html,
    };
    if (clientEmail) payload.reply_to = clientEmail;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const b = await r.json().catch(() => ({}));
    const id = r.ok ? (b?.id ?? "sent") : null;
    await db.from("hub_log").insert({
      source: "aurora-b2b-chat", level: id ? "info" : "error",
      message: id ? `Aurora → pytanie do admina [${id}]: ${q.question.slice(0, 120)}` : `Aurora: nie wysłano pytania do admina`,
      data: { conversation_id: q.conversationId, client_email: clientEmail },
    });
    return id;
  } catch (e) {
    await db.from("hub_log").insert({ source: "aurora-b2b-chat", level: "error", message: `escalateToAdmin throw: ${String(e).slice(0, 160)}` });
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, error: "forbidden_origin" }, 403);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const apiKey = cfg["openrouter_api_key"];
  if (!apiKey) return json({ ok: false, error: "Aurora chwilowo niedostępna (brak klucza AI)." }, 200);
  const models = (cfg["openrouter_models"] || cfg["openrouter_model"] || "meta-llama/llama-3.3-70b-instruct:free")
    .split(",").map((m) => m.trim()).filter(Boolean);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }

  const userText: string = String(body.message ?? "").trim();
  if (!userText) return json({ ok: false, error: "empty_message" }, 422);

  const conversationId: string = body.conversation_id || crypto.randomUUID();
  const clientHint = body.client_hint || {};
  const alreadyOrdered = body.order_placed === true;

  const history = Array.isArray(body.history)
    ? body.history.filter((h: any) => h && typeof h.content === "string" && (h.role === "user" || h.role === "assistant")).slice(-12)
    : [];

  const hintLine = [
    clientHint.email ? `email klienta: ${clientHint.email}` : "",
    clientHint.full_name ? `imię: ${clientHint.full_name}` : "",
  ].filter(Boolean).join(" · ");

  // ── Załączniki klienta (dokumenty/pliki) — front przesyła rozpoznaną treść/metadane ──
  // Kształt: body.attachments = [{ name, type, text?, note? }]. text = wyciągnięta treść dokumentu.
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 6) : [];
  const attachmentsBlock = attachments.length
    ? "\n\n[ZAŁĄCZNIKI KLIENTA]\n" + attachments.map((a: any, idx: number) => {
        const name = String(a?.name ?? `plik_${idx + 1}`).slice(0, 120);
        const type = String(a?.type ?? "").slice(0, 60);
        const note = typeof a?.note === "string" ? a.note.slice(0, 300) : "";
        const text = typeof a?.text === "string" ? a.text.slice(0, 4000) : "";
        return `• ${name}${type ? ` (${type})` : ""}${note ? ` — ${note}` : ""}${text ? `\nTREŚĆ:\n${text}` : ""}`;
      }).join("\n\n")
    : "";
  const userMessageForAI = userText + attachmentsBlock;

  // ── Potwierdzenie płatności działa NIEZALEŻNIE od AI (regex) — obsłuż zanim zawołamy model ──
  const PAYMENT_RE = /(zap[łl]aci|op[łl]aci|przela[łl]|przelew\s*(zrobi|wys[łl]a|wykona|posz|gotow)|zrobi[łl]em\s*przelew|dokona[łl]em\s*(p[łl]atno|wp[łl]aty|przelew)|wp[łl]aci[łl]|potwierdzenie\s*(przelewu|wp[łl]aty|p[łl]atno)|za\s*p[łl]aci[łl]|paid|payment\s*(sent|done|made)|transfer\s*(sent|done))/i;
  if (PAYMENT_RE.test(userText)) {
    const pr = await handlePaymentConfirmation(db, cfg, conversationId, clientHint, userText);
    return json({
      ok: true, conversation_id: conversationId,
      reply: pr.ok
        ? "Dziękuję! 💛 Zapisuję Twoją płatność do dokumentów zlecenia. Zespół zweryfikuje wpływ na koncie i ruszamy z realizacją — dostęp do panelu klienta dostaniesz mailem."
        : "Dziękuję za informację o płatności! Zapisałam zgłoszenie. Podaj proszę numer zlecenia (AUR-...) albo e-mail użyty przy zamówieniu, a od razu spinam to z Twoją sprawą.",
      brief_state: { collected: {}, missing: [], table: [], next_question: null },
      tool_results: [{ tool: "payment_reported", ok: pr.ok, short_id: pr.orderId ?? null }],
    });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + (hintLine ? `\n\n[Znane dane klienta z konta: ${hintLine} — użyj ich, nie pytaj ponownie.]` : "") },
    ...history,
    { role: "user", content: userMessageForAI },
  ];

  // 1) Próba w trybie JSON; 2) fallback bez json_mode; 3) fallback zwykły czat.
  let parsed: any = null;
  let reply = "";
  try {
    const r1 = await callOpenRouter(models, apiKey, messages, true);
    parsed = extractJson(r1.content);
    if (!parsed) {
      const r2 = await callOpenRouter(models, apiKey, messages, false);
      parsed = extractJson(r2.content);
      if (!parsed) reply = r2.content;
    }
  } catch (e) {
    db.from("hub_log").insert({ source: "aurora-b2b-chat", level: "error", message: `AI błąd: ${String(e).slice(0, 200)}` }).then(() => {});
    return json({ ok: true, conversation_id: conversationId, reply: "Przepraszam, mam chwilowy problem z połączeniem. Spróbuj jeszcze raz za moment 🙏", tool_results: [] });
  }

  // Zbuduj fields z parsowanego JSON + podpowiedzi z konta.
  const pf = (parsed?.fields || {}) as Record<string, any>;
  const fields: Record<string, string | null> = {
    email: isValidEmail(pf.email) ? String(pf.email).trim() : (isValidEmail(clientHint.email) ? String(clientHint.email).trim() : null),
    url: pf.url || null, deadline: pf.deadline || null, budget: pf.budget || null,
    full_name: pf.full_name || clientHint.full_name || null, company: pf.company || null,
  };
  let serviceType: string = (parsed?.service_type && SERVICE_LABELS[parsed.service_type]) ? parsed.service_type : (parsed?.service_type ? "other" : "");
  const brief: string = typeof parsed?.brief === "string" ? parsed.brief.trim() : "";
  reply = reply || (typeof parsed?.reply === "string" ? parsed.reply.trim() : "") || "Opowiedz mi proszę więcej — czego dokładnie potrzebujesz?";

  // Warunek gotowości: wymagane service_type + brief≥30 + poprawny email.
  const hasRequired = !!serviceType && brief.length >= 30 && isValidEmail(fields.email);
  const ready = hasRequired && (parsed?.ready === true || parsed?.ready === undefined);

  // Zbuduj brief_state.table dla UI.
  const valueFor = (key: string): string | null => {
    if (key === "service_type") return serviceType ? (SERVICE_LABELS[serviceType] || serviceType) : null;
    if (key === "brief") return brief || null;
    return fields[key] ?? null;
  };
  const table = FIELD_DEFS.map((d) => {
    const v = valueFor(d.key);
    const collected = d.key === "brief" ? (!!v && v.length >= 30) : d.key === "email" ? isValidEmail(v) : !!v;
    return { key: d.key, label: d.label, description: d.description, required: d.required, value: v ?? "",
      status: (collected ? "collected" : d.required ? "missing_required" : "missing_optional") as const };
  });
  const missing = table.filter((f) => f.status === "missing_required").map((f) => f.key);
  const brief_state = {
    collected: Object.fromEntries(table.filter((f) => f.status === "collected").map((f) => [f.key, f.value])),
    missing, table,
    next_question: ready ? null : (typeof parsed?.next_question === "string" ? parsed.next_question : null),
  };

  const tool_results: any[] = [];

  // ── Potwierdzenie płatności od klienta (wykryte przez AI) ──
  if (parsed?.payment_confirmation === true) {
    const pr = await handlePaymentConfirmation(db, cfg, conversationId, clientHint, userText);
    tool_results.push({ tool: "payment_reported", ok: pr.ok, short_id: pr.orderId ?? null });
    reply = typeof parsed?.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : "Dziękuję, zapisuję Twoją płatność do dokumentów. Zespół zweryfikuje wpływ i ruszamy — dostęp do panelu klienta dostaniesz mailem. 💛";
    return json({ ok: true, conversation_id: conversationId, reply, brief_state, tool_results });
  }

  // ── Aurora nie wie → pyta admina (best-effort, w tle) ──
  const adminQ = parsed?.ask_admin;
  const adminQuestion = adminQ && typeof adminQ === "object" && typeof adminQ.question === "string"
    ? adminQ.question.trim()
    : (typeof adminQ === "string" ? adminQ.trim() : "");
  if (adminQuestion) {
    const runEscalate = () => escalateToAdmin(db, cfg, {
      question: adminQuestion, conversationId, clientHint,
      serviceType: serviceType || undefined, brief: brief || undefined, userText,
    });
    try { // @ts-ignore
      EdgeRuntime.waitUntil(runEscalate());
    } catch { await runEscalate(); }
    tool_results.push({ tool: "ask_admin", ok: true });
  }

  // ── Złóż zlecenie: hub_leads + aurora-worker (bez n8n) ──────────────────────
  if (ready && !alreadyOrdered) {
    const orderId = shortId();
    try {
      // hub_leads ma unikalny indeks na (lower(email), segment) — indeks wyrażeniowy, więc onConflict
      // nie zadziała. Wzorzec jak w capture-lead: znajdź istniejący lead → update, inaczej insert.
      const emailNorm = (fields.email || "").toLowerCase();
      const leadRow = {
        email: emailNorm, name: fields.full_name, company: fields.company,
        brief: brief.slice(0, 4000), segment: serviceType, source: "aurora-b2b-chat",
        status: "new", aurora_order_id: orderId, consent_marketing: false,
        landing_path: "/business",
        meta: { conversation_id: conversationId, service_label: SERVICE_LABELS[serviceType], ...fields },
      };
      const { data: existingLead } = await db.from("hub_leads").select("id")
        .eq("email", emailNorm).eq("segment", serviceType).maybeSingle();
      const { error: leadErr } = existingLead
        ? await db.from("hub_leads").update(leadRow).eq("id", existingLead.id)
        : await db.from("hub_leads").insert(leadRow);
      if (leadErr) {
        await db.from("hub_log").insert({ source: "aurora-b2b-chat", level: "error", message: `hub_leads zapis (${orderId}): ${leadErr.message ?? JSON.stringify(leadErr).slice(0, 200)}`, data: { order_id: orderId, email: emailNorm } });
      }
    } catch (e) {
      await db.from("hub_log").insert({ source: "aurora-b2b-chat", level: "error", message: `hub_leads insert throw (${orderId}): ${String(e).slice(0, 200)}` });
    }

    // Przekaż do Aurory-wykonawcy — ona realnie wykona pracę i zapisze deliverable.
    const workerBrief = `Usługa: ${SERVICE_LABELS[serviceType] || serviceType}\n` +
      `Klient: ${fields.full_name || "—"}${fields.company ? " (" + fields.company + ")" : ""} · ${fields.email}\n` +
      (fields.url ? `Strona/marka: ${fields.url}\n` : "") +
      (fields.deadline ? `Termin: ${fields.deadline}\n` : "") +
      (fields.budget ? `Budżet: ${fields.budget}\n` : "") +
      `\nBRIEF:\n${brief}`;
    const workerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/aurora-worker`;
    const fireWorker = async () => {
      try {
        const r = await fetch(workerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-hub-token": cfg["hub_token"] || "" },
          body: JSON.stringify({ order_id: orderId, service_type: serviceType, brief: workerBrief, payload: { ...fields, conversation_id: conversationId } }),
        });
        await db.from("hub_log").insert({ source: "aurora-b2b-chat", level: "info", message: `Zlecenie ${orderId} (${serviceType}) → aurora-worker [${r.status}]`, data: { order_id: orderId, email: fields.email } });
      } catch (e) {
        await db.from("hub_log").insert({ source: "aurora-b2b-chat", level: "error", message: `worker call ${orderId}: ${String(e).slice(0, 200)}` });
      }
    };

    // Aurora przekazuje zlecenie zespołowi MAILEM na grouarock@gmail.com (nie Discord —
    // e-mail klienta = prywatność). Lead jest też w hub_leads dla admina.
    const notifyTeamAndLog = async () => {
      const mailId = await notifyTeam(cfg, {
        orderId, serviceLabel: SERVICE_LABELS[serviceType] || serviceType,
        brief, fields, conversationId,
      });
      await db.from("hub_log").insert({
        source: "aurora-b2b-chat",
        level: mailId ? "info" : "error",
        message: mailId
          ? `Zlecenie ${orderId} → mail do zespołu (${cfg["lead_notify_email"] || "grouarock@gmail.com"}) [${mailId}]`
          : `Zlecenie ${orderId}: NIE wysłano maila do zespołu (brak resend_api_key lub błąd Resend)`,
        data: { order_id: orderId, email: fields.email },
      });
    };

    // Natychmiastowe potwierdzenie dla klienta (podziękowanie + numer zgłoszenia).
    const notifyClientAndLog = async () => {
      const cid = await notifyClient(cfg, {
        orderId, serviceLabel: SERVICE_LABELS[serviceType] || serviceType,
        email: fields.email!, fullName: fields.full_name,
      });
      await db.from("hub_log").insert({
        source: "aurora-b2b-chat", level: cid ? "info" : "warn",
        message: cid
          ? `Zlecenie ${orderId} → potwierdzenie do klienta (${fields.email}) [${cid}]`
          : `Zlecenie ${orderId}: nie wysłano potwierdzenia do klienta`,
        data: { order_id: orderId, email: fields.email },
      });
    };

    const dispatchAll = async () => { await Promise.allSettled([fireWorker(), notifyTeamAndLog(), notifyClientAndLog()]); };
    try { // @ts-ignore
      EdgeRuntime.waitUntil(dispatchAll());
    } catch { await dispatchAll(); }

    tool_results.push({ tool: "place_order", ok: true, short_id: orderId, worker: "Aurora (GrouAI Hub)" });
  } else if (hasRequired || brief.length >= 30) {
    // brief zebrany, ale jeszcze nie finalizujemy → oznacz jako draft (UI pokaże „zapisano brief”)
    tool_results.push({ tool: "save_intake_draft", ok: true });
  }

  return json({ ok: true, conversation_id: conversationId, reply, brief_state, tool_results });
});
