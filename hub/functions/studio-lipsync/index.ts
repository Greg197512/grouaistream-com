// GROUAI HUB — studio-lipsync: synchronizacja ust ze słowami piosenki (VIP).
// Model: bytedance/latentsync na Replicate — bierze CAŁE wideo (sklejone sceny
// z twarzą wokalisty) + audio utworu i generuje wideo, w którym usta idą
// dokładnie ze śpiewem. Sterowane dźwiękiem ⇒ działa dla KAŻDEGO języka
// (polski, ukraiński, holenderski, angielski...).
// Auth: JWT użytkownika z LIVE (bvstv); tylko plan Pro/Ultimate lub admin (drogi model).
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
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function loadConfig(): Promise<Record<string, string>> {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

function extractUrl(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    return (o.video as string) || (o.url as string) || "";
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cfg = await loadConfig();
  const token = cfg["replicate_api_token"] || "";
  if (!token) return json({ error: "replicate_api_token not configured" }, 500);
  const rHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, { global: { headers: { Authorization: authHeader } } });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = body.action ?? "generate";

  try {
    if (action === "status") {
      const predId = body.job_id;
      if (!predId) return json({ error: "job_id required" }, 400);
      const r = await fetch(`${REPLICATE_BASE}/predictions/${predId}`, { headers: rHeaders });
      const data = await r.json();
      if (!r.ok) return json({ error: "replicate_poll_failed", details: data }, r.status);
      const st = data?.status;
      if (st === "succeeded") {
        const url = extractUrl(data.output);
        if (!url) return json({ ok: true, status: "failed", error: "no_video_in_output" });
        return json({ ok: true, status: "completed", video_url: url });
      }
      if (st === "failed" || st === "canceled") return json({ ok: true, status: "failed", error: data?.error || null });
      return json({ ok: true, status: "processing" });
    }

    // ===== GENERATE =====
    const { data: userData } = await live.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ ok: false, error: "unauthorized", message: "Zaloguj się" }, 401);

    // Lip-sync = drogi model ⇒ Pro/Ultimate lub admin.
    const [{ data: isAdmin }, { data: subRow }] = await Promise.all([
      live.rpc("has_role", { _user_id: userId, _role: "admin" }),
      live.from("user_subscriptions").select("plan, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
    ]);
    const paid = subRow && (subRow.plan === "pro" || subRow.plan === "ultimate");
    if (!isAdmin && !paid) {
      return json({ ok: false, error: "subscription_required", message: "Śpiewający teledysk (lip-sync) wymaga planu Pro lub Ultimate." }, 403);
    }

    const videoUrl = String(body.video_url || "").trim();
    const audioUrl = String(body.audio_url || "").trim();
    if (!/^https?:\/\//.test(videoUrl) || !/^https?:\/\//.test(audioUrl)) {
      return json({ ok: false, error: "video_url and audio_url required" }, 400);
    }

    const model = cfg["lipsync_model"] || "bytedance/latentsync";
    const mr = await fetch(`${REPLICATE_BASE}/models/${model}`, { headers: rHeaders });
    const mData = await mr.json();
    const version = mData?.latest_version?.id;
    if (!mr.ok || !version) return json({ ok: false, error: "model_version_unresolved", details: mData }, 502);

    const guidance = parseFloat(cfg["lipsync_guidance"] || "1.5") || 1.5;
    const rel = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST", headers: rHeaders,
      body: JSON.stringify({ version, input: { video: videoUrl, audio: audioUrl, guidance_scale: guidance } }),
    });
    const relData = await rel.json();
    if (!rel.ok) {
      if (rel.status === 402) return json({ ok: false, error: "no_credit", message: "Konto Replicate bez środków — doładuj." }, 402);
      return json({ ok: false, error: "replicate_create_failed", details: relData }, rel.status);
    }
    const predId = relData?.id;
    if (!predId) return json({ ok: false, error: "no_prediction_id", details: relData }, 502);

    await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      .from("hub_log").insert({ source: "studio-lipsync", level: "info", message: `Lip-sync zlecone ${predId}`, data: { user: userId } });

    return json({ ok: true, job_id: predId, status: "starting" });
  } catch (e) {
    return json({ ok: false, error: "exception", message: String(e).slice(0, 200) }, 500);
  }
});
