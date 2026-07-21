// auto-cover-video — automatycznie generuje krótki teledysk z okładki utworu
// i zapisuje go w tracks.video_url. Wywoływane fire-and-forget z frontendu
// po każdej zmianie cover_url. Guard: pomija jeśli video już jest (chyba że force).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return json({ error: "server_misconfigured" }, 500);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const trackId: string | undefined = body?.track_id;
  const force: boolean = !!body?.force;
  if (!trackId) return json({ error: "track_id required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: track, error: selErr } = await admin
    .from("tracks")
    .select("id, title, artist, cover_url, video_url")
    .eq("id", trackId)
    .maybeSingle();

  if (selErr) return json({ error: selErr.message }, 500);
  if (!track) return json({ error: "track_not_found" }, 404);
  if (!track.cover_url) return json({ skipped: true, reason: "no_cover" });
  if (track.video_url && !force) return json({ skipped: true, reason: "has_video" });

  // Wywołaj istniejącą funkcję cover-video-generate (image-to-video z okładki).
  const prompt = `Cinematic music video visual for "${track.title || "track"}" by ${track.artist || "artist"} — subtle camera drift, atmospheric lighting, professional color grading, high quality`;

  const genRes = await fetch(`${SUPABASE_URL}/functions/v1/cover-video-generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_url: track.cover_url,
      quality: "max",
    }),
  });

  const gen = await genRes.json().catch(() => ({}));
  if (!genRes.ok || !gen?.video_url) {
    console.error("[auto-cover-video] generation failed:", genRes.status, gen);
    return json({ error: "video_generation_failed", details: gen }, 502);
  }

  const { error: updErr } = await admin
    .from("tracks")
    .update({ video_url: gen.video_url })
    .eq("id", trackId);

  if (updErr) {
    console.error("[auto-cover-video] update failed:", updErr);
    return json({ error: updErr.message }, 500);
  }

  return json({ ok: true, video_url: gen.video_url, model: gen.model });
});
