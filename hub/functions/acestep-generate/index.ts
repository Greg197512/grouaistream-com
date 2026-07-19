// GROUAI HUB — acestep-generate
// Naprawiony silnik ACE-Step (Replicate) dla GrouAI Studio.
// Powód istnienia: wersja na LIVE (bvstv) woła /models/{owner}/{name}/predictions,
// który działa tylko dla modeli oficjalnych → 404 dla lucataco/ace-step.
// Tu: klasyczny POST /v1/predictions z version id + archiwizacja audio do
// Storage huba (linki Replicate wygasają po ~1h).
//
// Auth: JWT użytkownika z LIVE (bvstv) w nagłówku Authorization — weryfikowany
// przez auth bvstv; zapisy do tabeli generations na bvstv idą jako ten user (RLS).
// Klucz Replicate: hub_config.replicate_api_token.
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

function hubAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function loadConfig(): Promise<Record<string, string>> {
  const { data } = await hubAdmin().from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

// ─── SILNIK EMOCJI (wersja kompaktowa; pełna w studio-prompt-engine) ──────────
// Walencja→tryb, pobudzenie→tempo — wg badań psychologii muzyki (Russell 1980;
// Gabrielsson & Lindström 2010). body.aura = {valence, arousal, emotion}.
const EMOTION_MUSIC: Record<string, { mode: string; bpm: [number, number]; tags: string }> = {
  happy:     { mode: "major key", bpm: [112, 128], tags: "bright uplifting harmony, bouncy groove, warm smiling vocal tone" },
  sad:       { mode: "minor key", bpm: [62, 84],   tags: "melancholic, sparse soft piano, legato strings, intimate fragile vocals" },
  angry:     { mode: "minor key", bpm: [140, 165], tags: "aggressive, distorted, sharp attacks, forceful gritty delivery" },
  fearful:   { mode: "minor key", bpm: [92, 112],  tags: "tense, tremolo strings, dark low drones, hushed unstable vocals" },
  disgusted: { mode: "dark minor key", bpm: [88, 104], tags: "gritty detuned synths, industrial textures, cold detached delivery" },
  surprised: { mode: "major key", bpm: [124, 138], tags: "euphoric, big builds and drops, expressive dynamic vocals" },
  neutral:   { mode: "modal harmony", bpm: [92, 108], tags: "dreamy, lush pads, smooth relaxed vocals" },
  calm:      { mode: "major key", bpm: [64, 84],   tags: "peaceful, warm pads, gentle percussion, soft airy vocals" },
  romantic:  { mode: "major key with added 7ths", bpm: [70, 92], tags: "intimate, warm rhodes, silky strings, tender breathy vocals" },
  energetic: { mode: "major key", bpm: [126, 140], tags: "high-energy four-on-the-floor, punchy kick, powerful confident vocals" },
  focused:   { mode: "minimal harmonic movement", bpm: [100, 116], tags: "steady hypnotic pulse, minimal arrangement, calm even delivery" },
};

function emotionTags(aura: Record<string, unknown> | null | undefined): string {
  if (!aura || typeof aura !== "object") return "";
  const v = typeof aura.valence === "number" ? (aura.valence as number) : 0.2;
  const a = typeof aura.arousal === "number" ? (aura.arousal as number) : 0.5;
  const key = String(aura.emotion || "").toLowerCase();
  let base = EMOTION_MUSIC[key];
  if (!base) {
    base = v >= 0
      ? (a >= 0.55 ? EMOTION_MUSIC.happy : EMOTION_MUSIC.calm)
      : (a >= 0.55 ? EMOTION_MUSIC.angry : EMOTION_MUSIC.sad);
  }
  const clampA = Math.min(Math.max(a, 0), 1);
  const bpm = Math.round(base.bpm[0] + (base.bpm[1] - base.bpm[0]) * clampA);
  return `${base.mode}, ${bpm} bpm, ${base.tags}`;
}

// Zapis do zbioru uczącego silnika (hub) — nie blokuje odpowiedzi.
function logLearning(row: Record<string, unknown>) {
  const p = hubAdmin().from("engine_learning").insert(row).then(
    ({ error }) => { if (error) console.warn("[engine_learning]", error.message); },
  );
  // @ts-ignore — EdgeRuntime.waitUntil jest dostępne w Supabase Edge Runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(p);
}

function extractAudioUrl(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      return (o.audio as string) || (o.url as string) || "";
    }
  }
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    return (o.audio as string) || (o.url as string) || "";
  }
  return "";
}

// Ściągnij audio z Replicate i zapisz w publicznym buckecie huba.
async function archiveToHubStorage(sourceUrl: string, id: string): Promise<string | null> {
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) return null;
    const contentType = r.headers.get("Content-Type") || "audio/wav";
    const ext = contentType.includes("mpeg") ? "mp3"
      : contentType.includes("flac") ? "flac"
      : contentType.includes("ogg") ? "ogg"
      : "wav";
    const bytes = new Uint8Array(await r.arrayBuffer());
    const path = `${id}.${ext}`;
    const { error } = await hubAdmin().storage.from("acestep").upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.error("[acestep-hub] storage upload failed:", error.message);
      return null;
    }
    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/acestep/${path}`;
  } catch (e) {
    console.error("[acestep-hub] archive error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cfg = await loadConfig();
  const token = cfg["replicate_api_token"] || "";
  if (!token) return json({ error: "replicate_api_token not configured (hub_config)" }, 500);

  const rHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  // Klient bvstv w kontekście zalogowanego użytkownika strony
  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body.action ?? "generate";

  try {
    // ================= STATUS =================
    if (action === "status") {
      const predId = body.task_id || body.prediction_id || body.replicate_id;
      if (!predId) return json({ error: "prediction_id required" }, 400);

      const r = await fetch(`${REPLICATE_BASE}/predictions/${predId}`, { headers: rHeaders });
      const data = await r.json();
      if (!r.ok) return json({ error: "Replicate poll failed", details: data }, r.status);

      const st = data?.status;

      if (st === "succeeded") {
        const audioUrl = extractAudioUrl(data.output);
        if (!audioUrl) return json({ error: "no audio in output", details: data.output }, 502);

        const archived = await archiveToHubStorage(audioUrl, predId);
        const finalUrl = archived || audioUrl;

        if (body.generation_id) {
          await live.from("generations").update({
            status: "completed",
            audio_url: finalUrl,
          }).eq("id", body.generation_id);
        }

        return json({
          id: predId,
          status: "succeeded",
          output: finalUrl,
          audio_url: finalUrl,
          // Okładka generowana równolegle przez studio-cover pod deterministycznym
          // adresem — frontend robi fallback, jeśli plik (jeszcze) nie istnieje.
          cover_url: `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/acestep/${predId}-cover.jpg`,
          r2_archived: !!archived,
        });
      }

      if (st === "failed" || st === "canceled") {
        if (body.generation_id) {
          await live.from("generations").update({ status: "failed" }).eq("id", body.generation_id);
        }
        return json({ id: predId, status: "failed", error: data?.error });
      }

      return json({ id: predId, status: "processing" });
    }

    // ================= GENERATE =================
    const { data: userData } = await live.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    // Generowanie tylko dla planów płatnych (Pro/Ultimate) lub admina —
    // każda generacja kosztuje realne pieniądze na Replicate.
    const [{ data: isAdmin }, { data: subRow }] = await Promise.all([
      live.rpc("has_role", { _user_id: userId, _role: "admin" }),
      live.from("user_subscriptions").select("plan, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
    ]);
    const paidPlan = subRow && (subRow.plan === "pro" || subRow.plan === "ultimate");
    if (!isAdmin && !paidPlan) {
      return json({
        error: "subscription_required",
        message: "Generowanie muzyki wymaga planu Pro lub Ultimate.",
      }, 403);
    }

    const prompt: string = (body.prompt || body.caption || "").trim();
    if (prompt.length < 3) return json({ error: "prompt too short" }, 400);

    const instrumental: boolean = !!body.instrumental;
    const lyrics: string = instrumental ? "[instrumental]" : (body.lyrics || "[instrumental]").trim();
    const duration: number = Math.min(Math.max(body.duration || body.duration_seconds || 180, 10), 360);
    const title: string = body.title || "GrouAI Track";

    // Warunkowanie emocjonalne: świeża detekcja aury (body.aura) dostraja
    // tryb/tempo/barwę tak, by utwór realnie oddawał stan słuchacza.
    const emoTags = emotionTags(body.aura);
    const promptWithEmo = emoTags ? `${prompt}, ${emoTags}` : prompt;

    // ROUTING SILNIKÓW (poziom v4):
    // - wokal ORAZ instrumental → MiniMax music-2.6 (oddech, vibrato, BPM/tonacja,
    //   do 6 min — klasa najbliższa Suno i wyżej)
    // - ACE-Step tylko gdy hub_config.instrumental_engine="acestep" (tańszy wariant)
    const instrEngine = (cfg["instrumental_engine"] || "minimax").toLowerCase();
    const useMinimax = !instrumental || instrEngine === "minimax";
    const qualitySuffix = ", high quality, studio recording, professional mixing, crisp clear master, radio-ready, rich dynamics";
    let rel: Response;
    let engineName: string;
    if (useMinimax) {
      engineName = instrumental ? "minimax-inst" : "minimax";
      const vocalModel = cfg["vocal_model"] || "minimax/music-2.6";
      const mmPrompt = (promptWithEmo + qualitySuffix).slice(0, 300);
      const hasLyrics = !instrumental && !!lyrics && lyrics !== "[instrumental]" && lyrics.trim().length > 2;
      const input: Record<string, unknown> = {
        prompt: mmPrompt.length >= 10 ? mmPrompt : mmPrompt + ", modern pop",
        audio_format: "mp3",
        bitrate: parseInt(cfg["minimax_bitrate"] || "256000", 10) || 256000,
        sample_rate: 44100,
      };
      if (instrumental) {
        input.is_instrumental = true;
      } else if (hasLyrics) {
        input.lyrics = lyrics.slice(0, 3500);
      } else {
        // Brak tekstu → model sam dopisze tekst pasujący do stylu.
        input.lyrics_optimizer = true;
      }
      rel = await fetch(`${REPLICATE_BASE}/models/${vocalModel}/predictions`, {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({ input }),
      });
    } else {
      engineName = "acestep";
      // Model społecznościowy ⇒ wymagany version id (endpoint /predictions).
      const modelName = cfg["ace_model"] || "lucataco/ace-step";
      const mr = await fetch(`${REPLICATE_BASE}/models/${modelName}`, { headers: rHeaders });
      const mData = await mr.json();
      const version = mData?.latest_version?.id;
      if (!mr.ok || !version) {
        return json({ error: "Cannot resolve model version", details: mData }, 502);
      }
      // Jakość: więcej kroków = czystszy dźwięk; strojenie: hub_config.ace_steps.
      const steps = Math.min(Math.max(parseInt(cfg["ace_steps"] || "150", 10) || 150, 10), 200);
      rel = await fetch(`${REPLICATE_BASE}/predictions`, {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({
          version,
          input: {
            tags: promptWithEmo + ", high quality, studio recording, professional mixing, crisp clear audio",
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
      // Czytelny komunikat, gdy brak środków na koncie Replicate
      if (relData?.status === 402 || rel.status === 402) {
        return json({
          error: "Konto Replicate nie ma środków — doładuj na replicate.com/account/billing",
          details: relData,
        }, 402);
      }
      return json({ error: "Replicate create failed", details: relData }, rel.status);
    }

    const predId = relData?.id;
    if (!predId) return json({ error: "No prediction id from Replicate", details: relData }, 502);

    // Okładka AI startuje automatycznie po stronie serwera — każdy utwór ją
    // dostaje, niezależnie od tego, skąd przyszło zlecenie (UI, API, testy).
    const coverReq = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/studio-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ id: predId, title, style: body.genre || prompt.slice(0, 150) }),
    }).catch(() => null);
    // @ts-ignore — EdgeRuntime.waitUntil jest dostępne w Supabase Edge Runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(coverReq);

    const { data: gen } = await live.from("generations").insert({
      user_id: userId,
      title,
      genre: body.genre || "ai",
      prompt: prompt.slice(0, 2000),
      lyrics: lyrics.slice(0, 4000),
      instrumental,
      status: "pending",
      replicate_id: predId,
      engine: engineName,
    }).select().single();

    logLearning({
      user_id: userId,
      source: body.source === "aura" ? "aura" : "studio-direct",
      prompt: prompt.slice(0, 2000),
      language: body.language || null,
      aura: body.aura && typeof body.aura === "object" ? body.aura : null,
      plan: { title, tags: promptWithEmo.slice(0, 1500), instrumental, duration },
      engine: engineName,
      task_id: predId,
    });

    return json({
      id: predId,
      generation_id: gen?.id ?? null,
      status: "starting",
      engine: engineName,
      duration,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[acestep-hub] fatal", msg);
    return json({ error: msg }, 500);
  }
});
