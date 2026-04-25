// 🎧 A&R Scout — agent szukający świeżej muzyki dopasowanej do gustu platformy.
// Cron raz dziennie. Liczy "smak platformy" z ostatnich 7 dni streamów,
// skanuje CCMixter pod kątem nowych utworów w dominujących gatunkach,
// scoruje znaleziska i zapisuje top 5 jako decyzje agenta do akceptacji
// przez admina w /admin/brain.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGENT_NAME = "a-r-scout";
const CC_GENRES = ["rock", "punk", "pop", "electronic", "chill", "ambient"];
const ACCEPTABLE_LICENSES = ["by", "by-sa", "by-nc", "by-nc-sa"];

interface CCTrack {
  upload_id: number;
  upload_name: string;
  user_name: string;
  user_real_name?: string;
  license_url?: string;
  license_name?: string;
  file_page_url?: string;
  download_url?: string;
  upload_tags?: string;
  upload_description?: string;
  files?: Array<{ file_name?: string; download_url?: string }>;
}

interface Candidate {
  source: "ccmixter";
  external_id: string;
  title: string;
  artist: string;
  genre: string;
  audio_url: string | null;
  page_url: string;
  license: string;
  tags: string;
  score: number;
  reasons: string[];
}

interface PlatformTaste {
  topGenres: Array<{ genre: string; weight: number }>;
  bpmCenter: number | null;
  bpmStdDev: number | null;
  topMoods: string[];
  totalStreams7d: number;
}

async function computePlatformTaste(supabase: any): Promise<PlatformTaste> {
  // top gatunki z ostatnich 7 dni słuchania
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { data: history } = await supabase
    .from("listening_history")
    .select("track_id, mood_detected, played_at")
    .gte("played_at", sevenDaysAgo)
    .limit(5000);

  const trackIds = Array.from(new Set((history ?? []).map((h: any) => h.track_id).filter(Boolean)));
  const totalStreams7d = history?.length ?? 0;

  if (trackIds.length === 0) {
    return { topGenres: [], bpmCenter: null, bpmStdDev: null, topMoods: [], totalStreams7d: 0 };
  }

  const { data: tracks } = await supabase
    .from("tracks")
    .select("id, genre, bpm, mood")
    .in("id", trackIds.slice(0, 1000));

  const genreCount: Record<string, number> = {};
  const moodCount: Record<string, number> = {};
  const bpms: number[] = [];

  for (const t of tracks ?? []) {
    if (t.genre) {
      const g = String(t.genre).toLowerCase().trim();
      genreCount[g] = (genreCount[g] ?? 0) + 1;
    }
    if (t.mood) {
      const m = String(t.mood).toLowerCase().trim();
      moodCount[m] = (moodCount[m] ?? 0) + 1;
    }
    if (typeof t.bpm === "number" && t.bpm > 0) bpms.push(t.bpm);
  }

  const totalGenres = Math.max(1, Object.values(genreCount).reduce((a, b) => a + b, 0));
  const topGenres = Object.entries(genreCount)
    .map(([genre, count]) => ({ genre, weight: count / totalGenres }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  const topMoods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);

  let bpmCenter: number | null = null;
  let bpmStdDev: number | null = null;
  if (bpms.length >= 5) {
    const mean = bpms.reduce((a, b) => a + b, 0) / bpms.length;
    const variance = bpms.reduce((acc, v) => acc + (v - mean) ** 2, 0) / bpms.length;
    bpmCenter = Math.round(mean);
    bpmStdDev = Math.round(Math.sqrt(variance));
  }

  return { topGenres, bpmCenter, bpmStdDev, topMoods, totalStreams7d };
}

async function fetchCCMixterGenre(genre: string, limit = 25): Promise<CCTrack[]> {
  try {
    const url = new URL("http://dig.ccmixter.org/api/query");
    url.searchParams.set("f", "json");
    url.searchParams.set("tags", genre);
    url.searchParams.set("sort", "date");
    url.searchParams.set("lic", "by,by-nc,by-sa,by-nc-sa");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "GrouAIStream-AR-Scout/1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as CCTrack[]) : [];
  } catch (e) {
    console.warn(`[a-r-scout] CCMixter fetch failed for ${genre}:`, e);
    return [];
  }
}

function pickAudioUrl(t: CCTrack): string | null {
  if (t.download_url) return t.download_url;
  if (Array.isArray(t.files)) {
    const mp3 = t.files.find((f) => f.file_name?.toLowerCase().endsWith(".mp3"));
    return mp3?.download_url ?? t.files[0]?.download_url ?? null;
  }
  return null;
}

function extractLicenseCode(licenseUrl?: string): string {
  if (!licenseUrl) return "unknown";
  const m = licenseUrl.match(/licenses\/([a-z\-]+)\//);
  return m ? m[1] : "unknown";
}

function scoreCandidate(t: CCTrack, genre: string, taste: PlatformTaste): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Genre match
  const genreWeight = taste.topGenres.find((g) => g.genre === genre.toLowerCase())?.weight ?? 0;
  if (genreWeight > 0) {
    const pts = Math.round(genreWeight * 40);
    score += pts;
    reasons.push(`gatunek "${genre}" = ${(genreWeight * 100).toFixed(0)}% słuchania (+${pts})`);
  } else {
    reasons.push(`gatunek "${genre}" rzadko słuchany`);
  }

  // License
  const lic = extractLicenseCode(t.license_url);
  if (ACCEPTABLE_LICENSES.includes(lic)) {
    score += 15;
    reasons.push(`licencja CC ${lic.toUpperCase()} (+15)`);
  } else {
    score -= 10;
    reasons.push(`licencja niejasna (${lic})`);
  }

  // Tags richness (więcej tagów = lepiej opisany utwór)
  const tagCount = (t.upload_tags ?? "").split(/[,\s]+/).filter(Boolean).length;
  if (tagCount >= 3) {
    score += 5;
    reasons.push(`${tagCount} tagów (+5)`);
  }

  // Description
  if (t.upload_description && t.upload_description.length > 60) {
    score += 5;
    reasons.push(`opis utworu obecny (+5)`);
  }

  // Audio dostępne
  if (pickAudioUrl(t)) {
    score += 10;
    reasons.push(`MP3 do pobrania (+10)`);
  } else {
    score -= 20;
    reasons.push(`brak audio URL`);
  }

  // Mood match (heurystyka po tagach)
  const tagsLower = (t.upload_tags ?? "").toLowerCase();
  for (const mood of taste.topMoods) {
    if (tagsLower.includes(mood)) {
      score += 8;
      reasons.push(`tag pasuje do nastroju "${mood}" (+8)`);
      break;
    }
  }

  return { score, reasons };
}

async function scanForCandidates(taste: PlatformTaste): Promise<Candidate[]> {
  const allCandidates: Candidate[] = [];
  // skanujemy tylko top gatunki z platformy + fallback na CC_GENRES jeśli platforma jeszcze ciche
  const targetGenres = taste.topGenres.length > 0
    ? taste.topGenres.slice(0, 4).map((g) => g.genre).filter((g) => CC_GENRES.includes(g))
    : ["rock", "electronic"];

  if (targetGenres.length === 0) targetGenres.push("electronic", "rock");

  for (const genre of targetGenres) {
    const tracks = await fetchCCMixterGenre(genre, 20);
    for (const t of tracks) {
      const audioUrl = pickAudioUrl(t);
      const { score, reasons } = scoreCandidate(t, genre, taste);
      allCandidates.push({
        source: "ccmixter",
        external_id: String(t.upload_id),
        title: t.upload_name ?? "Untitled",
        artist: t.user_real_name || t.user_name || "Unknown",
        genre,
        audio_url: audioUrl,
        page_url: t.file_page_url ?? `http://ccmixter.org/files/${t.user_name}/${t.upload_id}`,
        license: extractLicenseCode(t.license_url),
        tags: t.upload_tags ?? "",
        score,
        reasons,
      });
    }
    await new Promise((r) => setTimeout(r, 600)); // rate limit
  }

  return allCandidates;
}

async function filterAlreadyKnown(
  supabase: any,
  candidates: Candidate[],
): Promise<Candidate[]> {
  if (candidates.length === 0) return [];
  // sprawdź czy nie mamy już tego utworu w bazie (po title + artist)
  const fresh: Candidate[] = [];
  for (const c of candidates) {
    const { data: exists } = await supabase
      .from("tracks")
      .select("id")
      .eq("title", c.title)
      .eq("artist", c.artist)
      .maybeSingle();
    if (!exists) fresh.push(c);
  }
  return fresh;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const startedAt = Date.now();
  console.log("[a-r-scout] starting scan");

  try {
    // 1. taste profile
    const taste = await computePlatformTaste(supabase);
    console.log("[a-r-scout] platform taste:", JSON.stringify(taste));

    // 2. scan
    const rawCandidates = await scanForCandidates(taste);
    console.log(`[a-r-scout] scanned ${rawCandidates.length} raw candidates`);

    // 3. filter known
    const fresh = await filterAlreadyKnown(supabase, rawCandidates);
    console.log(`[a-r-scout] ${fresh.length} fresh after dedup`);

    // 4. top 5 by score
    const top = fresh.sort((a, b) => b.score - a.score).slice(0, 5);

    // 5. emit events + decisions
    const eventIds: string[] = [];
    for (const cand of top) {
      const { data: evt } = await supabase.rpc("emit_agent_event", {
        _event_type: "agent.recommendation",
        _source: AGENT_NAME,
        _actor_user_id: null,
        _target_type: "external_track",
        _target_id: null,
        _payload: {
          candidate: cand,
          taste_snapshot: { topGenres: taste.topGenres, totalStreams7d: taste.totalStreams7d },
        },
        _priority: 6,
      });
      if (evt) eventIds.push(evt as string);

      // decyzja do akceptacji w UI admina
      await supabase.from("agent_decisions").insert({
        agent_name: AGENT_NAME,
        decision_type: "import_external_track",
        reasoning: `Score ${cand.score}/100. ${cand.reasons.join("; ")}`,
        action_taken: {
          proposal: "import_track",
          source: cand.source,
          external_id: cand.external_id,
          title: cand.title,
          artist: cand.artist,
          genre: cand.genre,
          audio_url: cand.audio_url,
          page_url: cand.page_url,
          license: cand.license,
          score: cand.score,
        },
        event_ids: evt ? [evt] : [],
      });
    }

    // 6. update agent registry
    await supabase
      .from("agent_registry")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "ok",
        last_error: null,
        success_count: ((await supabase
          .from("agent_registry")
          .select("success_count")
          .eq("name", AGENT_NAME)
          .maybeSingle()).data?.success_count ?? 0) + 1,
      })
      .eq("name", AGENT_NAME);

    const durationMs = Date.now() - startedAt;
    return new Response(
      JSON.stringify({
        ok: true,
        scanned: rawCandidates.length,
        fresh: fresh.length,
        recommended: top.length,
        top: top.map((c) => ({ title: c.title, artist: c.artist, score: c.score, genre: c.genre })),
        taste_summary: {
          top_genres: taste.topGenres.slice(0, 3),
          bpm_center: taste.bpmCenter,
          streams_7d: taste.totalStreams7d,
        },
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[a-r-scout] error:", msg);

    await supabase
      .from("agent_registry")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "error",
        last_error: msg,
        error_count: ((await supabase
          .from("agent_registry")
          .select("error_count")
          .eq("name", AGENT_NAME)
          .maybeSingle()).data?.error_count ?? 0) + 1,
      })
      .eq("name", AGENT_NAME);

    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
