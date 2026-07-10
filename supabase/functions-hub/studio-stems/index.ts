// GROUAI HUB — studio-stems
// Rozdzielanie utworu na ścieżki (wokal / perkusja / bas / reszta) — Demucs
// (open-source Meta) przez Replicate (ryan5453/demucs). Funkcja premium
// GrouAI Studio, jak "stems" w Suno. Wyniki archiwizowane w buckecie acestep
// jako {id}-stem-{nazwa}.mp3.
// Auth: JWT LIVE + plan Pro/Ultimate lub admin. Klucz: hub_config.replicate_api_token.
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
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function loadConfig(): Promise<Record<string, string>> {
  const { data } = await hubAdmin().from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

async function archiveStem(sourceUrl: string, id: string, stemName: string): Promise<string | null> {
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    const path = `${id}-stem-${stemName}.mp3`;
    const { error } = await hubAdmin().storage.from("acestep").upload(path, bytes, {
      contentType: r.headers.get("Content-Type") || "audio/mpeg",
      upsert: true,
    });
    if (error) return null;
    return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/acestep/${path}`;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cfg = await loadConfig();
  const token = cfg["replicate_api_token"] || "";
  if (!token) return json({ error: "replicate_api_token not configured" }, 500);
  const rHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await live.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = body.action ?? "start";

  try {
    // ===== STATUS =====
    if (action === "status") {
      const predId = String(body.task_id || "");
      const trackId = String(body.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
      if (!predId) return json({ error: "task_id required" }, 400);

      const r = await fetch(`${REPLICATE_BASE}/predictions/${predId}`, { headers: rHeaders });
      const data = await r.json();
      if (!r.ok) return json({ error: "poll_failed", details: data }, r.status);

      if (data.status === "succeeded") {
        const out = data.output || {};
        const stems: Record<string, string> = {};
        for (const [name, val] of Object.entries(out)) {
          if (typeof val === "string" && val.startsWith("http")) {
            const archived = await archiveStem(val, trackId || predId, name);
            stems[name] = archived || val;
          }
        }
        if (Object.keys(stems).length === 0) {
          return json({ status: "failed", error: "no_stems_in_output" });
        }
        return json({ status: "succeeded", stems });
      }
      if (data.status === "failed" || data.status === "canceled") {
        return json({ status: "failed", error: data?.error });
      }
      return json({ status: "processing" });
    }

    // ===== START =====
    // Premium: plan Pro/Ultimate lub admin
    const [{ data: isAdmin }, { data: subRow }] = await Promise.all([
      live.rpc("has_role", { _user_id: userId, _role: "admin" }),
      live.from("user_subscriptions").select("plan, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
    ]);
    const paidPlan = subRow && (subRow.plan === "pro" || subRow.plan === "ultimate");
    if (!isAdmin && !paidPlan) {
      return json({ error: "subscription_required", message: "Rozdzielanie na ścieżki wymaga planu Pro lub Ultimate." }, 403);
    }

    const audioUrl = String(body.audio_url || "");
    if (!audioUrl.startsWith("http")) return json({ error: "audio_url required" }, 400);

    // Model społecznościowy ⇒ version id
    const modelName = cfg["stems_model"] || "ryan5453/demucs";
    const mr = await fetch(`${REPLICATE_BASE}/models/${modelName}`, { headers: rHeaders });
    const mData = await mr.json();
    const version = mData?.latest_version?.id;
    if (!mr.ok || !version) return json({ error: "model_version_failed" }, 502);

    const rel = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST",
      headers: rHeaders,
      body: JSON.stringify({
        version,
        input: {
          audio: audioUrl,
          model: cfg["stems_variant"] || "htdemucs",
          output_format: "mp3",
          mp3_bitrate: 320,
        },
      }),
    });
    const relData = await rel.json();
    if (!rel.ok) {
      if (rel.status === 402) return json({ error: "Brak środków na koncie generowania." }, 402);
      return json({ error: "start_failed", details: relData }, rel.status);
    }
    return json({ task_id: relData?.id, status: "starting" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
