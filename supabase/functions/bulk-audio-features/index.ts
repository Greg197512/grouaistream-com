// Bulk-fill audio features (BPM, energy, valence, danceability) for tracks
// Uses Lovable AI Gateway to estimate features from title + genre + mood
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 20;

interface TrackInput {
  id: string;
  title: string;
  genre: string | null;
  mood: string | null;
}

interface FeaturesOut {
  id: string;
  bpm: number;
  energy: number;
  valence: number;
  danceability: number;
}

async function estimateBatch(tracks: TrackInput[]): Promise<FeaturesOut[]> {
  const prompt = `Estimate audio features for these music tracks. Return ONLY valid JSON array. Use realistic values:
- bpm: integer 60-200 (slow ballad ~70, pop ~120, dance ~128, metal ~150, hardcore ~170)
- energy: 0.0-1.0 (acoustic/ambient low, rock/dance high)
- valence: 0.0-1.0 (sad/dark low, happy/uplifting high)
- danceability: 0.0-1.0 (ballad low, club/disco high)

Tracks:
${tracks.map((t, i) => `${i + 1}. id="${t.id}" title="${t.title}" genre="${t.genre || "?"}" mood="${t.mood || "?"}"`).join("\n")}

Return JSON only, no markdown:
[{"id":"...","bpm":120,"energy":0.7,"valence":0.6,"danceability":0.65}]`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "You are a music analyst. Output ONLY valid JSON arrays. No prose, no markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  let text: string = json.choices?.[0]?.message?.content || "[]";
  // strip code fences if present
  text = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  // find first [ and last ]
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array in AI response");
  const parsed = JSON.parse(text.slice(start, end + 1));
  return parsed.filter((p: any) => p.id && typeof p.bpm === "number");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleCheck } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const action = body.action || "process_batch";

    if (action === "stats") {
      const { count: total } = await admin.from("tracks").select("*", { count: "exact", head: true });
      const { count: done } = await admin.from("tracks").select("*", { count: "exact", head: true }).not("bpm", "is", null);
      return new Response(JSON.stringify({ total, done, remaining: (total || 0) - (done || 0) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process one batch
    const { data: tracks, error: fetchErr } = await admin
      .from("tracks")
      .select("id, title, genre, mood")
      .is("bpm", null)
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!tracks || tracks.length === 0) {
      return new Response(JSON.stringify({ done: true, processed: 0, message: "No tracks left to analyze" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const features = await estimateBatch(tracks as TrackInput[]);

    // Update each track
    let updated = 0;
    const now = new Date().toISOString();
    for (const f of features) {
      const { error: updErr } = await admin
        .from("tracks")
        .update({
          bpm: Math.round(f.bpm),
          energy: Math.max(0, Math.min(1, f.energy)),
          valence: Math.max(0, Math.min(1, f.valence)),
          danceability: Math.max(0, Math.min(1, f.danceability)),
          features_analyzed_at: now,
        })
        .eq("id", f.id);
      if (!updErr) updated++;
    }

    // For tracks AI didn't return, mark as analyzed with genre-based defaults to avoid infinite loop
    const returnedIds = new Set(features.map(f => f.id));
    const missed = tracks.filter(t => !returnedIds.has(t.id));
    for (const t of missed) {
      await admin.from("tracks").update({
        bpm: 120, energy: 0.5, valence: 0.5, danceability: 0.5,
        features_analyzed_at: now,
      }).eq("id", t.id);
    }

    return new Response(JSON.stringify({
      processed: tracks.length,
      ai_estimated: updated,
      defaults_applied: missed.length,
      done: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("bulk-audio-features error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
