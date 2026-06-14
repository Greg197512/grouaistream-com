// Radio Mood Switch — admin klika tryb (chill/energetic/focus/party),
// edge function woła webhook n8n, który dobiera utwory AI i odsyła do radio-apply-mood-schedule.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MOODS = ["chill", "energetic", "focus", "party"] as const;
type Mood = typeof ALLOWED_MOODS[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "moderator"])
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin/moderator only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mood = String(body?.mood || "").toLowerCase() as Mood;
    if (!ALLOWED_MOODS.includes(mood)) {
      return new Response(JSON.stringify({ error: `Invalid mood. Allowed: ${ALLOWED_MOODS.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load workflow webhook
    const { data: wf } = await admin
      .from("aurora_n8n_workflows")
      .select("webhook_url, enabled")
      .eq("workflow_id", "grouai-radio-mood-selector")
      .maybeSingle();

    // Get ingest token for callback
    const { data: tokenRow } = await admin
      .from("n8n_ingest_tokens")
      .select("token")
      .eq("source_type", "radio_mood")
      .eq("is_active", true)
      .maybeSingle();

    if (!tokenRow?.token) {
      return new Response(JSON.stringify({ error: "Ingest token missing — contact admin" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/radio-apply-mood-schedule`;

    // If n8n webhook is configured, call it; else fallback = directly call our own apply with no AI (simple shuffle).
    if (wf?.enabled && wf?.webhook_url) {
      const dispatch = await fetch(wf.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          requested_by: userId,
          callback_url: callbackUrl,
          callback_token: tokenRow.token,
        }),
      }).catch((e) => ({ ok: false, status: 0, text: () => Promise.resolve(String(e)) } as any));

      if (!dispatch.ok) {
        const errText = await dispatch.text?.().catch(() => "");
        return new Response(JSON.stringify({
          error: "n8n dispatch failed", status: dispatch.status, details: errText?.slice(0, 200),
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      // Fallback path: pick tracks ourselves so the feature still works even before n8n is activated.
      const moodFilters: Record<Mood, { genres: string[]; minDur: number; maxDur: number }> = {
        chill: { genres: ["Ambient", "Acoustic", "Lo-Fi", "Folk", "Jazz", "Classical", "Indie"], minDur: 120, maxDur: 600 },
        energetic: { genres: ["Rock", "Punk", "Metal", "Electronic", "Hip-Hop", "Rap", "EDM"], minDur: 120, maxDur: 600 },
        focus: { genres: ["Lo-Fi", "Ambient", "Classical", "Instrumental", "Post-Rock", "Electronic"], minDur: 120, maxDur: 600 },
        party: { genres: ["Dance", "House", "Pop", "Electronic", "EDM", "Hip-Hop", "Disco"], minDur: 120, maxDur: 600 },
      };
      const filter = moodFilters[mood];
      const orList = filter.genres.map((g) => `genre.ilike.%${g}%`).join(",");
      const { data: candidates } = await admin
        .from("tracks")
        .select("id, artist")
        .not("audio_url", "is", null)
        .gte("duration", filter.minDur)
        .or(orList)
        .limit(120);

      const picks = (candidates || []).sort(() => Math.random() - 0.5).slice(0, 60).map((t) => t.id);
      const applyRes = await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRow.token, mood, track_ids: picks, source: "fallback" }),
      });
      if (!applyRes.ok) {
        const t = await applyRes.text();
        return new Response(JSON.stringify({ error: "Fallback apply failed", details: t.slice(0, 200) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ ok: true, mood, dispatched: wf?.enabled ? "n8n" : "fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("radio-mood-switch error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
