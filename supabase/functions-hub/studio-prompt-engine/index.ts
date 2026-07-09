// GROUAI HUB — studio-prompt-engine
// Tryb "jak Suno": jedno zdanie od użytkownika → AI układa całą piosenkę
// (tytuł, styl, pełny tekst) → od razu startuje generacja ACE-Step na Replicate.
// Zastępuje martwą funkcję studio-prompt-engine na LIVE (brak klucza AI + zły
// endpoint Replicate). Kontrakt zgodny z MusicPromptBox: {success, plan,
// engine, generation_id, task_id}.
//
// Auth: JWT użytkownika LIVE (bvstv). AI: hub_config.openrouter_api_key +
// łańcuch modeli :free. Replicate: hub_config.replicate_api_token.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BVSTV_URL = "https://bvstvawnigyczvofzhps.supabase.co";
const BVSTV_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";
const REPLICATE_BASE = "https://api.replicate.com/v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function loadConfig(): Promise<Record<string, string>> {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

async function chat(models: string[], apiKey: string, messages: Array<{ role: string; content: string }>) {
  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://grouaistream.com",
          "X-Title": "GrouAI Studio",
        },
        body: JSON.stringify({ model, messages, max_tokens: 1600 }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) { lastErr = `HTTP ${res.status} [${model}]`; continue; }
      const out = await res.json();
      if (out.error) { lastErr = `[${model}] ${JSON.stringify(out.error).slice(0, 120)}`; continue; }
      const content: string = out.choices?.[0]?.message?.content ?? "";
      if (content.trim()) return { content: content.trim(), model };
      lastErr = `empty [${model}]`;
    } catch (e) {
      lastErr = `fetch [${model}]: ${String(e).slice(0, 100)}`;
    }
  }
  throw new Error(lastErr || "all_models_failed");
}

function extractJson(text: string): Record<string, unknown> | null {
  // Model może owinąć JSON w ```json ... ``` albo dopisać komentarz.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

const PLANNER_PROMPT = `Jesteś kompozytorem i tekściarzem GrouAI Studio. Użytkownik opisze utwór jednym lub kilkoma zdaniami (po polsku, angielsku, niderlandzku lub ukraińsku). Twoim zadaniem jest ułożyć KOMPLETNY plan piosenki.

Odpowiedz WYŁĄCZNIE poprawnym JSON (bez komentarzy) o polach:
{
  "title": "chwytliwy tytuł utworu",
  "tags": "angielskie tagi stylu oddzielone przecinkami: gatunek, nastrój, tempo/BPM, instrumenty, typ wokalu (np. 'melodic pop, upbeat, 120 bpm, female vocals, synth, radio friendly')",
  "instrumental": false,
  "lyrics": "PEŁNY tekst piosenki ze strukturą [verse]/[chorus]/[bridge] w języku użytkownika; jeśli instrumental=true wpisz '[instrumental]'",
  "duration_seconds": 120,
  "language": "pl|en|nl|uk",
  "human_summary": "jedno zdanie po polsku co tworzysz"
}

Zasady:
- Jeśli użytkownik prosi o utwór instrumentalny lub nie wspomina o wokalu/słowach w kontekście muzyki tła — ustaw instrumental=true.
- Jeśli użytkownik podał własny tekst — użyj go w całości (możesz dodać znaczniki struktury).
- duration_seconds: 60-180 (domyślnie 120; krótsze jeśli prosi o "krótki"/"intro"/"jingiel").
- Tekst piosenki w języku, w którym pisze użytkownik (chyba że prosi o inny).
- tags ZAWSZE po angielsku (tego wymaga silnik muzyczny).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cfg = await loadConfig();
  const orKey = cfg["openrouter_api_key"];
  const repToken = cfg["replicate_api_token"];
  if (!orKey) return json({ success: false, error: "ai_not_configured" }, 200);
  if (!repToken) return json({ success: false, error: "replicate_not_configured" }, 200);

  const models = (cfg["openrouter_models"] || "meta-llama/llama-3.3-70b-instruct:free")
    .split(",").map((m) => m.trim()).filter(Boolean);

  // Użytkownik LIVE
  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await live.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ success: false, error: "unauthorized" }, 401);

  // Generowanie tylko dla planów płatnych (Pro/Ultimate) lub admina.
  const [{ data: isAdmin }, { data: subRow }] = await Promise.all([
    live.rpc("has_role", { _user_id: userId, _role: "admin" }),
    live.from("user_subscriptions").select("plan, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
  ]);
  const paidPlan = subRow && (subRow.plan === "pro" || subRow.plan === "ultimate");
  if (!isAdmin && !paidPlan) {
    return json({
      success: false,
      error: "subscription_required",
      message: "Generowanie muzyki wymaga planu Pro lub Ultimate.",
    }, 403);
  }

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ success: false, error: "invalid_json" }, 400); }

  const prompt: string = String(body.prompt ?? "").trim();
  if (prompt.length < 3) return json({ success: false, error: "prompt_too_short" }, 400);
  const langHint = body.language ? `\n(Użytkownik wybrał język: ${body.language})` : "";

  try {
    // ===== 1. AI układa plan piosenki =====
    const result = await chat(models, orKey, [
      { role: "system", content: PLANNER_PROMPT },
      { role: "user", content: prompt + langHint },
    ]);
    const plan = extractJson(result.content);
    if (!plan || typeof plan.tags !== "string") {
      return json({ success: false, error: "plan_parse_failed", raw: result.content.slice(0, 300) }, 200);
    }

    const instrumental = !!plan.instrumental;
    const lyrics = instrumental ? "[instrumental]" : String(plan.lyrics || "[instrumental]");
    const duration = Math.min(Math.max(Number(plan.duration_seconds) || 120, 30), 180);
    const title = String(plan.title || "GrouAI Track").slice(0, 120);
    const tags = String(plan.tags);

    // ===== 2. Start generacji ACE-Step (Replicate, model społeczności ⇒ version) =====
    const rHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${repToken}` };
    const modelName = cfg["ace_model"] || "lucataco/ace-step";
    const mr = await fetch(`${REPLICATE_BASE}/models/${modelName}`, { headers: rHeaders });
    const mData = await mr.json();
    const version = mData?.latest_version?.id;
    if (!mr.ok || !version) return json({ success: false, error: "model_version_failed" }, 502);

    const rel = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST",
      headers: rHeaders,
      body: JSON.stringify({
        version,
        input: { tags, lyrics, duration, scheduler: "euler", guidance_scale: 15, number_of_steps: 60 },
      }),
    });
    const relData = await rel.json();
    if (!rel.ok) {
      if (rel.status === 402) {
        return json({ success: false, error: "Brak środków na koncie generowania — daj znać administratorowi." }, 200);
      }
      return json({ success: false, error: "engine_start_failed", details: relData }, 200);
    }
    const predId = relData?.id;
    if (!predId) return json({ success: false, error: "no_prediction_id" }, 200);

    // ===== 3. Rekord w Studio (LIVE) =====
    const { data: gen } = await live.from("generations").insert({
      user_id: userId,
      title,
      genre: tags.split(",")[0]?.trim() || "ai",
      prompt: prompt.slice(0, 2000),
      lyrics: lyrics.slice(0, 4000),
      instrumental,
      status: "pending",
      replicate_id: predId,
      engine: "acestep",
    }).select().single();

    return json({
      success: true,
      engine: "acestep",
      task_id: predId,
      generation_id: gen?.id ?? null,
      plan: {
        title,
        tags,
        lyrics,
        instrumental,
        duration_seconds: duration,
        language: plan.language || "pl",
        human_summary: String(plan.human_summary || `Tworzę: ${title}`),
        genre: tags.split(",")[0]?.trim(),
        mood: tags.split(",")[1]?.trim(),
      },
      model: result.model,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[studio-prompt-engine]", msg);
    return json({ success: false, error: msg }, 200);
  }
});
