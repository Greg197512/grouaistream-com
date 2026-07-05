// GROUAI HUB — aurora-worker
// Zastępuje "pracowników n8n". Odbiera zlecenia Aurory (webhook_url w aurora_n8n_workflows
// na projekcie LIVE wskazuje na tę funkcję), wykonuje pracę przez OpenRouter
// i raportuje wynik do aurora-n8n-callback na projekcie LIVE.
//
// Obsługiwane kształty wejścia:
//  A) z aurora-n8n-trigger:    { run_id, workflow_id, order_id, niche_id, callback_url, payload }
//  B) z aurora-assistant-chat: { order_id, service_type, brief, client, budget_eur, deadline, payload }
//
// Auth: ?t=<hub_token> lub nagłówek x-hub-token (wartość w tabeli hub_config).
// Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function loadConfig(db: any): Promise<Record<string, string>> {
  const { data } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

const SERVICE_PROMPTS: Record<string, string> = {
  seo_audit:
    "Jesteś ekspertem SEO. Na podstawie briefu przygotuj profesjonalny audyt SEO po polsku (markdown): 1) podsumowanie, 2) analiza on-page (tytuły, meta, nagłówki, treść), 3) technika (szybkość, indeksacja, mobile, schema), 4) treści i słowa kluczowe, 5) linkowanie, 6) lista TOP 10 działań wg priorytetu z szacunkiem wpływu.",
  seo_content:
    "Jesteś copywriterem SEO. Napisz gotowy do publikacji artykuł po polsku (markdown) na podstawie briefu: chwytliwy tytuł, meta description (max 155 znaków), lead, śródtytuły H2/H3, 800-1200 słów, naturalne słowa kluczowe, CTA na końcu.",
  landing_page:
    "Jesteś specjalistą CRO/copy. Przygotuj kompletną treść landing page po polsku (markdown): hero (nagłówek + podtytuł + CTA), 3 sekcje korzyści, dowód społeczny, sekcja oferty/cennika, FAQ (5 pytań), stopka CTA. Dodaj krótkie wskazówki układu dla developera.",
  social_post:
    "Jesteś social media managerem. Przygotuj pakiet postów na podstawie briefu: X/Twitter (max 260 znaków), Facebook po polsku, Instagram caption + 5 hashtagów, skrypt TikTok 15s, post LinkedIn. Zwróć w markdown z sekcjami per platforma.",
  automation_flow:
    "Jesteś architektem automatyzacji. Zaprojektuj workflow automatyzacji na podstawie briefu: trigger, kroki (nazwa, cel, narzędzie), zmienne, obsługa błędów, oczekiwany efekt, szacowany czas wdrożenia. Zwróć w markdown z diagramem tekstowym kroków.",
  lead_research:
    "Jesteś analitykiem sprzedaży. Na podstawie briefu przygotuj plan lead-research po polsku: profil idealnego klienta (ICP), 5 segmentów docelowych, legalne źródła pozyskania kontaktów (bez scrapingu maili!), szablon wiadomości opt-in, plan działań na 2 tygodnie.",
  other:
    "Jesteś wszechstronnym konsultantem biznesowym. Wykonaj zadanie z briefu najlepiej jak potrafisz i zwróć konkretny, gotowy do użycia rezultat po polsku w markdown.",
};

async function generateDeliverable(cfg: Record<string, string>, serviceType: string, brief: string, extra: unknown) {
  const key = cfg["openrouter_api_key"];
  if (!key) throw new Error("hub_ai_key_missing");
  const model = cfg["openrouter_model"] || "google/gemini-2.5-flash";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grouaistream.com",
      "X-Title": "GrouAI Hub Worker",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SERVICE_PROMPTS[serviceType] ?? SERVICE_PROMPTS.other },
        {
          role: "user",
          content: `BRIEF KLIENTA:\n${brief}\n\nDODATKOWY KONTEKST (JSON):\n${JSON.stringify(extra ?? {}).slice(0, 3000)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`openrouter_${res.status}: ${t.slice(0, 200)}`);
  }
  const out = await res.json();
  const content: string = out.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("openrouter_empty_response");
  return { content, model, usage: out.usage ?? null };
}

async function postCallback(url: string, body: Record<string, unknown>) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cfg = await loadConfig(db);

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  if (!cfg["openrouter_api_key"]) {
    // Bez klucza AI nie podejmujemy zadania — LIVE oznaczy run jako failed / zostawi w kolejce.
    await db.from("hub_log").insert({ source: "aurora-worker", level: "warn", message: "Odrzucono zadanie: brak openrouter_api_key w hub_config" });
    return json({ error: "hub_ai_key_missing", hint: "Dodaj klucz OpenRouter do hub_config" }, 503);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const runId: string | null = body.run_id ?? null;
  const orderId: string | null = body.order_id ?? null;
  const workflowId: string = body.workflow_id ?? "";
  const serviceType: string =
    body.service_type || body.payload?.service_type || workflowId.replace(/-/g, "_") || "other";
  const brief: string = body.brief || body.payload?.brief || JSON.stringify(body.payload ?? {}).slice(0, 2000);

  // Callback tylko do znanego hosta LIVE (ochrona przed SSRF przez podstawiony callback_url)
  const liveUrl = cfg["bvstv_url"] || "https://bvstvawnigyczvofzhps.supabase.co";
  let callbackUrl: string | null = typeof body.callback_url === "string" ? body.callback_url : null;
  if (callbackUrl && !callbackUrl.startsWith(liveUrl + "/")) callbackUrl = null;

  const work = async () => {
    const startedAt = Date.now();
    try {
      if (runId && callbackUrl) {
        await postCallback(callbackUrl, {
          run_id: runId, type: "step", step_index: 0, node_name: "grouai-hub",
          status: "success", message: `Hub przyjął zadanie (${serviceType})`,
        });
      }
      const result = await generateDeliverable(cfg, serviceType, brief, body.payload ?? body.client ?? {});
      const output = {
        deliverable_markdown: result.content,
        summary: result.content.slice(0, 400),
        service_type: serviceType,
        order_id: orderId,
        generated_by: "grouai-hub",
        model: result.model,
        duration_ms: Date.now() - startedAt,
      };
      if (runId && callbackUrl) {
        await postCallback(callbackUrl, { run_id: runId, type: "finish", status: "success", output });
      }
      await db.from("hub_log").insert({
        source: "aurora-worker", level: "info",
        message: `Zlecenie wykonane (${serviceType})${orderId ? ` order=${orderId}` : ""}${runId ? ` run=${runId}` : ""}`,
        data: { order_id: orderId, run_id: runId, service_type: serviceType, model: result.model, chars: result.content.length },
      });
      // Zachowaj pełny wynik po stronie huba (kopia bezpieczeństwa / wgląd bez panelu LIVE)
      await db.from("hub_deliverables").insert({
        order_id: orderId, run_id: runId, service_type: serviceType,
        brief: brief.slice(0, 4000), deliverable: result.content, model: result.model,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (runId && callbackUrl) {
        await postCallback(callbackUrl, { run_id: runId, type: "finish", status: "failed", error: `grouai-hub: ${msg}` });
      }
      await db.from("hub_log").insert({
        source: "aurora-worker", level: "error",
        message: `Błąd wykonania (${serviceType}): ${msg}`,
        data: { order_id: orderId, run_id: runId },
      });
    }
  };

  // Odpowiadamy od razu (trigger na LIVE czeka synchronicznie), praca w tle.
  try {
    // @ts-ignore — dostępne w Supabase Edge Runtime
    EdgeRuntime.waitUntil(work());
  } catch {
    await work();
  }

  return json({ ok: true, accepted: true, run_id: runId, order_id: orderId, worker: "grouai-hub" }, 200);
});
