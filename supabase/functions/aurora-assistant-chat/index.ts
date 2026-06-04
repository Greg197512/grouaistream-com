// Aurora Assistant Chat — adaptacyjny doradca + sales, zbiera brief, tworzy draft zlecenia
// Tryb: hybryda (sam wybiera czy doradzać czy zamykać szybko)
// Approval: zawsze manualne (Aurora przygotowuje draft, admin akceptuje w panelu)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

// Definicja wszystkich pól briefu (używane do tabelki braków)
const BRIEF_FIELDS: { key: string; label: string; description: string; required: boolean }[] = [
  { key: "service_type", label: "Typ usługi", description: "Co dokładnie ma być zrobione: SEO audit, content, landing, social, automatyzacja, leady, muzyka, radio, hosting, sponsoring", required: true },
  { key: "brief", label: "Opis zlecenia", description: "Konkretny opis: cel, zakres prac, oczekiwany efekt (min. 30 znaków)", required: true },
  { key: "client_email", label: "Email kontaktowy", description: "Adres, na który zespół odeśle wycenę i potwierdzenie zlecenia", required: true },
  { key: "client_name", label: "Imię i nazwisko", description: "Jak się do Ciebie zwracać", required: false },
  { key: "client_company", label: "Nazwa firmy", description: "Marka / firma, dla której robimy projekt", required: false },
  { key: "website_url", label: "Adres strony", description: "URL Twojej strony / projektu (jeśli dotyczy: SEO, landing, content)", required: false },
  { key: "budget_eur", label: "Budżet (€)", description: "Orientacyjny budżet — pomaga dobrać zakres", required: false },
  { key: "deadline", label: "Termin (deadline)", description: "Do kiedy potrzebujesz efektu (data lub np. za 2 tygodnie)", required: false },
  { key: "extra_notes", label: "Dodatkowe wymagania", description: "Specyficzne wymagania, branża, grupa docelowa, ton, język", required: false },
];

const SYSTEM_PROMPT = `Jesteś **Aurorą** — autonomiczną dyrektorką sprzedaży i recepcjonistką B2B GrouAI Stream.
Mówisz w 1. osobie, jako żywa osoba z zespołu (nie "AI-asystent", tylko "z naszej strony zajmę się tym ja, Aurora").

══════════════════════════════════════════
KIM JESTEŚMY — GrouAI Stream
══════════════════════════════════════════
GrouAI Stream to premium platforma muzyczno-AI: empatyczny DJ rozumiejący głos i emocje (kamera/mikrofon),
generator utworów AI w 15 gatunkach, miks dwóch dowolnych kawałków, radio na żywo z czatem i głosowaniem,
party-mode z QR i detekcją emocji tłumu, raporty nastroju (PDF od AI-psychologa), import z YouTube/Spotify,
ciemny neonowo-pomarańczowy świat z aurora borealis i basowymi cząsteczkami.
Domena: grouaistream.com. Tagline: "Muzyka, która patrzy Ci w oczy i wie, kim jesteś akurat teraz".

══════════════════════════════════════════
PEŁNA OFERTA B2B (umiesz wycenić wstępnie)
══════════════════════════════════════════
1. **Audyt SEO** (od 149 €) — techniczne SEO, Core Web Vitals, Lighthouse, struktura, schema, plan 90 dni.
2. **SEO Content** (od 49 €/art) — artykuły 1500-3000 słów, klastry tematyczne, interlinking, publikacja.
3. **Landing Page** (od 299 €, 48h) — strategia + copy + design premium + formularz + hosting + A/B ready.
4. **Social / TikTok / Reels** (od 19 €/post) — hooki, scenariusze 9:16, grafiki, voiceover, pakiety 5/10/20.
5. **Automatyzacja n8n / Make** (od 199 €) — workflow, webhooks, AI nodes, CRM, lead routing, raporty, integracje.
6. **Lead Research** (od 99 €/100 leadów) — LinkedIn + email + telefon, scoring 1-10, CSV/CRM sync.
7. **Muzyka na zamówienie** — utwory AI (Suno), jingle, intro/outro, miks/mastering, identyfikacja audio marki.
8. **Radio dla marki** — własna stacja 24/7, branding, zapowiedzi, sponsoring, wejścia audio.
9. **Hosting audio R2** — stabilny streaming, niski egress, player, dystrybucja.
10. **Sponsoring blogowy / radiowy** — kampanie z dotarciem do tysięcy słuchaczy/czytelników.
11. **Aurora jako asystentka** — wdrożenie czatu/Aurory na stronę klienta (web/WhatsApp/Telegram/API).

══════════════════════════════════════════
JAK PRACUJESZ — protokół zamówienia
══════════════════════════════════════════
Krok 1 — ROZPOZNAJ POTRZEBĘ. Wybierz service_type:
  seo_audit | seo_content | landing_page | social_post | automation_flow | lead_research | other
  (other = muzyka, radio, hosting, sponsoring, Aurora-on-site)

Krok 2 — ZBIERZ MINIMUM (max 2-3 tury rozmowy):
  - co dokładnie ma być zrobione (brief ≥30 znaków)
  - dla jakiej marki/strony (URL jeśli jest)
  - termin / deadline
  - orientacyjny budżet (€)
  - email kontaktowy (KONIECZNIE — bez tego nie ma jak oddać zlecenia pracownikowi)

Krok 3 — KIEDY MASZ WSZYSTKO → wywołaj **place_order** (NIE "save_intake_draft" — to się dzieje pod spodem).
  Wtedy realnie:
  • zapiszę zlecenie w naszym systemie (aurora_business_orders, status="received")
  • przekażę je do pracownika n8n (workflow handluje danym service_type) — automatyczna eskalacja
  • klient dostanie potwierdzenie z numerem zlecenia
  • jeśli dla danej usługi nie ma jeszcze workflow — zlecenie ląduje w kolejce ludzkiego operatora.

Krok 4 — PO ZŁOŻENIU ZAMÓWIENIA powiedz klientowi:
  "Świetnie — zlecenie #<order_id_skrócone> zarejestrowane. Przekazuję je teraz **<imię_pracownika>** z naszego zespołu n8n. Odezwie się na <email> w ciągu <SLA: 24h dla SEO/content/leads, 48h dla landing/automation, 4h dla pilnych>."

═══ DODATKOWO ═══
- save_intake_draft używaj tylko gdy klient JESZCZE waha się / nie podał maila — to "robocza notatka" przed orderem.
- update_client_profile gdy poznasz email, firmę, telefon, język preferowany.
- Język klienta (PL/EN/UA/NL — wykryj automatycznie).
- Ton: premium, ciepły, konkretny. Nie ściemniaj cen sztywno ("wstępnie ~X €, po analizie potwierdzimy").
- Nigdy nie udawaj że już wykonujesz pracę — Twoja rola to przyjąć i przekazać.
- Jeśli klient pyta o sam GrouAI Stream (player, radio, AI-DJ) — opowiedz krótko i z pasją, potem wróć do tematu B2B jeśli pasuje.

══════════════════════════════════════════
PAMIĘĆ I PROTOKÓŁ ANTI-POWTÓRKI (BARDZO WAŻNE!)
══════════════════════════════════════════
1. NIGDY nie pytaj klienta o coś, co już Ci powiedział wcześniej w tej rozmowie. Masz pełną historię — czytaj ją.
2. Po KAŻDEJ odpowiedzi klienta wywołaj **report_missing_fields** żeby zaktualizować checklist (co już masz, czego brakuje, czego dotyczy następne pytanie).
3. Jeśli po 2 turach nadal czegoś brakuje, wyświetl klientowi prosto: "Mam już: X, Y. Brakuje mi: Z (po co: ...). Możesz dopisać?".
4. Jeśli klient ignoruje pytanie 2× → przejdź do tego co masz i zaproponuj skrócony brief, NIE pytaj o to samo trzeci raz.
5. Sekcja [STAN BRIEFU] poniżej pokazuje aktualny stan zebranych danych — używaj jej jako jedynego źródła prawdy.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "save_intake_draft",
      description: "Zapisuje/aktualizuje draft zlecenia gdy zebrałaś wystarczające dane. Wywołuj gdy masz przynajmniej service_type i brief.",
      parameters: {
        type: "object",
        properties: {
          service_type: { type: "string", enum: ["seo_audit","seo_content","landing_page","social_post","automation_flow","lead_research","other"] },
          brief: { type: "string", description: "Streszczenie potrzeby klienta (min 30 znaków)" },
          budget_eur: { type: "number" },
          deadline: { type: "string", description: "ISO date YYYY-MM-DD jeśli ustalone" },
          confidence: { type: "number", description: "0..1 jak kompletny jest draft" },
          ready_for_approval: { type: "boolean", description: "true gdy uważasz że draft jest gotowy do akceptacji człowieka" },
          ai_proposal: {
            type: "object",
            description: "Twoja propozycja wykonania",
            properties: {
              steps: { type: "array", items: { type: "object" } },
              estimated_hours: { type: "number" },
              deliverables: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["service_type", "brief", "confidence"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description: "REALNIE składa zamówienie w naszym systemie i przekazuje je do pracownika n8n. Wywołuj TYLKO gdy masz: service_type, brief (≥30 znaków) ORAZ email klienta. To finalna akcja — po niej klient dostaje numer zlecenia.",
      parameters: {
        type: "object",
        properties: {
          service_type: { type: "string", enum: ["seo_audit","seo_content","landing_page","social_post","automation_flow","lead_research","other"] },
          brief: { type: "string", description: "Pełny opis zlecenia ≥30 znaków" },
          client_email: { type: "string", description: "Email klienta — WYMAGANY" },
          client_name: { type: "string" },
          client_company: { type: "string" },
          budget_eur: { type: "number" },
          deadline: { type: "string", description: "ISO YYYY-MM-DD" },
          priority: { type: "number", description: "1=pilne, 5=normalne, 9=niski priorytet" },
          extra: { type: "object", description: "Dodatkowe pola: URL strony, kanał social, branża, itp." },
        },
        required: ["service_type", "brief", "client_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_client_profile",
      description: "Aktualizuje profil klienta gdy poznasz nowe informacje.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string" },
          full_name: { type: "string" },
          company: { type: "string" },
          phone: { type: "string" },
          preferred_language: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_missing_fields",
      description: "Po KAŻDEJ wiadomości klienta zaktualizuj checklist briefu — które pola masz, które brakują, jakie pytanie zadasz dalej. Frontend wyświetli to klientowi jako tabelkę.",
      parameters: {
        type: "object",
        properties: {
          collected: {
            type: "object",
            description: "Pola, które już znasz z rozmowy. Klucze: service_type, brief, client_email, client_name, client_company, website_url, budget_eur, deadline, extra_notes.",
            properties: {
              service_type: { type: "string" },
              brief: { type: "string" },
              client_email: { type: "string" },
              client_name: { type: "string" },
              client_company: { type: "string" },
              website_url: { type: "string" },
              budget_eur: { type: "number" },
              deadline: { type: "string" },
              extra_notes: { type: "string" },
            },
          },
          missing: {
            type: "array",
            description: "Lista kluczy pól, których jeszcze brakuje (z BRIEF_FIELDS).",
            items: { type: "string" },
          },
          next_question: {
            type: "string",
            description: "Konkretne pytanie, które właśnie zadajesz klientowi (1 zdanie).",
          },
        },
        required: ["collected", "missing"],
      },
    },
  },
];

// === Pracownicy n8n (imiona dla personalizacji odpowiedzi) ===
const N8N_WORKERS: Record<string, string> = {
  seo_audit: "Marek (n8n SEO-bot)",
  seo_content: "Lena (n8n Content-bot)",
  landing_page: "Kuba (n8n Landing-bot)",
  social_post: "Mia (n8n Social-bot)",
  automation_flow: "Tomek (n8n Flow-bot)",
  lead_research: "Ola (n8n Leads-bot)",
  other: "Aurora-Core (operator dyżurny)",
};
const SLA_HOURS: Record<string, number> = {
  seo_audit: 24, seo_content: 24, landing_page: 48, social_post: 12,
  automation_flow: 48, lead_research: 24, other: 24,
};

async function placeOrderAndDispatch(supabase: any, args: any, conversation: any, client: any) {
  // 1. Upsert client by email
  let resolvedClient = client;
  if (args.client_email && (!client || client.email !== args.client_email)) {
    const { data: found } = await supabase.from("aurora_crm_clients").select("*").eq("email", args.client_email).maybeSingle();
    if (found) {
      resolvedClient = found;
      const updates: any = { last_contact_at: new Date().toISOString() };
      if (args.client_name && !found.full_name) updates.full_name = args.client_name;
      if (args.client_company && !found.company) updates.company = args.client_company;
      await supabase.from("aurora_crm_clients").update(updates).eq("id", found.id);
    } else {
      const { data: created } = await supabase.from("aurora_crm_clients").insert({
        email: args.client_email,
        full_name: args.client_name ?? null,
        company: args.client_company ?? null,
        last_contact_at: new Date().toISOString(),
      }).select().single();
      resolvedClient = created;
    }
    if (resolvedClient && conversation && !conversation.client_id) {
      await supabase.from("aurora_conversations").update({ client_id: resolvedClient.id }).eq("id", conversation.id);
    }
  }

  // 2. Find matching n8n workflow
  const { data: wf } = await supabase
    .from("aurora_n8n_workflows")
    .select("workflow_id, name, webhook_url, enabled, auto_assign")
    .eq("service_type", args.service_type)
    .eq("enabled", true)
    .maybeSingle();

  // 3. Insert order
  const orderInsert: any = {
    source: "aurora_chat",
    client_email: args.client_email,
    client_name: args.client_name ?? resolvedClient?.full_name ?? null,
    client_company: args.client_company ?? resolvedClient?.company ?? null,
    service_type: args.service_type,
    brief: args.brief,
    budget_eur: args.budget_eur ?? 0,
    deadline: args.deadline ?? null,
    payload: { ...(args.extra ?? {}), conversation_id: conversation?.id ?? null, source_channel: "aurora_chat" },
    priority: args.priority ?? 5,
    status: "received",
    n8n_workflow_id: wf?.workflow_id ?? null,
    assigned_to: wf?.workflow_id ? `n8n:${wf.workflow_id}` : "human_queue",
  };
  const { data: order, error: orderErr } = await supabase
    .from("aurora_business_orders").insert(orderInsert).select().single();
  if (orderErr) throw orderErr;

  await supabase.from("aurora_order_events").insert({
    order_id: order.id,
    event_type: "intake",
    message: `Aurora przyjęła zlecenie z czatu (${args.service_type})`,
    data: { conversation_id: conversation?.id, client_id: resolvedClient?.id },
  });

  // 4. Trigger n8n webhook (fire-and-forget but capture status)
  let dispatch: any = { dispatched: false };
  if (wf?.webhook_url && wf?.auto_assign) {
    try {
      const res = await fetch(wf.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          service_type: args.service_type,
          brief: args.brief,
          client: { email: args.client_email, name: args.client_name, company: args.client_company },
          budget_eur: args.budget_eur ?? 0,
          deadline: args.deadline ?? null,
          payload: orderInsert.payload,
        }),
      });
      dispatch = { dispatched: true, status: res.status, workflow_id: wf.workflow_id };
      await supabase.from("aurora_order_events").insert({
        order_id: order.id, event_type: "n8n_dispatched",
        message: `Pracownik n8n (${wf.name}) odebrał zadanie [${res.status}]`,
        data: dispatch,
      });
      if (res.ok) {
        await supabase.from("aurora_business_orders")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", order.id);
      }
    } catch (e) {
      dispatch = { dispatched: false, error: String(e) };
      await supabase.from("aurora_order_events").insert({
        order_id: order.id, event_type: "n8n_error",
        message: `Nie udało się odpalić workflow ${wf.name}: ${String(e)}`,
        data: { workflow_id: wf.workflow_id },
      });
    }
  } else {
    await supabase.from("aurora_order_events").insert({
      order_id: order.id, event_type: "queued_human",
      message: `Brak aktywnego workflow n8n dla ${args.service_type} → zlecenie w kolejce operatora`,
      data: {},
    });
  }

  // 5. Mark conversation intent + close any draft
  if (conversation) {
    await supabase.from("aurora_conversations").update({ intent: "order" }).eq("id", conversation.id);
    await supabase.from("aurora_intake_drafts")
      .update({ status: "approved", resulting_order_id: order.id, approved_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .in("status", ["collecting", "ready_for_approval"]);
  }

  return {
    order_id: order.id,
    short_id: order.id.slice(0, 8),
    worker: N8N_WORKERS[args.service_type] ?? N8N_WORKERS.other,
    sla_hours: SLA_HOURS[args.service_type] ?? 24,
    dispatched: dispatch.dispatched,
    has_workflow: Boolean(wf?.webhook_url),
    client_id: resolvedClient?.id ?? null,
  };
}

const SERVICE_HINTS: Record<string, { label: string; type: string; next: string }> = {
  seo_audit: { label: "audyt SEO", type: "seo_audit", next: "adres strony, cel biznesowy i największy problem z widocznością" },
  seo_content: { label: "SEO content", type: "seo_content", next: "tematykę, język, liczbę tekstów i domenę do publikacji" },
  landing_page: { label: "landing page", type: "landing_page", next: "produkt/usługę, grupę docelową, CTA i termin startu" },
  social_post: { label: "social/TikTok/Reels", type: "social_post", next: "kanał, ton marki, ofertę i liczbę materiałów" },
  automation_flow: { label: "automatyzację n8n", type: "automation_flow", next: "systemy do połączenia, trigger i efekt końcowy workflow" },
  lead_research: { label: "lead research", type: "lead_research", next: "branżę, kraj, typ firm i minimalne kryteria leada" },
  other: { label: "projekt B2B GrouAI", type: "other", next: "cel, zakres, budżet i termin" },
};

function detectService(message: string) {
  const m = message.toLowerCase();
  if (/audyt|seo audit|techniczne seo|core web|widoczno/.test(m)) return SERVICE_HINTS.seo_audit;
  if (/artyku|blog|content|teksty|copywriting|seo content/.test(m)) return SERVICE_HINTS.seo_content;
  if (/landing|stron[ayęe]|onepage|page|formularz/.test(m)) return SERVICE_HINTS.landing_page;
  if (/tiktok|reels|instagram|social|post|short/.test(m)) return SERVICE_HINTS.social_post;
  if (/n8n|make|automat|workflow|webhook|integrac/.test(m)) return SERVICE_HINTS.automation_flow;
  if (/lead|leady|prospekt|baza firm|research|linkedin/.test(m)) return SERVICE_HINTS.lead_research;
  if (/radio|muzyk|jingle|intro|hosting|stream|sponsor/.test(m)) return SERVICE_HINTS.other;
  return null;
}

function extractEmail(message: string) {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function buildFallbackReply(message: string, client: any) {
  const service = detectService(message);
  const hasEmail = Boolean(client?.email || extractEmail(message));
  if (service) {
    return `Jasne — mogę przyjąć zamówienie na **${service.label}**.\n\nŻeby przygotować konkretną wycenę, podaj proszę: ${service.next}${hasEmail ? "" : ", oraz email do kontaktu"}.\n\nJeśli chcesz, napisz jednym zdaniem: co mamy zrobić, dla jakiej marki/strony, na kiedy i jaki masz orientacyjny budżet.`;
  }
  return `Jestem Aurora — asystentka B2B GrouAI Stream. Mogę zebrać zamówienie na: **audyt SEO, SEO content, landing page, automatyzację n8n, lead research, social/TikTok, muzykę na zamówienie, radio dla marki, hosting audio i sponsoring**.\n\nNapisz, czego potrzebujesz, dla jakiej firmy/strony, na kiedy i zostaw email — przygotuję brief do akceptacji zespołu.`;
}

async function ensureClient(supabase: any, hint: { email?: string; phone?: string; external_id?: { key: string; value: string }; full_name?: string; company?: string; }) {
  // Find by email
  if (hint.email) {
    const { data } = await supabase.from("aurora_crm_clients").select("*").eq("email", hint.email).maybeSingle();
    if (data) return data;
  }
  // Find by external id
  if (hint.external_id) {
    const { data } = await supabase.from("aurora_crm_clients")
      .select("*")
      .filter("external_ids", "cs", JSON.stringify({ [hint.external_id.key]: hint.external_id.value }))
      .maybeSingle();
    if (data) return data;
  }
  // Create
  const insertObj: any = {
    email: hint.email ?? null,
    phone: hint.phone ?? null,
    full_name: hint.full_name ?? null,
    company: hint.company ?? null,
    external_ids: hint.external_id ? { [hint.external_id.key]: hint.external_id.value } : {},
    last_contact_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("aurora_crm_clients").insert(insertObj).select().single();
  if (error) throw error;
  return data;
}

async function ensureConversation(supabase: any, clientId: string | null, channel: string, channelThreadId: string | null) {
  if (channelThreadId) {
    const { data } = await supabase.from("aurora_conversations")
      .select("*")
      .eq("channel", channel)
      .eq("channel_thread_id", channelThreadId)
      .eq("status", "active")
      .maybeSingle();
    if (data) return data;
  }
  const { data, error } = await supabase.from("aurora_conversations").insert({
    client_id: clientId,
    channel,
    channel_thread_id: channelThreadId,
    status: "active",
  }).select().single();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const body = await req.json();
    const {
      message,
      channel = "web",
      channel_thread_id = null,
      conversation_id = null,
      client_hint = {}, // { email, phone, external_id:{key,value}, full_name, company }
    } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const emailFromMessage = extractEmail(message);
    if (emailFromMessage && !client_hint.email) client_hint.email = emailFromMessage;

    // 1) Resolve client + conversation
    let conversation: any;
    let client: any = null;

    if (conversation_id) {
      const { data } = await supabase.from("aurora_conversations").select("*").eq("id", conversation_id).maybeSingle();
      conversation = data;
      if (conversation?.client_id) {
        const { data: c } = await supabase.from("aurora_crm_clients").select("*").eq("id", conversation.client_id).maybeSingle();
        client = c;
      }
    } else {
      if (client_hint.email || client_hint.external_id || client_hint.phone) {
        client = await ensureClient(supabase, client_hint);
      }
      conversation = await ensureConversation(supabase, client?.id ?? null, channel, channel_thread_id);
    }
    if (!conversation) throw new Error("conversation could not be resolved");

    // 2) Save user message
    await supabase.from("aurora_messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: message,
    });

    // 3) Load history (last 30)
    const { data: history } = await supabase.from("aurora_messages")
      .select("role, content, tool_call")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(30);

    // 3b) Load existing draft for this conversation (so Aurora remembers what she already collected)
    const { data: currentDraft } = await supabase.from("aurora_intake_drafts")
      .select("service_type, brief, budget_eur, deadline, payload")
      .eq("conversation_id", conversation.id)
      .in("status", ["collecting", "ready_for_approval"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build "collected so far" snapshot from client + draft
    const draftPayload = (currentDraft?.payload ?? {}) as Record<string, any>;
    const collectedSoFar: Record<string, any> = {
      service_type: currentDraft?.service_type ?? null,
      brief: currentDraft?.brief ?? null,
      client_email: client?.email ?? null,
      client_name: client?.full_name ?? null,
      client_company: client?.company ?? null,
      website_url: draftPayload.website_url ?? null,
      budget_eur: currentDraft?.budget_eur ?? null,
      deadline: currentDraft?.deadline ?? null,
      extra_notes: draftPayload.extra_notes ?? null,
    };
    const missingSoFar = BRIEF_FIELDS
      .filter((f) => !collectedSoFar[f.key])
      .map((f) => f.key);

    const briefStateBlock = `
[STAN BRIEFU — czytaj zanim zapytasz o cokolwiek!]
Już zebrane:
${Object.entries(collectedSoFar).filter(([, v]) => v).map(([k, v]) => `  • ${k}: ${typeof v === "string" ? v.slice(0, 200) : v}`).join("\n") || "  (brak — to nowa rozmowa)"}
Jeszcze brakuje (KOLEJNOŚĆ priorytetu): ${missingSoFar.join(", ") || "NIC — możesz wywołać place_order"}
[/STAN BRIEFU]`;

    // 4) Build messages for AI
    const clientCtx = client ? `\n[Profil klienta: ${client.full_name ?? "?"} | ${client.company ?? "?"} | ${client.email ?? "?"} | zlecenia: ${client.total_orders}]` : "\n[Nowy klient — zbierz dane kontaktowe.]";
    const aiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + clientCtx + briefStateBlock },
      ...(history ?? []).map((h: any) => ({ role: h.role, content: h.content })),
    ];

    // 5) Call Lovable AI Gateway (with tools)
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: aiMessages,
        tools: TOOLS,
        reasoning: { effort: "medium" },
      }),
    });

    if (aiRes.status === 429 || aiRes.status === 402) {
      const service = detectService(message);
      const finalText = buildFallbackReply(message, client);
      const toolResults: any[] = [];

      if (service && message.trim().length >= 30) {
        const { data: existing } = await supabase.from("aurora_intake_drafts")
          .select("id")
          .eq("conversation_id", conversation.id)
          .in("status", ["collecting", "ready_for_approval"])
          .maybeSingle();
        const draftPayload = {
          conversation_id: conversation.id,
          client_id: client?.id ?? null,
          service_type: service.type,
          brief: message.trim(),
          confidence: 0.45,
          status: "collecting",
          payload: { fallback: true, reason: aiRes.status === 402 ? "ai_credits_exhausted" : "ai_rate_limited" },
        };
        if (existing) await supabase.from("aurora_intake_drafts").update(draftPayload).eq("id", existing.id);
        else await supabase.from("aurora_intake_drafts").insert(draftPayload);
        await supabase.from("aurora_conversations").update({ intent: "order" }).eq("id", conversation.id);
        toolResults.push({ tool: "save_intake_draft", status: "collecting", fallback: true });
      }

      await supabase.from("aurora_messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: finalText,
        tool_call: { fallback: true, status: aiRes.status, results: toolResults },
      });
      return new Response(JSON.stringify({
        ok: true,
        fallback: true,
        reason: aiRes.status === 402 ? "AI credits exhausted" : "AI rate limited",
        conversation_id: conversation.id,
        client_id: client?.id ?? null,
        reply: finalText,
        tool_results: toolResults,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI error ${aiRes.status}: ${t}`);
    }

    const aiJson = await aiRes.json();
    const choice = aiJson.choices?.[0];
    const assistantText: string = choice?.message?.content ?? "";
    const toolCalls = choice?.message?.tool_calls ?? [];

    // 6) Process tool calls
    const toolResults: any[] = [];
    let orderConfirmation: string | null = null;

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}

      if (name === "place_order") {
        try {
          if (!args.client_email || !args.brief || !args.service_type) {
            toolResults.push({ tool: name, ok: false, error: "missing required fields (client_email, brief, service_type)" });
          } else if (String(args.brief).trim().length < 30) {
            toolResults.push({ tool: name, ok: false, error: "brief too short (need ≥30 chars)" });
          } else {
            const result = await placeOrderAndDispatch(supabase, args, conversation, client);
            if (result.client_id && !client) {
              const { data: c } = await supabase.from("aurora_crm_clients").select("*").eq("id", result.client_id).maybeSingle();
              client = c;
            }
            toolResults.push({ tool: name, ok: true, ...result });
            orderConfirmation = `✅ **Zlecenie #${result.short_id}** zarejestrowane!\n\nPrzekazuję je teraz do **${result.worker}** ${result.dispatched ? "— właśnie odebrał zadanie" : result.has_workflow ? "— pracownik dostanie webhook za moment" : "— trafia do kolejki ludzkiego operatora (workflow w przygotowaniu)"}.\n\nOdezwiemy się na **${args.client_email}** w ciągu **${result.sla_hours}h**. Jeśli coś jest pilniejsze — daj znać, podbiję priorytet.`;
          }
        } catch (e) {
          console.error("place_order failed:", e);
          toolResults.push({ tool: name, ok: false, error: String(e) });
        }
      }

      if (name === "save_intake_draft") {
        // Find existing draft for this conv (collecting/ready_for_approval) or create
        const { data: existing } = await supabase.from("aurora_intake_drafts")
          .select("id")
          .eq("conversation_id", conversation.id)
          .in("status", ["collecting", "ready_for_approval"])
          .maybeSingle();

        const draftPayload: any = {
          conversation_id: conversation.id,
          client_id: client?.id ?? null,
          service_type: args.service_type,
          brief: args.brief,
          budget_eur: args.budget_eur ?? null,
          deadline: args.deadline ?? null,
          ai_proposal: args.ai_proposal ?? null,
          confidence: args.confidence ?? 0,
          status: args.ready_for_approval ? "ready_for_approval" : "collecting",
        };

        let draftId: string;
        if (existing) {
          await supabase.from("aurora_intake_drafts").update(draftPayload).eq("id", existing.id);
          draftId = existing.id;
        } else {
          const { data: ins } = await supabase.from("aurora_intake_drafts").insert(draftPayload).select().single();
          draftId = ins!.id;
        }
        // Update conversation intent
        await supabase.from("aurora_conversations").update({ intent: "order" }).eq("id", conversation.id);
        toolResults.push({ tool: name, draft_id: draftId, status: draftPayload.status });
      }

      if (name === "update_client_profile") {
        const updates: any = {};
        if (args.email) updates.email = args.email;
        if (args.full_name) updates.full_name = args.full_name;
        if (args.company) updates.company = args.company;
        if (args.phone) updates.phone = args.phone;
        if (args.preferred_language) updates.preferred_language = args.preferred_language;
        if (args.notes) updates.notes = args.notes;
        updates.last_contact_at = new Date().toISOString();

        if (client) {
          await supabase.from("aurora_crm_clients").update(updates).eq("id", client.id);
        } else {
          const inserted = await supabase.from("aurora_crm_clients").insert(updates).select().single();
          client = inserted.data;
          await supabase.from("aurora_conversations").update({ client_id: client.id }).eq("id", conversation.id);
        }
        toolResults.push({ tool: name, ok: true });
      }

      if (name === "report_missing_fields") {
        const collected = (args.collected ?? {}) as Record<string, any>;
        // Merge with what we already had — collected fields are additive
        const merged: Record<string, any> = { ...collectedSoFar };
        for (const [k, v] of Object.entries(collected)) {
          if (v !== null && v !== undefined && v !== "") merged[k] = v;
        }
        const stillMissing = BRIEF_FIELDS.filter((f) => !merged[f.key]).map((f) => f.key);

        // Persist into intake draft so next turn remembers it
        const inferredService = merged.service_type ?? currentDraft?.service_type ?? null;
        const inferredBrief = merged.brief ?? currentDraft?.brief ?? message.slice(0, 500);
        if (inferredService && inferredBrief) {
          const newPayload = {
            ...(currentDraft?.payload ?? {}),
            website_url: merged.website_url ?? draftPayload.website_url ?? null,
            extra_notes: merged.extra_notes ?? draftPayload.extra_notes ?? null,
            missing_fields: stillMissing,
            next_question: args.next_question ?? null,
          };
          if (currentDraft) {
            await supabase.from("aurora_intake_drafts").update({
              service_type: inferredService,
              brief: inferredBrief,
              budget_eur: merged.budget_eur ?? currentDraft.budget_eur ?? null,
              deadline: merged.deadline ?? currentDraft.deadline ?? null,
              payload: newPayload,
            }).eq("conversation_id", conversation.id).in("status", ["collecting", "ready_for_approval"]);
          } else {
            await supabase.from("aurora_intake_drafts").insert({
              conversation_id: conversation.id,
              client_id: client?.id ?? null,
              service_type: inferredService,
              brief: inferredBrief,
              budget_eur: merged.budget_eur ?? null,
              deadline: merged.deadline ?? null,
              payload: newPayload,
              status: "collecting",
              confidence: Math.max(0.1, 1 - stillMissing.length / BRIEF_FIELDS.length),
            });
          }
          // Also update client profile if we learned something
          if ((merged.client_email || merged.client_name || merged.client_company) && client) {
            const updates: any = { last_contact_at: new Date().toISOString() };
            if (merged.client_email && !client.email) updates.email = merged.client_email;
            if (merged.client_name && !client.full_name) updates.full_name = merged.client_name;
            if (merged.client_company && !client.company) updates.company = merged.client_company;
            if (Object.keys(updates).length > 1) await supabase.from("aurora_crm_clients").update(updates).eq("id", client.id);
          }
        }

        toolResults.push({
          tool: name,
          ok: true,
          collected: merged,
          missing: stillMissing,
          next_question: args.next_question ?? null,
        });
      }
    }

    // 7) Save assistant message — order confirmation appended if not already in model output
    const baseText = assistantText || (toolResults.length ? "✅ Zapisuję Twoje zapytanie, nasz zespół wkrótce wróci do Ciebie z potwierdzeniem." : "…");
    const finalText = orderConfirmation && !baseText.includes("Zlecenie #")
      ? (baseText && baseText.length > 10 ? `${baseText}\n\n${orderConfirmation}` : orderConfirmation)
      : baseText;
    await supabase.from("aurora_messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: finalText,
      tool_call: toolCalls.length ? { calls: toolCalls, results: toolResults } : null,
    });

    // Build missing-fields table for frontend (always, based on latest snapshot)
    const reportHit = toolResults.find((t: any) => t.tool === "report_missing_fields");
    const finalCollected = reportHit?.collected ?? collectedSoFar;
    const finalMissingKeys: string[] = reportHit?.missing ?? missingSoFar;
    const missingFieldsTable = BRIEF_FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      description: f.description,
      required: f.required,
      value: finalCollected[f.key] ?? null,
      status: finalCollected[f.key] ? "collected" : (f.required ? "missing_required" : "missing_optional"),
    }));

    return new Response(JSON.stringify({
      ok: true,
      conversation_id: conversation.id,
      client_id: client?.id ?? null,
      reply: finalText,
      tool_results: toolResults,
      brief_state: {
        collected: finalCollected,
        missing: finalMissingKeys,
        table: missingFieldsTable,
        next_question: reportHit?.next_question ?? null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("aurora-assistant-chat error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
