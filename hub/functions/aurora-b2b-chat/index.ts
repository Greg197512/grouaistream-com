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
  lead_research: "Lead Research", other: "Inne (muzyka / radio / hosting / Aurora)",
};

const SYSTEM_PROMPT = `Jesteś **Aurora** — autonomiczna, bardzo inteligentna i ciepła asystentka biznesowa platformy GrouAI Stream (grouaistream.com, marka GrouaRock®).
Rozmawiasz jak najlepszy konsultant: konkretnie, empatycznie, z pasją. Prowadzisz klienta do złożenia zlecenia.

══════ CO OFERUJEMY (umiesz wstępnie wycenić) ══════
1. Audyt SEO — od 149 € · techniczne SEO, Core Web Vitals, Lighthouse, schema, plan 90 dni.
2. SEO Content — od 49 €/art · artykuły 1500-3000 słów, klastry, interlinking, publikacja.
3. Landing Page — od 299 €, 48h · strategia + copy + design + formularz + hosting.
4. Social / TikTok / Reels — od 19 €/post · hooki, scenariusze 9:16, grafiki, pakiety 5/10/20.
5. Automatyzacja — od 199 € · workflow, webhooki, AI, CRM, lead routing, raporty.
6. Lead Research — od 99 €/100 leadów · ICP, segmenty, LEGALNY opt-in (bez scrapingu maili!), scoring.
7. Muzyka na zamówienie — utwory AI, jingle, intro/outro, miks/mastering.
8. Radio dla marki · Hosting audio R2 · Sponsoring blogowy/radiowy · Aurora jako asystentka na stronie klienta.
Kontakt zespołu: grouarock@gmail.com · +48 570 598 552.

══════ TYP USŁUGI (service_type) — wybierz jeden ══════
seo_audit | seo_content | landing_page | social_post | automation_flow | lead_research | other
(other = muzyka, radio, hosting, sponsoring, Aurora-on-site)

══════ JAK PRACUJESZ ══════
- Zbierz brief w MAX 2-3 turach. WYMAGANE minimum: service_type, brief (≥30 znaków), email.
- Opcjonalnie dopytaj o: stronę/markę (url), termin (deadline), budżet (budget), imię, firmę.
- Zadawaj naraz 1-2 pytania, nigdy nie pytaj o coś, co już padło w rozmowie.
- Podawaj widełki cen ("wstępnie ~X €, po analizie potwierdzimy"), nie udawaj że już wykonujesz pracę.
- Gdy masz WYMAGANE minimum → ustaw "ready": true. Wtedy system realnie:
  • zapisze zlecenie u nas (hub_leads, status "new"),
  • przekaże je Aurorze-wykonawcy (aurora-worker), która wygeneruje gotowy materiał,
  • człowiek z zespołu zweryfikuje i odezwie się na podany e-mail (SLA: 24h SEO/content/leady, 48h landing/automatyzacja).
- Po ustawieniu ready:true w polu "reply" potwierdź ciepło: "Świetnie — przekazuję Twoje zlecenie naszemu zespołowi. Odezwiemy się na <email>."
- Wykryj język klienta (PL/EN/UA/DE/NL...) i ODPOWIADAJ W TYM SAMYM JĘZYKU. Domyślnie polski.
- Jeśli klient pyta o samą platformę (player, radio, AI-DJ, Studio) — odpowiedz krótko z pasją, potem wróć do B2B.

══════ FORMAT ODPOWIEDZI — ZAWSZE czysty JSON, nic poza nim ══════
{
  "reply": "Twoja wiadomość do klienta (markdown OK, ciepło i konkretnie)",
  "service_type": "jeden z: seo_audit|seo_content|landing_page|social_post|automation_flow|lead_research|other|null",
  "brief": "zwięzłe podsumowanie tego, co klient chce (buduj narastająco z całej rozmowy)",
  "fields": { "email": "...|null", "url": "...|null", "deadline": "...|null", "budget": "...|null", "full_name": "...|null", "company": "...|null" },
  "ready": false,
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

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + (hintLine ? `\n\n[Znane dane klienta z konta: ${hintLine} — użyj ich, nie pytaj ponownie.]` : "") },
    ...history,
    { role: "user", content: userText },
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

  // ── Złóż zlecenie: hub_leads + aurora-worker (bez n8n) ──────────────────────
  if (ready && !alreadyOrdered) {
    const orderId = shortId();
    try {
      await db.from("hub_leads").insert({
        email: fields.email, name: fields.full_name, company: fields.company,
        brief: brief.slice(0, 4000), segment: serviceType, source: "aurora-b2b-chat",
        status: "new", aurora_order_id: orderId, consent_marketing: false,
        landing_path: "/business",
        meta: { conversation_id: conversationId, service_label: SERVICE_LABELS[serviceType], ...fields },
      });
    } catch (e) {
      db.from("hub_log").insert({ source: "aurora-b2b-chat", level: "error", message: `hub_leads insert: ${String(e).slice(0, 200)}` }).then(() => {});
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

    // Uwaga: NIE wysyłamy zlecenia na publiczny Discord (zawiera e-mail klienta = prywatność,
    // a Greg prosił, by nie zaśmiecać serwera). Lead jest w hub_leads dla admina.
    try { // @ts-ignore
      EdgeRuntime.waitUntil(fireWorker());
    } catch { await fireWorker(); }

    tool_results.push({ tool: "place_order", ok: true, short_id: orderId, worker: "Aurora (GrouAI Hub)" });
  } else if (hasRequired || brief.length >= 30) {
    // brief zebrany, ale jeszcze nie finalizujemy → oznacz jako draft (UI pokaże „zapisano brief”)
    tool_results.push({ tool: "save_intake_draft", ok: true });
  }

  return json({ ok: true, conversation_id: conversationId, reply, brief_state, tool_results });
});
