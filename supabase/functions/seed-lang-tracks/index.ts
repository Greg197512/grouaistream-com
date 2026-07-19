// Jednorazowy seeder: generuje 4 tematyczne utwory (PL/EN/NL/UA) o GrouAIStream
// przez Replicate MusicGen, archiwizuje na R2 i wstawia do tabeli tracks.
// Wywołanie: POST z nagłówkiem `x-seed-secret: <SEED_SECRET>`.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { archiveToR2 } from "../_shared/r2.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-secret",
};

const MUSICGEN_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055f2a04b1d735e6ee09b7bd6";
const ARTIST_ID = "72237062-02b7-45e7-8a67-deab4f1c5dbb"; // Grouarock

interface LangTrack {
  lang: "pl" | "en" | "nl" | "ua";
  title: string;
  prompt: string;
  mood: string;
  genre: string;
}

const SEEDS: LangTrack[] = [
  {
    lang: "pl",
    title: "GrouAIStream — Neonowe Serce",
    prompt: "Polish electronic pop anthem, warm neon synths, deep pulsing sub-bass, cinematic uplifting drop, female vocal chops, 120 bpm, GrouAIStream nightlife vibe",
    mood: "euphoric",
    genre: "electronic-pop",
  },
  {
    lang: "en",
    title: "GrouAIStream — Neon Nights",
    prompt: "English future-house anthem, saturated neon leads, punchy 909 kicks, catchy pluck melody, cinematic drop, 124 bpm, GrouAIStream club energy",
    mood: "energetic",
    genre: "future-house",
  },
  {
    lang: "nl",
    title: "GrouAIStream — Amsterdam Pulse",
    prompt: "Dutch tech-house groove, dark rolling bassline, crispy hats, subtle vocal chops in Dutch, hypnotic Amsterdam nightclub vibe, 126 bpm, GrouAIStream signature sound",
    mood: "hypnotic",
    genre: "tech-house",
  },
  {
    lang: "ua",
    title: "GrouAIStream — Kyiv Signal",
    prompt: "Ukrainian melodic techno, emotional pad chords, driving 4-on-the-floor kick, ethereal Slavic female vocal atmosphere, cinematic build and drop, 122 bpm, GrouAIStream anthem",
    mood: "emotional",
    genre: "melodic-techno",
  },
];

async function generateOne(token: string, s: LangTrack): Promise<string | null> {
  const create = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait" },
    body: JSON.stringify({
      version: MUSICGEN_VERSION,
      input: {
        model_version: "stereo-large",
        prompt: s.prompt,
        duration: 30,
        output_format: "mp3",
        normalization_strategy: "peak",
        temperature: 1.0,
        top_k: 250,
        top_p: 0.0,
      },
    }),
  });
  let pred = await create.json();
  // Poll if not finished
  for (let i = 0; i < 60 && (pred.status === "starting" || pred.status === "processing"); i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    pred = await r.json();
  }
  if (pred.status !== "succeeded" || !pred.output) {
    console.error(`[seed:${s.lang}] failed`, pred.status, pred.error);
    return null;
  }
  const sourceUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const archived = await archiveToR2({
    sourceUrl,
    folder: "lang-seed",
    id: `${s.lang}-${pred.id}`,
    ext: "mp3",
    contentType: "audio/mpeg",
  });
  return archived || sourceUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const secret = req.headers.get("x-seed-secret");
  if (!secret || secret !== Deno.env.get("SEED_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const token = Deno.env.get("REPLICATE_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "missing_replicate_token" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];
  // Sequential to be gentle on Replicate quota
  for (const s of SEEDS) {
    // Skip if already seeded
    const { data: existing } = await supabase
      .from("tracks").select("id").eq("title", s.title).limit(1);
    if (existing && existing.length > 0) {
      results.push({ lang: s.lang, title: s.title, skipped: true });
      continue;
    }
    const audio = await generateOne(token, s);
    if (!audio) { results.push({ lang: s.lang, error: "gen_failed" }); continue; }
    const { data: ins, error } = await supabase.from("tracks").insert({
      user_id: ARTIST_ID,
      title: s.title,
      artist: "GrouaRock ®",
      album: "GrouAIStream Language Series",
      duration: 30,
      audio_url: audio,
      genre: s.genre,
      mood: s.mood,
      is_public: true,
    }).select("id").single();
    if (error) results.push({ lang: s.lang, error: error.message });
    else results.push({ lang: s.lang, title: s.title, id: ins.id, audio_url: audio });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
