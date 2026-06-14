// Radio Apply Mood Schedule — callback z n8n (lub fallback) z listą track_ids.
// Czyści przyszłe pozycje radia (po obecnie granej) i wstawia nowe, ustawia radio_config.mode = 'mood:<name>'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MOODS = ["chill", "energetic", "focus", "party"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const mood = String(body?.mood || "").toLowerCase();
    const trackIdsRaw = Array.isArray(body?.track_ids) ? body.track_ids : [];

    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!ALLOWED_MOODS.includes(mood)) {
      return new Response(JSON.stringify({ error: "invalid mood" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate token
    const { data: tokenRow } = await admin
      .from("n8n_ingest_tokens")
      .select("id, is_active, source_type")
      .eq("token", token)
      .maybeSingle();
    if (!tokenRow?.is_active || tokenRow.source_type !== "radio_mood") {
      return new Response(JSON.stringify({ error: "invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const trackIds = trackIdsRaw.filter((x: unknown) => typeof x === "string").slice(0, 80);
    if (trackIds.length < 5) {
      return new Response(JSON.stringify({ error: "need at least 5 track_ids" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Filter to tracks that exist & have audio_url & duration >= 120
    const { data: valid } = await admin
      .from("tracks")
      .select("id, duration, audio_url")
      .in("id", trackIds)
      .not("audio_url", "is", null)
      .gte("duration", 120);

    // Preserve order of incoming track_ids
    const validSet = new Set((valid || []).map((t) => t.id));
    const finalIds = trackIds.filter((id: string) => validSet.has(id));
    if (finalIds.length < 5) {
      return new Response(JSON.stringify({ error: "too few valid tracks after filtering", got: finalIds.length }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find current playing position (current_schedule_id) to keep ongoing track and clear future ones
    const { data: cfg } = await admin
      .from("radio_config")
      .select("id, current_schedule_id")
      .limit(1)
      .maybeSingle();

    let cutoffPosition = 0;
    if (cfg?.current_schedule_id) {
      const { data: cur } = await admin
        .from("radio_schedule")
        .select("position")
        .eq("id", cfg.current_schedule_id)
        .maybeSingle();
      cutoffPosition = cur?.position ?? 0;
    } else {
      const { data: maxRow } = await admin
        .from("radio_schedule")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      cutoffPosition = maxRow?.position ?? 0;
    }

    // Delete all schedule entries strictly after the cutoff (so current track keeps playing)
    const { error: delErr } = await admin
      .from("radio_schedule")
      .delete()
      .gt("position", cutoffPosition);
    if (delErr) throw delErr;

    // Insert new entries starting right after cutoff
    const rows = finalIds.map((id: string, i: number) => ({
      track_id: id,
      position: cutoffPosition + 1 + i,
      item_type: "track",
      custom_duration: 0,
    }));
    const { error: insErr } = await admin.from("radio_schedule").insert(rows);
    if (insErr) throw insErr;

    // Update radio_config mode + restart timer so resolver starts from new section
    if (cfg?.id) {
      await admin
        .from("radio_config")
        .update({
          mode: `mood:${mood}`,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cfg.id);
    }

    // Log brain event
    await admin.rpc("emit_agent_event", {
      _event_type: "radio.mood.applied",
      _source: "radio-apply-mood-schedule",
      _actor_user_id: null,
      _target_type: "radio_config",
      _target_id: cfg?.id ?? null,
      _payload: { mood, count: finalIds.length, source: body?.source || "n8n" },
      _priority: 5,
    }).then(() => {}, () => {});

    // Touch token usage
    await admin
      .from("n8n_ingest_tokens")
      .update({ total_ingests: (1 as unknown as number), last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return new Response(JSON.stringify({ ok: true, applied: finalIds.length, mood }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("radio-apply-mood-schedule error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
