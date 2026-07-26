// GROUAI HUB — studio-prompt-engine v5 „GrouAI Engine"
// v5: SILNIK EMOCJI v5 — emocja słyszalna w wykonaniu. Profile akustyczne
// (Juslin & Laukka 2003), cel przeżyciowy GEMS-9 (Zentner), wyzwalacze ciarek
// (Sloboda 1991), reguły wykonawcze KTH (Friberg/Sundberg), mieszanka dwóch
// emocji z histogramu detekcji (głębia zamiast plakatu).
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
//  4. (v4) PROZODIA SYLABICZNA — równe sylaby w parach linii = wokal frazuje
//     naturalnie; OCENA JAKOŚCI tekstu (krytyk daje score, słaby tekst dostaje
//     drugą poprawkę); MiniMax music-2.6 dla wokalu I instrumentali (oddech,
//     vibrato, do 6 min); inteligentne pakowanie tagów w budżet 300 znaków.
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

// ─── SILNIK EMOCJI v5 ──────────────────────────────────────────────────────────
// Emocja ma być SŁYSZALNA w wykonaniu, nie tylko opisana. Zszyte z badań:
//  • Juslin & Laukka 2003 (meta-analiza 145 badań): profile akustyczne emocji —
//    tempo, artykulacja (staccato/legato), atak dźwięku, dynamika, barwa,
//    vibrato, kontur melodyczny (te same kody co w głosie mówionym).
//  • Gabrielsson & Lindström 2010: walencja→tryb/harmonia, pobudzenie→tempo.
//  • Zentner (GEMS-9): docelowe PRZEŻYCIE słuchacza (czułość, nostalgia, moc,
//    cud, spokój...) — tekst i aranż celują w indukcję odczucia, nie sam opis.
//  • Sloboda 1991 + badania frisson: wyzwalacze ciarek — appoggiatury,
//    nagła cisza/wybuch dynamiki, niespodziewany akord, wejście nowego głosu,
//    zejście kwintowe do toniki, podniesienie tonacji w finale.
//  • KTH rule system (Friberg/Sundberg): frazowanie łukowe, mikro-timing,
//    rubato, końcowe ritardando.

interface Aura {
  valence: number | null;   // -1..1
  arousal: number | null;   // 0..1
  engagement?: number | null;
  emotion?: string | null;  // dominanta z detekcji
  emotion2?: string | null; // drugi kolor emocjonalny (mieszanka = głębia)
  samples?: number;         // ile odczytów uczących złożyło się na profil
}

interface EmotionSpec {
  mode: string;
  bpm: [number, number];
  tags: string;
  vocal: string;
  perf: string;    // wykonanie (Juslin&Laukka + KTH): artykulacja/atak/dynamika/timing
  frisson: string; // wyzwalacze ciarek (Sloboda) dopasowane do emocji
  gems: string;    // docelowe przeżycie słuchacza (GEMS-9)
}

const EMOTION_MUSIC: Record<string, EmotionSpec> = {
  happy: {
    mode: "major key", bpm: [112, 128],
    tags: "bright uplifting harmony, bouncy groove, staccato accents, warm plucks, consonant chords",
    vocal: "warm smiling vocal tone, energetic phrasing",
    perf: "staccato articulation, fast light tone attacks, bright timbre, steady tempo with playful micro-timing, rising melodic contours, crisp consonants",
    frisson: "sudden stop-and-drop into the final chorus, joyful key change up in last chorus, unexpected gang vocals entering",
    gems: "joyful activation — listener should feel like dancing and smiling involuntarily",
  },
  sad: {
    mode: "minor key", bpm: [62, 84],
    tags: "melancholic, sparse arrangement, soft felt piano, legato strings, gentle dynamics, low register",
    vocal: "intimate fragile vocals, slight breathiness, falling phrase endings, audible breaths between phrases",
    perf: "legato articulation, slow soft tone attacks, dull warm timbre, slow expressive vibrato, falling melodic contours, generous rubato, large final ritardando",
    frisson: "melodic appoggiaturas in the chorus melody, strings entering only at the second chorus, near-silence before the last chorus with a single fragile voice",
    gems: "nostalgia and tenderness — a lump in the throat, bittersweet longing",
  },
  angry: {
    mode: "minor key with phrygian color", bpm: [140, 165],
    tags: "aggressive, distorted guitars or hard 808s, sharp attacks, dissonant stabs, relentless percussion",
    vocal: "forceful gritty delivery, clipped consonants, shouted ad-libs",
    perf: "sharp staccato attacks, high sound level with abrupt accents on unstable notes, spectral distortion and noise in timbre, no rubato — machine-tight timing",
    frisson: "sudden half-time breakdown with everything cut except drums and voice, then full-force wall of sound returning",
    gems: "power — clenched fists, adrenaline, feeling unstoppable",
  },
  fearful: {
    mode: "minor key", bpm: [92, 112],
    tags: "tense, tremolo strings, dissonant clusters, irregular accents, dark low drones",
    vocal: "hushed unstable vocals, wide irregular vibrato, whispered doubles",
    perf: "muted timbre, very soft dynamics with sudden swells, large timing variability, hesitant pauses between phrases, trembling ornaments",
    frisson: "unexpected dissonant chord under a held vocal note, silence that lasts one beat too long, a distant second voice appearing from nowhere",
    gems: "tension — held breath, goosebumps of unease resolving into release",
  },
  disgusted: {
    mode: "dark minor key", bpm: [88, 104],
    tags: "gritty detuned synths, industrial textures, heavy low end",
    vocal: "cold detached delivery, sneering tone",
    perf: "detuned smeared timbre, dragging behind-the-beat timing, grinding sustained notes",
    frisson: "pitch bend collapsing a chord into noise, then snapping back to clean harmony",
    gems: "tension with dark fascination",
  },
  surprised: {
    mode: "major key with sudden modulations", bpm: [124, 138],
    tags: "euphoric, big builds and drops, bright arps, playful syncopation",
    vocal: "expressive dynamic vocals, wide range, sudden octave jumps",
    perf: "abrupt dynamic contrasts, unexpected rests, fast bright attacks, syncopated accents landing off the grid",
    frisson: "harmony that resolves somewhere unexpected, a drop that comes one bar early, new instrument entering each section",
    gems: "wonder — eyes widening, delighted disbelief",
  },
  neutral: {
    mode: "modal harmony with lydian color", bpm: [92, 108],
    tags: "dreamy, lush pads, smooth groove, balanced dynamics",
    vocal: "smooth relaxed vocals",
    perf: "even legato flow, medium soft attacks, arch-shaped phrasing (KTH phrase arch), gentle swell into each chorus",
    frisson: "slow harmonic bloom — one added chord tone at a time until the texture shimmers",
    gems: "peaceful wonder — floating, weightless attention",
  },
  calm: {
    mode: "major key", bpm: [64, 84],
    tags: "peaceful, warm pads, slow attack textures, gentle percussion, wide reverb",
    vocal: "soft airy vocals, long sustained notes",
    perf: "very legato, slow soft attacks, warm dark timbre, minimal dynamics, slow breathing tempo with gentle final ritardando",
    frisson: "a single distant high harmony note entering on the last chorus like light through clouds",
    gems: "peacefulness — slow exhale, shoulders dropping",
  },
  romantic: {
    mode: "major key with added 7ths and 9ths", bpm: [70, 92],
    tags: "intimate, warm rhodes, silky strings, slow groove, close-mic feel",
    vocal: "tender breathy vocals, close and intimate, almost whispered verses",
    perf: "legato with soft attacks, warm intimate timbre, gentle rubato leaning into downbeats, delicate slow vibrato on long notes",
    frisson: "appoggiatura on the most important word of the chorus, strings swelling under the final repeat, voice cracking slightly with emotion",
    gems: "tenderness — warmth in the chest, wanting to hold someone",
  },
  energetic: {
    mode: "major key", bpm: [126, 140],
    tags: "high-energy four-on-the-floor, punchy kick, risers, sidechain pumping",
    vocal: "powerful confident vocals",
    perf: "tight quantized groove, punchy fast attacks, bright forward timbre, dynamics pumping with the kick, shouted hook doubles",
    frisson: "filter sweep into sudden full-spectrum drop, crowd-style gang vocals on the last hook",
    gems: "joyful activation and power — chest-out euphoria",
  },
  focused: {
    mode: "minimal harmonic movement", bpm: [100, 116],
    tags: "steady hypnotic pulse, minimal arrangement, evolving subtle motifs",
    vocal: "calm even delivery",
    perf: "metronomic timing, soft even attacks, dry close timbre, dynamics flat by design with one slow build across the whole track",
    frisson: "a motif that has been repeating suddenly harmonized in thirds near the end",
    gems: "transcendence through repetition — flow state",
  },
};

function emotionDirectives(aura: Aura): { tags: string; perf: string; note: string; brief: string } {
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
  // Drugi kolor emocjonalny (z histogramu detekcji) = głębia zamiast plakatu.
  const key2 = String(aura.emotion2 || "").toLowerCase();
  const second = key2 && key2 !== key ? EMOTION_MUSIC[key2] : null;

  // Pobudzenie dostraja tempo wewnątrz zakresu typowego dla emocji.
  const clampA = Math.min(Math.max(a, 0), 1);
  const bpm = Math.round(base.bpm[0] + (base.bpm[1] - base.bpm[0]) * clampA);

  // Tagi brzmieniowe: emocja główna w pełni + drugi kolor jako przyprawa.
  const tags = `${base.mode}, ${bpm} bpm, ${base.tags}, ${base.vocal}` +
    (second ? `, with subtle undertones of ${key2}: ${second.vocal}` : "");
  // Wykonanie (to, co SŁYCHAĆ): artykulacja/atak/dynamika/timing + ciarki.
  const perf = `${base.perf}, ${base.frisson}`;

  const note = `walencja=${v.toFixed(2)}, pobudzenie=${a.toFixed(2)}` +
    (aura.emotion ? `, emocja=${aura.emotion}` : "") +
    (second ? `+${key2}` : "") +
    (aura.samples ? `, odczytów uczących=${aura.samples}` : "");

  // Brief dla tekściarza: docelowe PRZEŻYCIE (GEMS) + dramaturgia + ciarki.
  const brief =
    `CEL EMOCJONALNY (słuchacz ma to POCZUĆ w ciele): ${base.gems}.` +
    (second ? ` Drugi plan emocjonalny: ${second.gems}.` : "") +
    `\nWYKONANIE (ma być słyszalne): ${base.perf}.` +
    `\nMOMENT CIAREK (wpisz go w strukturę tekstu i aranżu): ${base.frisson}.` +
    `\nDRAMATURGIA: pierwsza zwrotka intymna i oszczędna → refren otwiera się szerzej → druga zwrotka dokłada detal opowieści → przed ostatnim refrenem zawieszenie/cisza → finał największy emocjonalnie (KTH: frazowanie łukowe, końcowe ritardando gdy emocja tego chce).`;

  return { tags, perf, note, brief };
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
    const ranked = Object.entries(hist).sort((x, y) => y[1] - x[1]);
    const top = ranked[0]?.[0] || null;
    // Drugi kolor tylko, gdy realnie obecny (≥25% wagi dominanty) — inaczej szum.
    const top2 = ranked[1] && ranked[1][1] >= (ranked[0]?.[1] || 0) * 0.25 ? ranked[1][0] : null;
    return {
      valence: vW ? v / vW : null,
      arousal: aW ? a / aW : null,
      engagement: eW ? e / eW : null,
      emotion: top,
      emotion2: top2,
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
- PROZODIA SYLABICZNA (kluczowe dla naturalnego śpiewu): linie w PARACH mają RÓWNĄ liczbę sylab (±1) — zwrotka 8-11 sylab/linia, refren 6-9 sylab/linia. Model muzyczny frazuje wtedy jak człowiek, bez połykania i rozciągania słów.
- EMOCJE: pokazuj obrazem i detalem („show, don't tell") — słuchacz ma POCZUĆ, nie przeczytać o uczuciu.

ZASADY PRODUKCJI (jak Suno i lepiej):
- tags bogate i konkretne — im więcej trafnych deskryptorów produkcji, tym lepszy dźwięk. ZAWSZE dodaj tagi jakości ('studio quality, professional mix, mastered, hi-fi') oraz tag natywnego wokalu w języku tekstu, np. 'native Polish vocals, clear pronunciation'.
- Refren = hook: chwytliwy, powtarzalny. Zwrotki z narracją, która rośnie.
- MOMENT CIAREK (frisson, Sloboda 1991) — KAŻDY utwór ma mieć zaplanowany co najmniej jeden: appoggiatura na najważniejszym słowie refrenu, nagła cisza przed ostatnim refrenem, niespodziewany akord, wejście nowego głosu/harmonii wokalnych w finale albo podniesienie tonacji. Wpisz go w tags (po angielsku) i w strukturę tekstu.
- DRAMATURGIA EMOCJI: zwrotka 1 intymna/oszczędna → refren szerszy → zwrotka 2 dokłada detal → zawieszenie przed ostatnim refrenem → finał największy. Emocja ma być SŁYSZALNA w wykonaniu (artykulacja, atak, dynamika, oddechy), nie tylko opisana słowami.
- PEŁNA struktura utworu z [intro] i [outro].
- lyrics DŁUGIE: wykorzystaj 560-590 znaków (twardy limit 590 — dłużej = ODRZUCONE).
- duration_seconds: 180-300 (domyślnie 240 = pełny utwór; krócej tylko gdy user prosi „krótki").
- Jeśli user podał własny tekst — użyj go, dodaj tylko znaczniki struktury.
- Jeśli user prosi instrumental — instrumental=true.
- Tekst w języku użytkownika; tags ZAWSZE po angielsku (wymóg silnika).
- Jeśli dostaniesz PROFIL EMOCJONALNY słuchacza — muzyka i tekst mają AUTENTYCZNIE oddawać ten stan: wpleć podane parametry (tryb, tempo, instrumentarium, barwę wokalu) do tags, a emocję do treści tekstu.

BARDZO WAŻNE: Odpowiedz WYŁĄCZNIE surowym obiektem JSON. Zacznij od { i zakończ na }. Bez wyjaśnień, rozumowania, markdown ani <think>.`;

const REFINE_PROMPT = `Jesteś bezlitosnym redaktorem tekstów piosenek — native speaker języka, który dostaniesz. Otrzymasz JSON {"language": "...", "lyrics": "..."}.
Popraw tekst pod kątem: (1) naturalności — usuń kalki językowe i puste frazesy, (2) prozodii — akcenty wyrazowe na mocne miary, RÓWNE sylaby w parach linii (±1), (3) rymów — dokładne zamiast częstochowskich/gramatycznych, (4) śpiewalności — otwarte samogłoski na długich nutach refrenu, krótkie frazy, (5) obrazowości — konkret zamiast abstrakcji.
ZACHOWAJ: język, sens, strukturę ze znacznikami [verse]/[chorus]/[intro]/[outro], limit 590 znaków. Jeśli tekst jest już świetny — zwróć go bez zmian.
Na końcu oceń POPRAWIONY tekst w skali 1-10 (10 = poziom zawodowego tekściarza: prozodia, rymy, obraz, hook).
Odpowiedz WYŁĄCZNIE JSON: {"lyrics":"...","score":8}.`;

// ─── Pakowanie tagów w budżet 300 znaków MiniMax ──────────────────────────────
// Najpierw to, co najbardziej steruje brzmieniem (gatunek/BPM/wokal/emocje),
// quality-suffix na końcu; deduplikacja, twarde cięcie na granicy tagu.
function packTags(parts: string[], budget = 300): string {
  const seen = new Set<string>();
  const out: string[] = [];
  let len = 0;
  for (const part of parts) {
    for (const raw of part.split(",")) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      const add = (out.length ? 2 : 0) + tag.length;
      if (len + add > budget) continue;
      seen.add(key);
      out.push(tag);
      len += add;
    }
  }
  return out.join(", ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cfg = await loadConfig();
  const orKey = cfg["openrouter_api_key"];
  const repToken = cfg["replicate_api_token"];
  if (!orKey) return json({ success: false, error: "ai_not_configured" }, 200);
  if (!repToken) return json({ success: false, error: "replicate_not_configured" }, 200);

  // Mózg tekstów: GPT (OpenRouter) jako pierwszy wybór — hub_config.studio_llm_models;
  // każda awaria/koszt spada automatycznie na kolejny model w łańcuchu.
  const models = (cfg["studio_llm_models"] || cfg["openrouter_models"] || "meta-llama/llama-3.3-70b-instruct:free")
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
      aura.emotion2 = learned.emotion2 ?? null;
      aura.samples = learned.samples;
    }
    const emo = aura ? emotionDirectives(aura) : null;
    const auraMsg = emo
      ? `\n\nPROFIL EMOCJONALNY SŁUCHACZA (wyuczony z detekcji twarzy; ${emo.note}):\nParametry muzyczne do wplecenia w tags: ${emo.tags}\n${emo.brief}`
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
    const duration = Math.min(Math.max(Number(plan.duration_seconds) || 240, 60), 360);
    const title = String(plan.title || "GrouAI Track").slice(0, 120);
    const language = String(plan.language || body.language || "pl").toLowerCase();
    let tags = String(plan.tags);

    // Tag natywnego wokalu — pilnuje poprawnej wymowy w danym języku.
    const langName = LANG_NAMES[language];
    if (!instrumental && langName && !tags.toLowerCase().includes(langName.toLowerCase())) {
      tags += `, native ${langName} vocals, clear pronunciation`;
    }
    // Warunkowanie emocjonalne trafia też wprost do silnika audio — razem z
    // tagami WYKONANIA (artykulacja/atak/dynamika/ciarki), żeby emocję było słychać.
    if (emo) tags += `, ${emo.tags}, ${emo.perf}`;

    // ===== 1b. Redaktor-krytyk: poprawia tekst i OCENIA go (1-10). Jeśli po
    //           poprawce score < 8 — jeszcze jedna runda (max 2). Cicha
    //           rezygnacja przy błędzie. hub_config.engine_refine=off wyłącza. =====
    let lyricsScore: number | null = null;
    if (!instrumental && cfg["engine_refine"] !== "off" && lyrics.length > 40) {
      for (let round = 0; round < 2; round++) {
        try {
          const refined = await callModel(models[0], orKey, [
            { role: "system", content: REFINE_PROMPT },
            { role: "user", content: JSON.stringify({ language, lyrics }) },
          ], 22000, 1200);
          const rj = extractJson(refined);
          const newLyrics = rj && typeof rj.lyrics === "string" ? rj.lyrics.trim() : "";
          if (newLyrics.length > 40 && newLyrics.length <= 640) lyrics = newLyrics;
          lyricsScore = typeof rj?.score === "number" ? rj.score : null;
          if (lyricsScore === null || lyricsScore >= 8) break;
        } catch { break; /* zostaje ostatnia dobra wersja */ }
      }
    }

    // ===== 2. Start generacji (routing silników, poziom v6) =====
    // TIER 1: Suno V5/V5_5 przez api.sunoapi.org (hub_config.suno_api_key) —
    //         jakość referencyjna: najlepszy polski wokal, czyste naturalne
    //         instrumenty, separacja, miks klasy studyjnej.
    // TIER 2: MiniMax music-2.6 — automatyczny fallback (brak klucza / awaria).
    // TIER 3: ACE-Step — tylko gdy hub_config.instrumental_engine=acestep.
    const rHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${repToken}` };
    let predId: string | null = null;
    let engineName = "";

    // Wgrany głos użytkownika (referencja wokalu, jak „Upload Audio" w Suno).
    // Gdy podany publiczny URL nagrania → tryb upload-cover: Suno śpiewa naszym
    // tekstem, biorąc barwę/charakter z próbki głosu.
    const voiceUrl = String(body.voice_url || body.voiceUrl || "").trim();
    const voiceGender = ["m", "f"].includes(String(body.voice_gender || "").toLowerCase())
      ? String(body.voice_gender).toLowerCase() : "";

    const sunoKey = (cfg["suno_api_key"] || "").trim();
    if (sunoKey) {
      // Style z mocnymi „kotwicami czystości" — to one najbardziej zbijają
      // muł/blaszaność i pilnują transparentnego, wyprzedzonego wokalu.
      const sunoStyle = packTags([
        tags,
        "crystal clear studio master, pristine high fidelity, professional mix and master, wide stereo image, deep controlled sub-bass, airy top end, transparent vocals up-front, natural room, balanced loudness, radio-ready, zero distortion, zero mud, reference-monitor quality",
      ], 950);
      const useCover = !!voiceUrl && /^https?:\/\//.test(voiceUrl);
      const endpoint = useCover
        ? "https://api.sunoapi.org/api/v1/generate/upload-cover"
        : "https://api.sunoapi.org/api/v1/generate";
      // Kandydaci modeli: skonfigurowany → pewne fallbacki. Jeśli dany identyfikator
      // (np. V5_5) nie jest obsługiwany przez API, NIE spadamy na MiniMax —
      // próbujemy kolejnej wersji Suno. Zawsze gramy najlepszym DOSTĘPNYM Suno.
      const modelCandidates = [...new Set([(cfg["suno_model"] || "V5"), "V5", "V4_5PLUS"].filter(Boolean))];
      let sunoErr = "";
      for (const sunoModel of modelCandidates) {
        try {
          const sunoBody: Record<string, unknown> = {
            customMode: true,
            instrumental,
            model: sunoModel,
            callBackUrl: cfg["suno_callback_url"] ||
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/suno-callback`,
            ...(instrumental ? {} : { prompt: lyrics.slice(0, 4900) }),
            style: sunoStyle.slice(0, 990),
            title: title.slice(0, 95),
            ...(useCover ? {
              uploadUrl: voiceUrl,
              // audioWeight: jak mocno trzymać się barwy z próbki (0-1).
              audioWeight: Math.min(Math.max(Number(cfg["suno_voice_weight"] || "0.65"), 0), 1),
            } : {}),
            ...(voiceGender ? { vocalGender: voiceGender } : {}),
          };
          const sr = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sunoKey}` },
            body: JSON.stringify(sunoBody),
            signal: AbortSignal.timeout(30000),
          });
          const sd = await sr.json().catch(() => null);
          const tid = sd?.data?.taskId;
          if (sr.ok && tid) {
            predId = `suno-${tid}`;
            engineName = useCover ? `suno-cover-${String(sunoModel).toLowerCase()}` : `suno-${String(sunoModel).toLowerCase()}`;
            break;
          }
          sunoErr = `[${sunoModel}] ${JSON.stringify(sd).slice(0, 160)}`;
          console.warn("[suno] start failed:", sunoErr);
        } catch (e) {
          sunoErr = `[${sunoModel}] ${String(e).slice(0, 120)}`;
          console.warn("[suno] unreachable:", sunoErr);
        }
      }
      // Diagnostyka: klucz jest, a Suno nie ruszył → zapisz POWÓD (bez sekretu),
      // by od razu było wiadomo, czy to zły model / brak środków / zły klucz.
      if (!predId && sunoErr) {
        try {
          await hubAdmin().from("hub_log").insert({
            source: "studio-prompt-engine", level: "warn",
            message: `Suno nie ruszył — fallback na MiniMax. Powód: ${sunoErr}`,
          });
        } catch { /* log best-effort */ }
      }
    }

    if (!predId) {
    const instrEngine = (cfg["instrumental_engine"] || "minimax").toLowerCase();
    const useMinimax = !instrumental || instrEngine === "minimax";
    let rel: Response;
    if (useMinimax) {
      engineName = instrumental ? "minimax-inst" : "minimax";
      const vocalModel = cfg["vocal_model"] || "minimax/music-2.6";
      // Tagi pakowane wg priorytetu brzmieniowego; quality-suffix na końcu.
      const mmPrompt = packTags([
        tags,
        "studio quality, professional mix, mastered, clear vocals, radio-ready, rich dynamics, hi-fi",
      ]);
      const input: Record<string, unknown> = {
        prompt: mmPrompt.length >= 10 ? mmPrompt : mmPrompt + ", modern pop, studio quality",
        audio_format: "mp3",
        bitrate: parseInt(cfg["minimax_bitrate"] || "256000", 10) || 256000,
        sample_rate: 44100,
      };
      if (instrumental) {
        input.is_instrumental = true;
      } else {
        // MiniMax przyjmuje tekst 10-600 znaków i sam rozwija go w pełny utwór.
        let mmLyrics = lyrics
          .replace(/\[(intro|outro)\][^\[]*/gi, "")
          .trim();
        if (mmLyrics.length > 595) mmLyrics = mmLyrics.slice(0, 595).replace(/\s+\S*$/, "");
        if (mmLyrics.length < 10) mmLyrics = lyrics.slice(0, 595);
        input.lyrics = mmLyrics;
      }
      rel = await fetch(`${REPLICATE_BASE}/models/${vocalModel}/predictions`, {
        method: "POST",
        headers: rHeaders,
        body: JSON.stringify({ input }),
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
    predId = relData?.id ?? null;
    if (!predId) return json({ success: false, error: "no_prediction_id" }, 200);
    } // koniec fallbacku Tier 2/3

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
      plan: { title, tags: tags.slice(0, 1500), lyrics: lyrics.slice(0, 1500), instrumental, duration, lyrics_score: lyricsScore },
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
