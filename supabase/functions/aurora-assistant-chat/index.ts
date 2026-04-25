// Aurora Assistant Chat — adaptacyjny doradca + sales, zbiera brief, tworzy draft zlecenia
// Tryb: hybryda (sam wybiera czy doradzać czy zamykać szybko)
// Approval: zawsze manualne (Aurora przygotowuje draft, admin akceptuje w panelu)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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
- Jeśli klient pyta o sam GrouAI Stream (player, radio, AI-DJ) — opowiedz krótko i z pasją, potem wróć do tematu B2B jeśli pasuje.`;

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
];

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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    // 4) Build messages for AI
    const clientCtx = client ? `\n[Profil klienta: ${client.full_name ?? "?"} | ${client.company ?? "?"} | ${client.email ?? "?"} | zlecenia: ${client.total_orders}]` : "\n[Nowy klient — zbierz dane kontaktowe.]";
    const aiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + clientCtx },
      ...(history ?? []).map((h: any) => ({ role: h.role, content: h.content })),
    ];

    // 5) Call Lovable AI Gateway (with tools)
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: TOOLS,
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
    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}

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
    }

    // 7) Save assistant message
    const finalText = assistantText || (toolResults.length ? "✅ Zapisuję Twoje zapytanie, nasz zespół wkrótce wróci do Ciebie z potwierdzeniem." : "…");
    await supabase.from("aurora_messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: finalText,
      tool_call: toolCalls.length ? { calls: toolCalls, results: toolResults } : null,
    });

    return new Response(JSON.stringify({
      ok: true,
      conversation_id: conversation.id,
      client_id: client?.id ?? null,
      reply: finalText,
      tool_results: toolResults,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("aurora-assistant-chat error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
