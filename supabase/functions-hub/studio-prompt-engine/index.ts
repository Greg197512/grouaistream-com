// GROUAI HUB — studio-prompt-engine v3 „GrouAI Engine"
// Tryb "jak Suno, tylko lepiej": jedno zdanie od użytkownika → AI układa całą
// piosenkę (tytuł, styl, pełny tekst) → od razu startuje generacja na Replicate.
//
// Co dodaje v3 ponad klasyczne podejście Suno:
//  1. SILNIK EMOCJI — wyuczony profil afektywny użytkownika (tabela
//     face_detections na LIVE: walencja/pobudzenie/emocje z detekcji twarzy)
//     warunkuje parametry muzyczne wg badań psychologii muzyki
//     (Russell 1980 — model kołowy afektu; Gabrielsson & Lindström 2010 —
//     cechy ekspresji; Juslin 2019 — mechanizmy BRECVEMA).
//  2. JAKOŚĆ JĘZYKA — reguły natywnej prozodii i rymu dla PL/EN/NL/UA
//     + drugi przebieg redakcyjny (krytyk poprawia tekst przed generacją).
//  3. UCZENIE — każda generacja loguje profil emocji + plan do engine_learning
//     (hub), z którego silnik strojony jest w czasie.
//
// Auth: JWT użytkownika LIVE (bvstv). AI: hub_config.openrouter_api_key.
// Replicate: hub_config.replicate_api_token. Kontrakt bez zmian:
// {success, plan, engine, generation_id, task_id}.
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

// ─── SILNIK EMOCJI ─────────────────────────────────────────────────────────────
// Walencja steruje trybem/harmonią, pobudzenie tempem/dynamiką — kierunki
// potwierdzone w literaturze (Gabrielsson & Lindström 2010, tab. 14.1).

interface Aura {
  valence: number | null;   // -1..1
  arousal: number | null;   // 0..1
  engagement?: number | null;
  emotion?: string | null;  // dominanta z detekcji
  samples?: number;         // ile odczytów uczących złożyło się na profil
}

const EMOTION_MUSIC: Record<string, { mode: string; bpm: [number, number]; tags: string; vocal: string }> = {
  happy:     { mode: "major key", bpm: [112, 128], tags: "bright uplifting harmony, bouncy groove, staccato accents, warm plucks, consonant chords", vocal: "warm smiling vocal tone, energetic phrasing" },
  sad:       { mode: "minor key", bpm: [62, 84],   tags: "melancholic, sparse arrangement, soft felt piano, legato strings, gentle dynamics, low register", vocal: "intimate fragile vocals, slight breathiness, falling phrase endings" },
  angry:     { mode: "minor key with phrygian color", bpm: [140, 165], tags: "aggressive, distorted guitars or hard 808s, sharp attacks, dissonant stabs, relentless percussion", vocal: "forceful gritty delivery, clipped consonants" },
  fearful:   { mode: "minor key", bpm: [92, 112],  tags: "tense, tremolo strings, dissonant clusters, irregular accents, dark low drones", vocal: "hushed unstable vocals, wide vibrato" },
  disgusted: { mode: "dark minor key", bpm: [88, 104], tags: "gritty detuned synths, industrial textures, heavy low end", vocal: "cold detached delivery" },
  surprised: { mode: "major key with sudden modulations", bpm: [124, 138], tags: "euphoric, big builds and drops, bright arps, playful syncopation", vocal: "expressive dynamic vocals, wide range" },
  neutral:   { mode: "modal harmony with lydian color", bpm: [92, 108], tags: "dreamy, lush pads, smooth groove, balanced dynamics", vocal: "smooth relaxed vocals" },
  calm:      { mode: "major key", bpm: [64, 84],   tags: "peaceful, warm pads, slow attack textures, gentle percussion, wide reverb", vocal: "soft airy vocals, long sustained notes" },
  romantic:  { mode: "major key with added 7ths and 9ths", bpm: [70, 92], tags: "intimate, warm rhodes, silky strings, slow groove, close-mic feel", vocal: "tender breathy vocals, close and intimate" },
  energetic: { mode: "major key", bpm: [126, 140], tags: "high-energy four-on-the-floor, punchy kick, risers, sidechain pumping", vocal: "powerful confident vocals" },
  focused:   { mode: "minimal harmonic movement", bpm: [100, 116], tags: "steady hypnotic pulse, minimal arrangement, evolving subtle motifs", vocal: "calm even delivery" },
};

function emotionDirectives(aura: Aura): { tags: string; note: string } {
  const v = typeof aura.valence === "number" ? aura.valence : 0.2;
  const a = typeof aura.arousal === "number" ? aura.arousal : 0.5;
  const key = String(aura.emotion || "").toLowerCase();
  let base = EMOTION_MUSIC[key];
  if (!base) {
    // Ćwiartki modelu kołowego, gdy nie znamy nazwanej emocji.
    base = v >= 0
      ? (a >= 0.55 ? EMOTION_MUSIC.happy : EMOTION_MUSIC.calm)
      : (a >= 0.55 ? EMOTION_MUSIC.angry : EMOTION_MUSIC.sad);
  }
  // Pobudzenie dostraja tempo wewnątrz zakresu typowego dla emocji.
  const clampA = Math.min(Math.max(a, 0), 1);
  const bpm = Math.round(base.bpm[0] + (base.bpm[1] - base.bpm[0]) * clampA);
  const tags = `${base.mode}, ${bpm} bpm, ${base.tags}, ${base.vocal}`;
  const note = `walencja=${v.toFixed(2)}, pobudzenie=${a.toFixed(2)}` +
    (aura.emotion ? `, emocja=${aura.emotion}` : "") +
    (aura.samples ? `, odczytów uczących=${aura.samples}` : "");
  return { tags, note };
}

// Wyuczony profil użytkownika: ważona średnia ostatnich detekcji twarzy
// (świeższe ważą więcej), czytana przez RLS jako ten użytkownik.
async function fetchAuraProfile(live: ReturnType<typeof createClient>): Promise<Aura | null> {
  try {
    const { data } = await live
      .from("face_detections")
      .select("dominant_emotion, valence, arousal, engagement")
      .order("created_at", { ascending: false })
      .limit(40);
    if (!data || data.length === 0) return null;
    let v = 0, vW = 0, a = 0, aW = 0, e = 0, eW = 0;
    const hist: Record<string, number> = {};
    data.forEach((row: any, i: number) => {
      const w = 1 / (1 + i * 0.12);
      if (row.dominant_emotion) hist[row.dominant_emotion] = (hist[row.dominant_emotion] || 0) + w;
      if (typeof row.valence === "number") { v += row.valence * w; vW += w; }
      if (typeof row.arousal === "number") { a += row.arousal * w; aW += w; }
      if (typeof row.engagement === "number") { e += row.engagement * w; eW += w; }
    });
    const top = Object.entries(hist).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
    return {
      valence: vW ? v / vW : null,
      arousal: aW ? a / aW : null,
      engagement: eW ? e / eW : null,
      emotion: top,
      samples: data.length,
    };
  } catch {
    return null;
  }
}

// Zapis do zbioru uczącego silnika (hub, tylko service-role) — nie blokuje odpowiedzi.
function logLearning(row: Record<string, unknown>) {
  const p = hubAdmin().from("engine_learning").insert(row).then(
    ({ error }) => { if (error) console.warn("[engine_learning]", error.message); },
  );
  // @ts-ignore — EdgeRuntime.waitUntil jest dostępne w Supabase Edge Runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(p);
}

// ─── LLM ───────────────────────────────────────────────────────────────────────

async function callModel(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 45000,
  maxTokens = 3000,
): Promise<string> {
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
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
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

const LANG_NAMES: Record<string, string> = { pl: "Polish", en: "English", nl: "Dutch", uk: "Ukrainian", ua: "Ukrainian" };

const PLANNER_PROMPT = `Jesteś nagradzanym producentem muzycznym i tekściarzem GrouAI Studio — poziom wyżej niż Suno. Użytkownik opisze utwór jednym lub kilkoma zdaniami. Ułóż KOMPLETNY, PROFESJONALNY plan piosenki brzmiącej jak nagranie ze studia klasy światowej.

Odpowiedz WYŁĄCZNIE poprawnym JSON (bez komentarzy) o polach:
{
  "title": "chwytliwy, oryginalny tytuł",
  "tags": "BOGATE angielskie tagi produkcyjne oddzielone przecinkami — MUSZĄ zawierać: (1) gatunek + podgatunek, (2) nastrój, (3) dokładne tempo BPM, (4) konkretne instrumenty, (5) typ i barwę wokalu (np. 'warm female vocals, emotive'), (6) tagi produkcji/jakości: 'studio quality, professional mix, mastered, wide stereo, punchy drums, clear vocals, radio-ready, hi-fi'",
  "instrumental": false,
  "lyrics": "PEŁNY tekst — WYKORZYSTAJ prawie cały limit 560-590 znaków (dłuższy tekst = dłuższy utwór!): [verse] (4 linie) + [chorus] (4 linie) + [verse 2] (4 linie) + [chorus] (powtórz refren) w języku użytkownika. MAX 590 znaków; jeśli instrumental=true wpisz '[instrumental]'",
  "duration_seconds": 210,
  "language": "pl|en|nl|uk",
  "human_summary": "jedno zdanie po polsku co tworzysz"
}

JAKOŚĆ JĘZYKA (poziom native, bezwzględny wymóg):
- POLSKI: żywa, współczesna polszczyzna — ZERO kalk z angielskiego i pustych fraz („czuję to w sercu", „lecimy w noc"). Akcent paroksytoniczny: akcentowana sylaba pada na mocną miarę taktu. Rymy dokładne, najlepiej żeńskie; UNIKAJ rymów gramatycznych (-ować/-ować, -ała/-ała). Konkret i obraz zamiast abstrakcji.
- ENGLISH: idiomatic, contemporary, natural stress on strong beats, no awkward inversions, concrete imagery.
- NEDERLANDS: natuurlijk hedendaags Nederlands, geen anglicismen, klemtoon op sterke tellen, concrete beelden.
- УКРАЇНСЬКА: жива сучасна мова, природні наголоси в такт, точні рими, конкретні образи (не суржик).
- ŚPIEWALNOŚĆ: otwarte samogłoski (a, o) na długich nutach refrenu; frazy krótkie, oddechowe; hook refrenu = max 6 słów, powtarzalny.
- EMOCJE: pokazuj obrazem i detalem („show, don't tell") — słuchacz ma POCZUĆ, nie przeczytać o uczuciu.

ZASADY PRODUKCJI (jak Suno i lepiej):
- tags bogate i konkretne — im więcej trafnych deskryptorów produkcji, tym lepszy dźwięk. ZAWSZE dodaj tagi jakości ('studio quality, professional mix, mastered, hi-fi') oraz tag natywnego wokalu w języku tekstu, np. 'native Polish vocals, clear pronunciation'.
- Refren = hook: chwytliwy, powtarzalny. Zwrotki z narracją, która rośnie.
- PEŁNA struktura utworu z [intro] i [outro].
- lyrics DŁUGIE: wykorzystaj 560-590 znaków (twardy limit 590 — dłużej = ODRZUCONE).
- duration_seconds: 180-240 (domyślnie 210; krócej tylko gdy user prosi „krótki").
- Jeśli user podał własny tekst — użyj go, dodaj tylko znaczniki struktury.
- Jeśli user prosi instrumental — instrumental=true.
- Tekst w języku użytkownika; tags ZAWSZE po angielsku (wymóg silnika).
- Jeśli dostaniesz PROFIL EMOCJONALNY słuchacza — muzyka i tekst mają AUTENTYCZNIE oddawać ten stan: wpleć podane parametry (tryb, tempo, instrumentarium, barwę wokalu) do tags, a emocję do treści tekstu.

BARDZO WAŻNE: Odpowiedz WYŁĄCZNIE surowym obiektem JSON. Zacznij od { i zakończ na }. Bez wyjaśnień, rozumowania, markdown ani <think>.`;

const REFINE_PROMPT = `Jesteś bezlitosnym redaktorem tekstów piosenek — native speaker języka, który dostaniesz. Otrzymasz JSON {"language": "...", "lyrics": "..."}.
Popraw tekst pod kątem: (1) naturalności — usuń kalki językowe i puste frazesy, (2) prozodii — akcenty wyrazowe na mocne miary, (3) rymów — dokładne zamiast częstochowskich/gramatycznych, (4) śpiewalności — otwarte samogłoski na długich nutach refrenu, krótkie frazy, (5) obrazowości — konkret zamiast abstrakcji.
ZACHOWAJ: język, sens, strukturę ze znacznikami [verse]/[chorus]/[intro]/[outro], limit 590 znaków. Jeśli tekst jest już świetny — zwróć go bez zmian.
Odpowiedz WYŁĄCZNIE JSON: {"lyrics":"..."}.`;

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
    // ===== 0. Profil emocjonalny: przekazany wprost (świeża detekcja aury)
    //          albo wyuczony z historii face_detections tego użytkownika. =====
    let aura: Aura | null = null;
    if (body.aura && typeof body.aura === "object") {
      aura = {
        valence: typeof body.aura.valence === "number" ? body.aura.valence : null,
        arousal: typeof body.aura.arousal === "number" ? body.aura.arousal : null,
        engagement: typeof body.aura.engagement === "number" ? body.aura.engagement : null,
        emotion: body.aura.emotion ? String(body.aura.emotion) : null,
      };
    }
    const learned = await fetchAuraProfile(live);
    if (!aura && learned) aura = learned;
    else if (aura && learned) {
      // Świeża detekcja ma priorytet; historia uzupełnia braki.
      aura.valence ??= learned.valence;
      aura.arousal ??= learned.arousal;
      aura.emotion ??= learned.emotion;
      aura.samples = learned.samples;
    }
    const emo = aura ? emotionDirectives(aura) : null;
    const auraMsg = emo
      ? `\n\nPROFIL EMOCJONALNY SŁUCHACZA (wyuczony z detekcji twarzy; ${emo.note}):\nParametry muzyczne do wplecenia w tags: ${emo.tags}\nTekst ma autentycznie oddawać ten stan emocjonalny.`
      : "";

    // ===== 1. AI układa plan piosenki =====
    const planned = await planWithModels(models, orKey, [
      { role: "system", content: PLANNER_PROMPT },
      { role: "user", content: prompt + langHint + auraMsg },
    ]);
    if (!planned) {
      return json({ success: false, error: "Nie udało się ułożyć planu utworu — spróbuj ponownie za chwilę." }, 200);
    }
    const plan = planned.plan;
    const result = { model: planned.model };

    const instrumental = !!plan.instrumental;
    let lyrics = instrumental ? "[instrumental]" : String(plan.lyrics || "[instrumental]");
    const duration = Math.min(Math.max(Number(plan.duration_seconds) || 210, 30), 240);
    const title = String(plan.title || "GrouAI Track").slice(0, 120);
    const language = String(plan.language || body.language || "pl").toLowerCase();
    let tags = String(plan.tags);

    // Tag natywnego wokalu — pilnuje poprawnej wymowy w danym języku.
    const langName = LANG_NAMES[language];
    if (!instrumental && langName && !tags.toLowerCase().includes(langName.toLowerCase())) {
      tags += `, native ${langName} vocals, clear pronunciation`;
    }
    // Warunkowanie emocjonalne trafia też wprost do silnika audio.
    if (emo) tags += `, ${emo.tags}`;

    // ===== 1b. Drugi przebieg: redaktor-krytyk poprawia tekst (opcjonalny,
    //           cicha rezygnacja przy braku czasu/modelu). hub_config.engine_refine=off wyłącza. =====
    if (!instrumental && cfg["engine_refine"] !== "off" && lyrics.length > 40) {
      try {
        const refined = await callModel(models[0], orKey, [
          { role: "system", content: REFINE_PROMPT },
          { role: "user", content: JSON.stringify({ language, lyrics }) },
        ], 22000, 1200);
        const rj = extractJson(refined);
        const newLyrics = rj && typeof rj.lyrics === "string" ? rj.lyrics.trim() : "";
        if (newLyrics.length > 40 && newLyrics.length <= 640) lyrics = newLyrics;
      } catch { /* zostaje wersja z pierwszego przebiegu */ }
    }

    // ===== 2. Start generacji (routing silników) =====
    // wokal → MiniMax (jakość/tempo klasy Suno); instrumental → ACE-Step
    const rHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${repToken}` };
    let rel: Response;
    let engineName: string;
    if (!instrumental) {
      engineName = "minimax";
      const vocalModel = cfg["vocal_model"] || "minimax/music-1.5";
      // Bogaty opis + tagi jakości studyjnej dają dźwięk najbliższy Suno.
      const mmPrompt = (tags + ", studio quality, professional mix, mastered, clear vocals, hi-fi").slice(0, 300);
      // MiniMax przyjmuje tekst 10-600 znaków i sam rozwija go w pełny utwór.
      let mmLyrics = lyrics
        .replace(/\[(intro|outro)\][^\[]*/gi, "")
        .trim();
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

    // Okładka AI startuje automatycznie po stronie serwera — każdy utwór ją dostaje.
    const coverReq = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/studio-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ id: predId, title, style: tags }),
    }).catch(() => null);
    // @ts-ignore — EdgeRuntime.waitUntil jest dostępne w Supabase Edge Runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(coverReq);

    // ===== 3. Rekord w Studio (LIVE) + log uczący (hub) =====
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

    logLearning({
      user_id: userId,
      source: body.source === "aura" ? "aura" : "studio",
      prompt: prompt.slice(0, 2000),
      language,
      aura: aura ?? null,
      plan: { title, tags: tags.slice(0, 1500), lyrics: lyrics.slice(0, 1500), instrumental, duration },
      engine: engineName,
      task_id: predId,
    });

    return json({
      success: true,
      engine: engineName,
      task_id: predId,
      generation_id: gen?.id ?? null,
      plan: {
        title,
        tags,
        lyrics,
        instrumental,
        duration_seconds: duration,
        language,
        human_summary: String(plan.human_summary || `Tworzę: ${title}`),
        genre: tags.split(",")[0]?.trim(),
        mood: tags.split(",")[1]?.trim(),
        ...(emo ? { emotion_profile: emo.note } : {}),
      },
      model: result.model,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[studio-prompt-engine]", msg);
    return json({ success: false, error: msg }, 200);
  }
});
