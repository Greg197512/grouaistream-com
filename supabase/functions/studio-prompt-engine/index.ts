// GrouAI Studio — Prompt Engine
// Naturalny język (PL/EN/NL/UK) → structured plan → automatyczny silnik (Suno/MusicGen/ElevenLabs)
// Działa BEZ n8n, bezpośrednio przez supabase.functions.invoke()
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Lang = "pl" | "en" | "nl" | "uk";

interface PromptPlan {
  language: Lang;
  genre: string;
  subgenre?: string;
  mood: string;
  bpm: number;
  music_key?: string;
  duration_seconds: number;
  instrumental: boolean;
  has_vocals: boolean;
  vocal_gender?: "male" | "female" | "neutral";
  vocal_style?: string;
  lyrics_theme?: string;
  reference_artists?: string[];
  intensity?: "minimal" | "balanced" | "rich" | "epic";
  engine_recommendation: "suno" | "musicgen" | "elevenlabs";
  human_summary: string; // krótkie, miłe potwierdzenie w języku usera
}

const SYSTEM_PROMPT = `You are GrouAI Studio's music NLU brain. The user describes a song they want in NATURAL LANGUAGE (Polish, English, Dutch, or Ukrainian). Your job is to extract a complete structured generation plan and recommend the best engine.

DETECT THE LANGUAGE of the user's prompt automatically (pl / en / nl / uk).

EXTRACT these fields (use sensible defaults if missing):
- genre (Pop, Rock, Electronic, Hip-Hop, Trap, Lo-fi, House, Ambient, Jazz, R&B, Country, Reggae, Metal, Indie, Classical, Disco)
- subgenre (e.g. "drill", "synthwave", "boom-bap") if implied
- mood (happy, sad, energetic, chill, romantic, dark, epic, nostalgic, dreamy, aggressive)
- bpm (number, 60-180). Smart defaults: trap=140, lo-fi=80, house=124, ambient=70, drill=140, ballad=70, drum&bass=174
- music_key (e.g. "C minor", "G major") only if clearly implied
- duration_seconds (8-240). Default 30 unless user says "long/full song" → 120, "krótki/snippet" → 15
- instrumental (true if user says "instrumental", "bez wokalu", "no vocals", "geen zang") else false
- has_vocals (opposite of instrumental)
- vocal_gender (male/female/neutral) if implied by "męski", "kobiecy", "vrouwelijk", "soft female", etc.
- vocal_style (e.g. "rap", "whisper", "powerful belting", "soft singing")
- lyrics_theme (1 short sentence describing what the lyrics should be ABOUT, in the user's language)
- reference_artists (array of artists if mentioned: "w stylu Daft Punk" → ["Daft Punk"])
- intensity (minimal/balanced/rich/epic)

ENGINE RECOMMENDATION (CRITICAL):
- "suno" → has vocals AND duration > 30s, full songs with lyrics. Best for emotional/storytelling tracks.
- "elevenlabs" → has vocals AND duration <= 30s, short premium vocal clips, hooks, jingles.
- "musicgen" → instrumental OR cheap/fast generation. Best for backgrounds, beats, ambient.

human_summary: ONE warm, friendly sentence in the user's detected language confirming what you understood. For Dutch use polite form ("U"). For Polish be enthusiastic. For English be cool. For Ukrainian be warm.

Return via the propose_plan tool.`;

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    language: { type: "string", enum: ["pl", "en", "nl", "uk"] },
    genre: { type: "string" },
    subgenre: { type: "string" },
    mood: { type: "string" },
    bpm: { type: "number" },
    music_key: { type: "string" },
    duration_seconds: { type: "number" },
    instrumental: { type: "boolean" },
    has_vocals: { type: "boolean" },
    vocal_gender: { type: "string", enum: ["male", "female", "neutral"] },
    vocal_style: { type: "string" },
    lyrics_theme: { type: "string" },
    reference_artists: { type: "array", items: { type: "string" } },
    intensity: { type: "string", enum: ["minimal", "balanced", "rich", "epic"] },
    engine_recommendation: { type: "string", enum: ["suno", "musicgen", "elevenlabs"] },
    human_summary: { type: "string" },
  },
  required: [
    "language",
    "genre",
    "mood",
    "bpm",
    "duration_seconds",
    "instrumental",
    "has_vocals",
    "engine_recommendation",
    "human_summary",
  ],
  additionalProperties: false,
};

function detectLangFallback(text: string): Lang {
  const t = text.toLowerCase();
  if (/[ąćęłńóśźż]/.test(t) || /\b(zrób|piosenk|utwór|smutn|wesoł|gitar|wokal)\b/.test(t)) return "pl";
  if (/[іїєґ]/.test(t) || /\b(зроби|пісн|музик)\b/.test(t)) return "uk";
  if (/\b(maak|liedje|nummer|stem|zang|vrolijk|verdrietig)\b/.test(t)) return "nl";
  return "en";
}

function buildEnginePrompt(plan: PromptPlan): string {
  // Buduje finalny prompt dla wybranego silnika (po angielsku — silniki rozumieją EN najlepiej)
  const parts: string[] = [];
  if (plan.subgenre) parts.push(`${plan.subgenre} ${plan.genre.toLowerCase()}`);
  else parts.push(plan.genre);
  if (plan.mood) parts.push(`${plan.mood} mood`);
  if (plan.bpm) parts.push(`${plan.bpm} BPM`);
  if (plan.music_key) parts.push(`in ${plan.music_key}`);
  if (plan.intensity) parts.push(`${plan.intensity} production`);
  if (plan.has_vocals && plan.vocal_gender) parts.push(`${plan.vocal_gender} vocals`);
  if (plan.vocal_style) parts.push(plan.vocal_style);
  if (plan.instrumental) parts.push("instrumental, no vocals");
  if (plan.reference_artists?.length) parts.push(`in the style of ${plan.reference_artists.join(", ")}`);
  if (plan.lyrics_theme && plan.has_vocals) parts.push(`about: ${plan.lyrics_theme}`);
  return parts.join(", ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const userPrompt: string = (body.prompt || "").trim();
    const forceEngine: string | undefined = body.force_engine;
    const forceLang: Lang | undefined = body.language;

    if (!userPrompt || userPrompt.length < 3) {
      return new Response(
        JSON.stringify({ error: "empty_prompt", message: "Powiedz mi coś więcej o utworze." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // === STEP 1: NLU — Gemini wyciąga structured plan przez tool calling
    console.log("[prompt-engine] parsing prompt:", userPrompt.substring(0, 100));

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_plan",
              description: "Return the structured generation plan extracted from the user's natural-language prompt.",
              parameters: PLAN_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_plan" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[prompt-engine] AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "Za dużo zapytań — spróbuj za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "no_credits", message: "Brak kredytów AI — doładuj Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "ai_failed", details: errText.substring(0, 300) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("[prompt-engine] No tool_call in AI response:", JSON.stringify(aiJson).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "ai_no_plan", message: "AI nie zrozumiało promptu. Spróbuj inaczej." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let plan: PromptPlan;
    try {
      plan = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("[prompt-engine] tool args parse fail:", toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: "ai_bad_plan", message: "Plan AI niepoprawny." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanity defaults + zabezpieczenie przed halucynacją
    plan.language = forceLang || plan.language || detectLangFallback(userPrompt);
    plan.genre = plan.genre || "Electronic";
    plan.mood = plan.mood || "balanced";
    plan.bpm = Math.max(60, Math.min(180, plan.bpm || 110));
    plan.duration_seconds = Math.max(8, Math.min(240, plan.duration_seconds || 30));
    plan.has_vocals = !plan.instrumental;

    // === STEP 2: Wybór silnika (force lub rekomendacja AI)
    let engine: "suno" | "musicgen" | "elevenlabs" =
      (forceEngine as any) || plan.engine_recommendation || "musicgen";

    // Walidacja zgodności
    if (plan.instrumental && engine === "elevenlabs") engine = "musicgen";
    if (engine === "elevenlabs" && plan.duration_seconds > 60) engine = "suno";

    const enginePrompt = buildEnginePrompt(plan);
    console.log("[prompt-engine] plan:", { engine, ...plan });

    // === STEP 3: Wpis do studio_generations
    const { data: gen, error: genErr } = await supabase
      .from("studio_generations")
      .insert({
        user_id: userId,
        ai_model: engine,
        prompt: enginePrompt.substring(0, 2000),
        status: "pending",
        duration_seconds: plan.duration_seconds,
        bpm: plan.bpm,
        music_key: plan.music_key || null,
        genre: plan.genre,
        subgenre: plan.subgenre || null,
        mood: plan.mood,
        metadata: {
          source: "prompt-engine",
          original_prompt: userPrompt,
          language: plan.language,
          plan,
          engine_chosen: engine,
        },
      })
      .select()
      .single();

    if (genErr || !gen) {
      console.error("[prompt-engine] db insert fail:", genErr);
      return new Response(
        JSON.stringify({ error: "db_insert_failed", details: genErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === STEP 4: Wywołaj odpowiedni silnik (bez n8n!)
    let result: any = { generation_id: gen.id, engine, plan };

    try {
      if (engine === "musicgen") {
        const r = await supabase.functions.invoke("replicate-musicgen", {
          body: {
            prompt: enginePrompt,
            duration: Math.min(plan.duration_seconds, 60),
            generation_id: gen.id,
          },
        });
        if (r.error) {
          console.error("[prompt-engine] musicgen invoke err:", r.error);
          result.error = "musicgen_failed";
          result.error_message = r.error.message;
        } else {
          result.audio_url = r.data?.audio_url;
          result.completed = !!r.data?.audio_url;
          result.cost_estimate_usd = r.data?.cost_estimate_usd;
        }
      } else if (engine === "suno") {
        const r = await supabase.functions.invoke("suno-generate", {
          body: {
            prompt: plan.lyrics_theme || enginePrompt,
            style: plan.genre,
            title: plan.lyrics_theme?.substring(0, 60) || `${plan.genre} ${plan.mood}`,
            instrumental: plan.instrumental,
          },
        });
        if (r.error) {
          console.error("[prompt-engine] suno invoke err:", r.error);
          result.error = "suno_failed";
          result.error_message = r.error.message;
        } else {
          const taskId = r.data?.data?.taskId || r.data?.taskId;
          result.task_id = taskId;
          result.processing = true;
          if (taskId) {
            await supabase
              .from("studio_generations")
              .update({ platform_track_id: taskId, status: "processing" })
              .eq("id", gen.id);
          }
        }
      } else if (engine === "elevenlabs") {
        const elKey = Deno.env.get("ELEVENLABS_API_KEY");
        if (!elKey) {
          result.error = "elevenlabs_no_key";
        } else {
          const elResp = await fetch("https://api.elevenlabs.io/v1/music/compositions", {
            method: "POST",
            headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: enginePrompt,
              music_length_ms: Math.min(plan.duration_seconds * 1000, 90000),
            }),
          });
          if (elResp.ok) {
            const elData = await elResp.json();
            result.task_id = elData.composition_id || elData.id;
            result.processing = true;
            await supabase
              .from("studio_generations")
              .update({ platform_track_id: result.task_id, status: "processing" })
              .eq("id", gen.id);
          } else {
            const txt = await elResp.text();
            console.error("[prompt-engine] elevenlabs err:", elResp.status, txt);
            result.error = `elevenlabs_${elResp.status}`;
          }
        }
      }
    } catch (e) {
      console.error("[prompt-engine] engine invoke exception:", e);
      result.error = "engine_exception";
      result.error_message = e instanceof Error ? e.message : String(e);
    }

    if (result.error) {
      await supabase.from("studio_generations").update({ status: "failed" }).eq("id", gen.id);
    }

    return new Response(JSON.stringify({ success: !result.error, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[prompt-engine] fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
