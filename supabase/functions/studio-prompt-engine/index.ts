// GrouAI Studio — Prompt Engine v2
// Naturalny język (PL/EN/NL/UK) → structured plan → MusicGen (muzyka) + ElevenLabs (głos opcjonalnie)
// ElevenLabs służy WYŁĄCZNIE do głosów — NIGDY do generowania muzyki. Suno nie ma API.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Lang = "pl" | "en" | "nl" | "uk";
type Engine = "musicgen" | "acestep";

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
  full_lyrics?: string;             // complete singable lyrics in vocal language (for ACE-Step)
  reference_artists?: string[];
  intensity?: "minimal" | "balanced" | "rich" | "epic";
  instruments?: string[];           // specific instruments mentioned
  suno_style_tags?: string[];       // Suno/ACE-Step style descriptors
  engine_recommendation: Engine;
  human_summary: string;
}

// System prompt — MusicGen dla muzyki, ElevenLabs opcjonalnie dla głosu
const SYSTEM_PROMPT = `You are GrouAI Studio's music intelligence engine. The user describes music they want in NATURAL LANGUAGE (Polish, English, Dutch, or Ukrainian).

IMPORTANT ARCHITECTURE: There is 1 music engine:
- "musicgen" → for ALL music: instrumentals, beats, backgrounds, ambient, and tracks that will later receive vocals

ElevenLabs is VOICE-ONLY (applied separately after music generation). Suno has no public API.

DETECT LANGUAGE automatically (pl / en / nl / uk).

EXTRACT all fields:
- genre: one of [Pop, Rock, Electronic, Hip-Hop, Trap, Lo-fi, House, Ambient, Jazz, R&B, Country, Reggae, Metal, Indie, Classical, Disco, Drill, Phonk, DnB, Techno, Funk, Soul, Gospel, Afrobeat]
- subgenre: specific subgenre if implied (synthwave, boom-bap, melodic trap, liquid dnb, etc.)
- mood: [happy, sad, energetic, chill, romantic, dark, epic, nostalgic, dreamy, aggressive, melancholic, uplifting, mysterious, groovy]
- bpm: integer 60-200. Defaults: trap/drill=140, lo-fi=80, house=124, techno=135, dnb=174, ambient=75, ballad=70, phonk=140, funk=108, pop=115
- music_key: e.g. "C minor", "G major" — only if mentioned or clearly implied
- duration_seconds: 8-300. Default 30. "długa piosenka/full song" → 120. "snippet/hook" → 15
- instrumental: true if "instrumental/bez wokalu/no vocals/geen zang/без вокалу"
- has_vocals: !instrumental
- vocal_gender: male/female/neutral (from "kobiecy głos", "male singer", "mannenstem", etc.)
- vocal_style: singing/rap/whisper/powerful/soft/opera/choir/spoken
- lyrics_theme: what the song should BE ABOUT (1 concise English sentence, even if user wrote in another language)
- full_lyrics: IF has_vocals, WRITE THE COMPLETE SONG LYRICS in the user's vocal language (Polish if pl, English if en, Dutch if nl, Ukrainian if uk). Use structure tags [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. 8-24 lines, singable, matching mood/theme. If user provided their own lyrics, PRESERVE and only add structure. If instrumental, leave empty.
- reference_artists: artists mentioned or clearly implied in style
- intensity: minimal/balanced/rich/epic
- instruments: specific instruments mentioned ["electric guitar", "piano", "808 bass", "violin", etc.]

MUSICGEN STYLE TAGS — generate 4-8 comma-separated style descriptors optimized for MusicGen:
These must be SPECIFIC and EVOCATIVE. Examples:
- Bad: "pop music with singing"
- Good: "dreamy indie pop, jangly guitars, lush reverb, 2010s indie vibes, nostalgic, bittersweet, 85 BPM"
- Bad: "electronic music"
- Good: "dark techno, aggressive kick, acidic 303 bassline, industrial atmosphere, Berlin underground, minimal and hypnotic"

ENGINE DECISION:
- "acestep" → preferred for songs WITH vocals (ACE-Step actually sings the lyrics in PL/EN/NL/UK)
- "acestep" also fine for instrumentals
- "musicgen" → only as fallback for pure instrumental when ACE-Step unavailable

human_summary: ONE enthusiastic sentence in user's DETECTED language confirming what you understood.
Polish: "Tworzę dla Ciebie..."
English: "Creating for you..."
Dutch: "Ik maak voor u..."
Ukrainian: "Створюю для вас..."

Return via propose_plan tool.`;

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
    full_lyrics: { type: "string" },
    reference_artists: { type: "array", items: { type: "string" } },
    intensity: { type: "string", enum: ["minimal", "balanced", "rich", "epic"] },
    instruments: { type: "array", items: { type: "string" } },
    suno_style_tags: { type: "array", items: { type: "string" } },
    engine_recommendation: { type: "string", enum: ["musicgen", "acestep"] },
    human_summary: { type: "string" },
  },
  required: ["language", "genre", "mood", "bpm", "duration_seconds", "instrumental", "has_vocals", "engine_recommendation", "human_summary"],
  additionalProperties: false,
};

function detectLangFallback(text: string): Lang {
  const t = text.toLowerCase();
  if (/[ąćęłńóśźż]/.test(t) || /\b(zrób|piosenk|utwór|smutn|wesoł|gitar|wokal|nagraj)\b/.test(t)) return "pl";
  if (/[іїєґ]/.test(t) || /\b(зроби|пісн|музик|створи)\b/.test(t)) return "uk";
  if (/\b(maak|liedje|nummer|stem|zang|vrolijk|verdrietig|muziek)\b/.test(t)) return "nl";
  return "en";
}

// Buduje optymalny prompt dla Suno v4 — rich style descriptors
function buildSunoPrompt(plan: PromptPlan): string {
  // Priorytet: suno_style_tags (AI już sformatowało), potem własna budowa
  if (plan.suno_style_tags && plan.suno_style_tags.length >= 3) {
    return plan.suno_style_tags.join(", ").substring(0, 500);
  }

  const parts: string[] = [];
  // Genre + subgenre first (most important for Suno)
  if (plan.subgenre) parts.push(`${plan.subgenre} ${plan.genre.toLowerCase()}`);
  else parts.push(plan.genre.toLowerCase());

  // Mood (Suno responds well to mood descriptors)
  parts.push(`${plan.mood}`);

  // BPM and key for precise control
  if (plan.bpm) parts.push(`${plan.bpm} BPM`);
  if (plan.music_key) parts.push(`key of ${plan.music_key}`);

  // Reference artists (strongest Suno signal)
  if (plan.reference_artists?.length) {
    parts.push(`inspired by ${plan.reference_artists.slice(0, 2).join(" and ")}`);
  }

  // Specific instruments
  if (plan.instruments?.length) {
    parts.push(plan.instruments.slice(0, 3).join(", "));
  }

  // Vocal details
  if (plan.has_vocals) {
    if (plan.vocal_gender && plan.vocal_gender !== "neutral") parts.push(`${plan.vocal_gender} vocalist`);
    if (plan.vocal_style) parts.push(plan.vocal_style);
  } else {
    parts.push("instrumental, no vocals");
  }

  // Production quality
  if (plan.intensity) parts.push(`${plan.intensity} production`);
  parts.push("professional studio quality, high fidelity");

  return parts.join(", ").substring(0, 500);
}

// Buduje prompt dla MusicGen — krótki i precyzyjny
function buildMusicGenPrompt(plan: PromptPlan): string {
  const parts: string[] = [];
  if (plan.subgenre) parts.push(`${plan.subgenre} ${plan.genre.toLowerCase()}`);
  else parts.push(plan.genre.toLowerCase());

  parts.push(`${plan.mood}`);
  if (plan.bpm) parts.push(`${plan.bpm} bpm`);
  if (plan.music_key) parts.push(`in ${plan.music_key}`);
  if (plan.instruments?.length) parts.push(plan.instruments.slice(0, 4).join(", "));
  if (plan.reference_artists?.length) parts.push(`like ${plan.reference_artists[0]}`);
  parts.push("instrumental");
  if (plan.intensity === "epic") parts.push("cinematic, orchestral");
  if (plan.intensity === "minimal") parts.push("sparse, minimal");

  return parts.join(", ").substring(0, 300);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const userPrompt: string = (body.prompt || "").trim();
    const forceEngine: Engine | undefined = body.force_engine;
    const forceLang: Lang | undefined = body.language;
    const planOnly: boolean = !!body.plan_only; // skip music engine call, just return plan + full_lyrics

    if (!userPrompt || userPrompt.length < 3) {
      return new Response(
        JSON.stringify({ error: "empty_prompt", message: "Opisz utwór który chcesz stworzyć." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    console.log("[prompt-engine v2] parsing:", userPrompt.substring(0, 100));

    // NLU: Gemini extracts structured plan via tool call
    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "propose_plan",
            description: "Return the structured music generation plan.",
            parameters: PLAN_SCHEMA,
          },
        }],
        tool_choice: { type: "function", function: { name: "propose_plan" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[prompt-engine v2] AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "Za dużo zapytań — spróbuj za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      return new Response(
        JSON.stringify({ error: "ai_no_plan", message: "AI nie zrozumiało promptu. Spróbuj opisać inaczej." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let plan: PromptPlan;
    try {
      plan = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(
        JSON.stringify({ error: "ai_bad_plan", message: "Błąd parsowania planu AI." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize + defaults
    plan.language = forceLang || plan.language || detectLangFallback(userPrompt);
    plan.genre = plan.genre || "Electronic";
    plan.mood = plan.mood || "energetic";
    plan.bpm = Math.max(60, Math.min(200, plan.bpm || 110));
    plan.duration_seconds = Math.max(8, Math.min(300, plan.duration_seconds || 30));
    plan.has_vocals = !plan.instrumental;

    // MusicGen to jedyny silnik muzyczny. Suno nie ma publicznego API.
    const engine: Engine = "musicgen";

    const enginePrompt = buildMusicGenPrompt(plan);

    console.log("[prompt-engine v2] engine:", engine, "prompt:", enginePrompt.substring(0, 100));

    // Save to studio_generations
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
          source: "prompt-engine-v2",
          original_prompt: userPrompt,
          language: plan.language,
          plan,
          engine_chosen: engine,
          suno_style_tags: plan.suno_style_tags || [],
        },
      })
      .select()
      .single();

    if (genErr || !gen) {
      console.error("[prompt-engine v2] db insert fail:", genErr);
      return new Response(
        JSON.stringify({ error: "db_insert_failed", details: genErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result: Record<string, unknown> = { generation_id: gen.id, engine, plan };

    if (planOnly) {
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          result.error = "musicgen_failed";
          result.error_message = r.error.message;
        } else {
          result.audio_url = r.data?.audio_url;
          result.completed = !!r.data?.audio_url;
          result.cost_estimate_usd = r.data?.cost_estimate_usd;
        }
      }
    } catch (e) {
      result.error = "engine_exception";
      result.error_message = e instanceof Error ? e.message : String(e);
    }

    if (result.error) {
      await supabase.from("studio_generations").update({ status: "failed" }).eq("id", gen.id);
    }

    return new Response(JSON.stringify({ success: !result.error, ...result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[prompt-engine v2] fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
