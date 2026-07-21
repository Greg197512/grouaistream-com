// Suno V5 engine (primary) with V4_5PLUS auto-fallback + GPT-5.5 prompt/lyrics enhancer.
// Normalized response shape so SunoGeneratePanel can poll it identically to acestep/musicgen:
//   generate → { id: <taskId>, status: "queued" }
//   status   → { status: "processing"|"succeeded"|"failed", audio_url?, cover_url?, title?, duration? }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUNO_API_BASE = "https://api.sunoapi.org/api/v1";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// GPT-5.5 rewrites user idea into a top-tier Suno prompt (style + optional lyrics).
// Optimized for PL phonetics + clean instrumentation cues.
async function enhanceWithGPT(input: {
  prompt: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
  language?: string;
}): Promise<{ style: string; title: string; lyrics: string } | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  const lang = input.language || "pl";
  const langName = { pl: "Polish", en: "English", nl: "Dutch", ua: "Ukrainian" }[lang] || "Polish";

  const sys = `You are a world-class Suno V5 prompt engineer and lyricist for GrouAI Studio.
Your #1 goal: MAXIMUM AUDIO CLARITY. The output must sound like a professionally mixed and mastered studio record — never muddy, never lo-fi, never distorted, never boxy.

Return STRICT JSON only, no markdown:
{
  "style": "<up to 200-char rich style tag>",
  "title": "<catchy 2-5 word title>",
  "lyrics": "<full song in ${langName} with [Verse]/[Chorus]/[Bridge]/[Outro] tags, or empty string if instrumental>"
}

Rules for lyrics:
- Native ${langName}, natural stress, singable syllables, regular rhymes (AABB or ABAB), 4-8 syllables per line.
- For Polish: unikaj trudnych zbitek spółgłoskowych, dobieraj samogłoski wygodne do śpiewu.
- Structure: [Verse 1] / [Chorus] / [Verse 2] / [Chorus] / [Bridge] / [Chorus] / [Outro].

Rules for style (CRITICAL for clean sound):
- Always include these clarity anchors: "crystal clear mix, pristine high fidelity, 24-bit studio master, wide stereo image, deep controlled sub-bass, airy top end, transparent vocals up-front, zero distortion, zero mud, professional mastering, radio-ready, reference-monitor quality".
- Name PRECISE instruments and their character (e.g. "warm Rhodes electric piano, felt-hammer grand piano, analog Moog bass, live acoustic drums with tight snare, silky violin section").
- Include a specific vocal descriptor unless instrumental (e.g. "emotive male tenor, warm intimate delivery, close-mic'd, subtle reverb").
- Avoid: "lofi", "vintage tape hiss", "8-bit", "compressed radio", "phone speaker", "muffled", "distorted", "trashy", "grunge".
- Avoid generic filler ("nice", "cool", "good").`;

  const usr = `Description: ${input.prompt}
Requested style hint: ${input.style || "(none, choose best)"}
Requested title hint: ${input.title || "(auto)"}
Instrumental: ${input.instrumental ? "yes (lyrics must be empty)" : "no (write full lyrics)"}
Language: ${langName}`;

  try {
    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("[suno-generate] GPT enhance failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = await res.json();
    const raw = j.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return {
      style: String(parsed.style || input.style || "modern pop, clean mix, radio-ready").slice(0, 200),
      title: String(parsed.title || input.title || "GrouAI Track").slice(0, 80),
      lyrics: input.instrumental ? "" : String(parsed.lyrics || ""),
    };
  } catch (e) {
    console.error("[suno-generate] GPT enhance error:", e);
    return null;
  }
}

async function callSuno(apiKey: string, body: any) {
  return fetch(`${SUNO_API_BASE}/generate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
  if (!SUNO_API_KEY) {
    return new Response(JSON.stringify({ error: "SUNO_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const action = body.action || (body.taskId || body.task_id || body.prediction_id ? "status" : "generate");

    // -------- STATUS --------
    if (action === "status") {
      const taskId = body.taskId || body.task_id || body.prediction_id;
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await fetch(`${SUNO_API_BASE}/generate/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${SUNO_API_KEY}` },
      });
      const j = await r.json();
      if (!r.ok) {
        return new Response(JSON.stringify({ status: "failed", error: j?.msg || `HTTP ${r.status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const d = j?.data;
      const s = String(d?.status || "").toUpperCase();
      const items = d?.response?.sunoData || d?.response?.data || [];
      const first = Array.isArray(items) ? items[0] : null;
      let norm: any = { status: "processing", raw_status: s };
      if (s === "SUCCESS" || s === "COMPLETE" || first?.audioUrl) {
        norm = {
          status: "succeeded",
          id: taskId,
          audio_url: first?.audioUrl || first?.streamAudioUrl || first?.sourceAudioUrl,
          cover_url: first?.imageUrl || first?.sourceImageUrl || "",
          title: first?.title || "",
          duration: first?.duration || 0,
          all: items,
        };
      } else if (s === "CREATE_TASK_FAILED" || s === "GENERATE_AUDIO_FAILED" || s === "CALLBACK_EXCEPTION" || s === "SENSITIVE_WORD_ERROR") {
        norm = { status: "failed", error: d?.errorMessage || s };
      }
      return new Response(JSON.stringify(norm), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- GENERATE --------
    const { prompt = "", style = "", title = "", instrumental = false, vocal_language, language, enhance = true } = body;

    let finalStyle = style;
    let finalTitle = title;
    let finalLyrics = ""; // Suno's `prompt` field = lyrics in customMode

    if (enhance) {
      const boost = await enhanceWithGPT({
        prompt, style, title, instrumental,
        language: vocal_language || language || "pl",
      });
      if (boost) {
        finalStyle = boost.style;
        finalTitle = boost.title;
        finalLyrics = boost.lyrics;
      }
    }

    // Fallbacks if GPT unavailable
    if (!finalStyle) finalStyle = "modern pop, warm analog synth, punchy drums, clean mix, radio-ready, high fidelity";
    if (!finalTitle) finalTitle = "GrouAI Track";

    const callBackUrl = `${supabaseUrl}/functions/v1/suno-generate`;

    // Custom mode gives us full control (style + title + lyrics). We use it whenever we have enhanced output.
    const useCustom = !!(finalStyle || finalTitle || finalLyrics) && (instrumental || finalLyrics.length > 0);

    const baseBody: any = {
      customMode: useCustom,
      instrumental: !!instrumental,
      callBackUrl,
    };
    if (useCustom) {
      baseBody.style = finalStyle.slice(0, 200);
      baseBody.title = finalTitle.slice(0, 80);
      baseBody.prompt = instrumental ? "" : finalLyrics.slice(0, 3000);
    } else {
      // Non-custom V5 accepts free-form description in `prompt`.
      baseBody.prompt = `${prompt} — ${finalStyle}`.slice(0, 400);
    }

    // Try V5 first, fallback to V4_5PLUS on model error.
    const modelsToTry = ["V5", "V4_5PLUS"];
    let genData: any = null;
    let genOk = false;
    let usedModel = "";
    let lastErr = "";
    for (const m of modelsToTry) {
      const res = await callSuno(SUNO_API_KEY, { ...baseBody, model: m });
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j?.code === 200 || j?.data?.taskId)) {
        genData = j;
        genOk = true;
        usedModel = m;
        break;
      }
      lastErr = `[${m}] HTTP ${res.status} ${JSON.stringify(j).slice(0, 300)}`;
      console.warn("[suno-generate] model failed, trying next:", lastErr);
    }

    if (!genOk) {
      return new Response(JSON.stringify({ error: `Suno generate failed: ${lastErr}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taskId = genData?.data?.taskId || genData?.data?.task_id;
    if (!taskId) {
      return new Response(JSON.stringify({ error: "No taskId returned", raw: genData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      id: taskId,
      task_id: taskId,
      taskId,
      status: "queued",
      model: usedModel,
      enhanced: enhance,
      style: finalStyle,
      title: finalTitle,
      lyrics: finalLyrics,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[suno-generate] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
