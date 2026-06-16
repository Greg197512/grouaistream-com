// Analyze audio features (BPM, energy, valence, danceability) for ONE track,
// or batch-process tracks missing features (cron mode from n8n).
//
// Modes:
//  - POST { track_id } + user JWT (owner or admin) → analyze one track, return features
//  - POST { action: "cron", batch?: number } + header "x-cron-secret: <CRON_SECRET>"
//    → process up to `batch` tracks (default 25) that have bpm IS NULL
//
// Public function (verify_jwt = false in config.toml). Auth enforced in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENROUTER_API_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

interface TrackIn {
  id: string;
  title: string;
  genre: string | null;
  mood: string | null;
  duration: number | null;
}

interface FeaturesOut {
  id: string;
  bpm: number;
  energy: number;
  valence: number;
  danceability: number;
}

function defaultsFor(t: TrackIn): FeaturesOut {
  const g = (t.genre || "").toLowerCase();
  let bpm = 120, energy = 0.5, valence = 0.5, danceability = 0.5;
  if (/ballad|ambient|acoustic|lo-?fi|classical/.test(g)) { bpm = 80; energy = 0.3; danceability = 0.3; }
  else if (/metal|hardcore|punk/.test(g))                  { bpm = 160; energy = 0.9; valence = 0.4; danceability = 0.55; }
  else if (/dance|edm|house|techno|disco/.test(g))         { bpm = 128; energy = 0.85; valence = 0.7; danceability = 0.9; }
  else if (/hip-?hop|rap|trap/.test(g))                    { bpm = 95; energy = 0.7; danceability = 0.8; }
  else if (/rock|alternative|indie/.test(g))               { bpm = 125; energy = 0.75; danceability = 0.55; }
  else if (/jazz|blues|soul/.test(g))                      { bpm = 95; energy = 0.5; valence = 0.55; danceability = 0.5; }
  return { id: t.id, bpm, energy, valence, danceability };
}

async function estimateBatch(tracks: TrackIn[]): Promise<FeaturesOut[]> {
  if (!OPENROUTER_API_KEY || tracks.length === 0) return tracks.map(defaultsFor);

  const prompt = `Estimate audio features for these music tracks. Return ONLY a JSON array.
Rules:
- bpm: integer 60-200
- energy/valence/danceability: 0.0-1.0
Tracks:
${tracks.map((t, i) => `${i + 1}. id="${t.id}" title="${t.title}" genre="${t.genre || "?"}" mood="${t.mood || "?"}" duration=${t.duration || "?"}s`).join("\n")}

Output JSON only:
[{"id":"...","bpm":120,"energy":0.7,"valence":0.6,"danceability":0.65}]`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a music analyst. Output ONLY valid JSON arrays. No prose, no markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const j = await res.json();
    let text: string = j.choices?.[0]?.message?.content || "[]";
    text = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const s = text.indexOf("["), e = text.lastIndexOf("]");
    if (s === -1 || e === -1) throw new Error("no array");
    const parsed = JSON.parse(text.slice(s, e + 1)) as FeaturesOut[];
    const byId = new Map(parsed.filter((p) => p?.id && typeof p.bpm === "number").map((p) => [p.id, p]));
    return tracks.map((t) => byId.get(t.id) || defaultsFor(t));
  } catch (e) {
    console.warn("AI estimate failed, using defaults:", (e as Error).message);
    return tracks.map(defaultsFor);
  }
}

async function persist(admin: ReturnType<typeof createClient>, f: FeaturesOut) {
  const now = new Date().toISOString();
  await admin.from("tracks").update({
    bpm: Math.round(f.bpm),
    energy: Math.max(0, Math.min(1, f.energy)),
    valence: Math.max(0, Math.min(1, f.valence)),
    danceability: Math.max(0, Math.min(1, f.danceability)),
    features_analyzed_at: now,
  }).eq("id", f.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({} as any));

    // ── CRON / n8n batch mode ───────────────────────────────────────────────
    if (body.action === "cron") {
      const provided = req.headers.get("x-cron-secret") || "";
      if (!CRON_SECRET || provided !== CRON_SECRET) return json({ error: "Forbidden" }, 403);

      const batch = Math.min(50, Math.max(1, Number(body.batch) || 25));
      const { data: pending, error: fErr } = await admin
        .from("tracks")
        .select("id, title, genre, mood, duration")
        .is("bpm", null)
        .limit(batch);
      if (fErr) throw fErr;
      if (!pending || pending.length === 0) {
        return json({ ok: true, processed: 0, done: true, message: "no tracks pending" });
      }
      const features = await estimateBatch(pending as TrackIn[]);
      for (const f of features) await persist(admin, f);

      // Health check: how many still missing
      const { count: stillMissing } = await admin
        .from("tracks").select("id", { count: "exact", head: true }).is("bpm", null);

      return json({
        ok: true,
        processed: features.length,
        still_missing: stillMissing ?? 0,
        done: (stillMissing ?? 0) === 0,
        sample: features.slice(0, 3),
      });
    }

    // ── Single-track mode (web flow) ────────────────────────────────────────
    const trackId: string | undefined = body.track_id;
    if (!trackId || typeof trackId !== "string") return json({ error: "track_id required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: track, error: tErr } = await admin
      .from("tracks")
      .select("id, title, genre, mood, duration, user_id, bpm, energy, valence, danceability")
      .eq("id", trackId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!track) return json({ error: "Track not found" }, 404);

    // Owner or admin only
    const isOwner = track.user_id === user.id;
    let isAdmin = false;
    if (!isOwner) {
      const { data: roleRow } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      isAdmin = !!roleRow;
    }
    if (!isOwner && !isAdmin) return json({ error: "Forbidden" }, 403);

    // Already analyzed? return cached
    if (track.bpm != null) {
      return json({
        ok: true, cached: true,
        features: {
          id: track.id, bpm: track.bpm,
          energy: track.energy ?? 0.5, valence: track.valence ?? 0.5, danceability: track.danceability ?? 0.5,
        },
      });
    }

    const [features] = await estimateBatch([track as TrackIn]);
    await persist(admin, features);
    return json({ ok: true, cached: false, features });
  } catch (e) {
    console.error("analyze-track-features error:", e);
    return json({ error: (e as Error).message || "Unknown" }, 500);
  }
});
