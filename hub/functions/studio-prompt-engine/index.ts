// GROUAI HUB — studio-prompt-engine
// Jedno zdanie → AI układa całą piosenkę → generacja na Replicate.
// Auth: JWT LIVE (bvstv). AI: hub_config.openrouter_api_key. Replicate: hub_config.replicate_api_token.
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

async function callModel(model: string, apiKey: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://grouaistream.com",
      "X-Title": "GrouAI Studio",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 3000,
      temperature: 0.75,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const out = await res.json();
  if (out.error) throw new Error(JSON.stringify(out.error).slice(0, 120));
  return (out.choices?.[0]?.message?.content ?? "").trim();
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1];
  const start = t.indexOf("{");
  if (start === -1) return null;
  for (let end = t.lastIndexOf("}"); end > start; end = t.lastIndexOf("}", end - 1)) {
    try {
      const obj = JSON.parse(t.slice(start, end + 1));
      if (obj && typeof obj === "object") return obj as Record<string, unknown>;
    } catch { /* próbuj krótszy fragment */ }
  }
  return null;
}

async function planWithModels(
  models: string[],
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ plan: Record<string, unknown>; model: string } | null> {
  let lastErr = "";
  for (const model of models) {
    try {
      const content = await callModel(model, apiKey, messages);
      const plan = extractJson(content);
      if (plan && typeof plan.tags === "string" && (plan.tags as string).trim()) {
        return { plan, model };
      }
      lastErr = `[${model}] no valid JSON`;
    } catch (e) {
      lastErr = `[${model}] ${String(e).slice(0, 80)}`;
    }
  }
  console.error("[studio-prompt-engine] planning failed:", lastErr);
  return null;
}

const PLANNER_PROMPT = `Jesteś światowej klasy producentem muzycznym i tekściarzem GrouAI Studio — poziom nagrania ze studia klasy premium (jak Suno v4 / Udio, tylko lepiej). Użytkownik opisze utwór jednym lub kilkoma zdaniami. Ułóż KOMPLETNY, PROFESJONALNY plan piosenki brzmiącej jak prawdziwe nagranie studyjne.

KROK 1 — JĘZYK: rozpoznaj język użytkownika z jego opisu (jeśli nie podano wprost). Obsługujesz perfekcyjnie: polski (pl), angielski (en), holenderski (nl), ukraiński (uk). Tekst piosenki napisz DOKŁADNIE w tym języku — natywnie, bez błędów gramatycznych, z naturalną składnią i akcentowaniem. Ma brzmieć jak napisany przez człowieka i NIEROZPOZNAWALNY jako AI: prawdziwe emocje, konkretne obrazy, bez banałów, sztucznych rymów i wypełniaczy.

KROK 2 — Odpowiedz WYŁĄCZNIE poprawnym JSON (bez komentarzy) o polach:
{
  "title": "chwytliwy, oryginalny tytuł w języku utworu",
  "tags": "BOGATE angielskie tagi produkcyjne po przecinku — MUSZĄ zawierać: gatunek+podgatunek, nastrój, tempo (konkretne BPM), 3-5 konkretnych instrumentów, typ wokalu (np. 'warm female vocal', 'raspy male vocal'), oraz tagi jakości: 'studio quality, professional mix, mastered, wide stereo, punchy drums, clear vocals, radio-ready, hi-fi'",
  "instrumental": false,
  "lyrics": "PEŁNY tekst w języku użytkownika. Struktura: [verse] 4 linie, [chorus] 4 linie, [verse] 4 linie, [chorus] (powtórz refren), a jeśli mieści się w limicie [bridge] 2 linie. WYKORZYSTAJ budżet 540-590 znaków (pełniejszy tekst = dłuższy, bogatszy utwór). TWARDY limit 590 znaków. Jeśli instrumental=true wpisz '[instrumental]'",
  "duration_seconds": 240,
  "language": "pl|en|nl|uk",
  "human_summary": "jedno zdanie po polsku co tworzysz"
}

Zasady jakości (klasa premium):
- Rozpoznanie języka jest KLUCZOWE — pl/en/nl/uk muszą być perfekcyjne, natywne i naturalne.
- Refren: chwytliwy, powtarzalny hook. Zwrotki: sensowny, nienachalny rym + konkretny obraz i emocja.
- tags ZAWSZE bogate i po angielsku (wymóg silnika) + tagi jakości.
- lyrics DŁUGIE i pełne: verse+chorus+verse+chorus(+bridge), 540-590 znaków. Nigdy krótki tekst (krótki = krótki, ubogi utwór).
- duration_seconds: 240 (4 min) domyślnie; krótsze (min 120) tylko gdy user wprost prosi "krótki".
- Jeśli user podał własny tekst — użyj go (przytnij do ~590 znaków, jeśli za długi).
- Jeśli user prosi instrumental / muzykę tła bez wokalu — instrumental=true.

BARDZO WAŻNE: Odpowiedz WYŁĄCZNIE surowym obiektem JSON. Zacznij od { i zakończ na }. Bez wyjaśnień, rozumowania, markdown ani <think>.`;

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await live.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ success: false, error: "unauthorized" }, 401);

  const [{ data: isAdmin }, { data: subRow }] = await Promise.all([
    live.rpc("has_role", { _user_id: userId, _role: "admin" }),
    live.from("user_subscriptions").select("plan, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
  ]);
  const paidPlan = subRow && (subRow.plan === "pro" || subRow.plan === "ultimate");
  // PROMOCJA: do daty w hub_config.studio_free_until Studio jest darmowe dla WSZYSTKICH zalogowanych.
  const studioPromo = !!cfg["studio_free_until"] && Date.now() < Date.parse(cfg["studio_free_until"]);
  if (!isAdmin && !paidPlan && !studioPromo) {
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
  const langHint = body.language ? `\n(Użytkownik wybrał język: ${body.language} — pisz tekst w tym języku)` : "";

  try {
    const planned = await planWithModels(models, orKey, [
      { role: "system", content: PLANNER_PROMPT },
      { role: "user", content: prompt + langHint },
    ]);
    if (!planned) {
      return json({ success: false, error: "Nie udało się ułożyć planu utworu — spróbuj ponownie za chwilę." }, 200);
    }
    const plan = planned.plan;
    const result = { model: planned.model };

    const instrumental = !!plan.instrumental;
    const lyrics = instrumental ? "[instrumental]" : String(plan.lyrics || "[instrumental]");
    const duration = Math.min(Math.max(Number(plan.duration_seconds) || 240, 60), 240);
    const title = String(plan.title || "GrouAI Track").slice(0, 120);
    const tags = String(plan.tags);

    const rHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${repToken}` };
    let rel: Response;
    let engineName: string;
    if (!instrumental) {
      engineName = "minimax";
      const vocalModel = cfg["vocal_model"] || "minimax/music-1.5";
      const mmPrompt = (tags + ", studio quality, professional mix, mastered, clear vocals, hi-fi").slice(0, 300);
      // MiniMax przyjmuje tekst 10-600 znaków i sam rozwija go w pełny utwór.
      let mmLyrics = lyrics.replace(/\[(intro|outro)\][^\[]*/gi, "").trim();
      if (mmLyrics.length > 595) mmLyrics = mmLyrics.slice(0, 595).replace(/\s+\S*$/, "");
      if (mmLyrics.length < 10) mmLyrics = lyrics.slice(0, 595);
      rel = await fetch(`${REPLICATE_BASE}/models/${vocalModel}/predictions`, {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          input: {
            prompt: mmPrompt.length >= 10 ? mmPrompt : mmPrompt + ", modern pop, studio quality",
            lyrics: mmLyrics,
            audio_format: "mp3",
            bitrate: parseInt(cfg["minimax_bitrate"] || "256000", 10) || 256000,
            sample_rate: 44100,
          },
        }),
      });
    } else {
      engineName = "acestep";
      const modelName = cfg["ace_model"] || "lucataco/ace-step";
      const mr = await fetch(`${REPLICATE_BASE}/models/${modelName}`, { headers: rHeaders });
      const mData = await mr.json();
      const version = mData?.latest_version?.id;
      if (!mr.ok || !version) return json({ success: false, error: "model_version_failed" }, 502);

      const steps = Math.min(Math.max(parseInt(cfg["ace_steps"] || "120", 10) || 120, 10), 200);
      rel = await fetch(`${REPLICATE_BASE}/predictions`, {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          version,
          input: {
            tags: tags + ", high quality, studio recording, professional mixing, crisp clear audio",
            lyrics,
            duration,
            scheduler: cfg["ace_scheduler"] || "euler",
            guidance_scale: 15,
            number_of_steps: steps,
          },
        }),
      });
    }
    const relData = await rel.json();
    if (!rel.ok) {
      if (rel.status === 402) {
        return json({ success: false, error: "Brak środków na koncie generowania — daj znać administratorowi." }, 200);
      }
      return json({ success: false, error: "engine_start_failed", details: relData }, 200);
    }
    const predId = relData?.id;
    if (!predId) return json({ success: false, error: "no_prediction_id" }, 200);

    const coverReq = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/studio-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ id: predId, title, style: tags }),
    }).catch(() => null);
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(coverReq);

    const { data: gen } = await live.from("generations").insert({
      user_id: userId,
      title,
      genre: tags.split(",")[0]?.trim() || "ai",
      prompt: prompt.slice(0, 2000),
      lyrics: lyrics.slice(0, 4000),
      instrumental,
      status: "pending",
      replicate_id: predId,
      engine: engineName,
    }).select().single();

    return json({
      success: true,
      engine: engineName,
      task_id: predId,
      generation_id: gen?.id ?? null,
      plan: {
        title, tags, lyrics, instrumental,
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
