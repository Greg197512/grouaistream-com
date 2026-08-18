// GROUAI HUB — studio-video: teledysk / film z tekstu przez Replicate (modele open-source).
// Przełącznik jakości:
//   good → LTX-Video (Lightricks) — szybki i tani (~grosze/klip), dla zwykłych userów.
//   vip  → MiniMax video-01 — wyższa jakość, dla planów Pro/Ultimate/admina.
// Auth: JWT użytkownika z LIVE (bvstv). Klucz: hub_config.replicate_api_token.
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

function extractVideoUrl(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      return (o.video as string) || (o.url as string) || "";
    }
  }
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
  if (!token) return json({ error: "replicate_api_token not configured (hub_config)" }, 500);
  const rHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(BVSTV_URL, BVSTV_ANON, { global: { headers: { Authorization: authHeader } } });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = body.action ?? "generate";

  try {
    // ===== STATUS =====
    if (action === "status") {
      const predId = body.job_id || body.prediction_id;
      if (!predId) return json({ error: "job_id required" }, 400);
      const r = await fetch(`${REPLICATE_BASE}/predictions/${predId}`, { headers: rHeaders });
      const data = await r.json();
      if (!r.ok) return json({ error: "replicate_poll_failed", details: data }, r.status);
      const st = data?.status;
      if (st === "succeeded") {
        const url = extractVideoUrl(data.output);
        if (!url) return json({ ok: true, status: "failed", error: "no_video_in_output" });
        return json({ ok: true, status: "completed", video_url: url });
      }
      if (st === "failed" || st === "canceled") return json({ ok: true, status: "failed", error: data?.error || null });
      return json({ ok: true, status: "processing" });
    }

    // ===== GENERATE =====
    const { data: userData } = await live.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ ok: false, error: "unauthorized", message: "Zaloguj się, aby tworzyć wideo" }, 401);

    const quality: "good" | "vip" = body.quality === "vip" ? "vip" : "good";

    // Rola + plan liczymy zawsze — potrzebne do VIP oraz do limitu dziennego.
    const [{ data: isAdmin }, { data: subRow }] = await Promise.all([
      live.rpc("has_role", { _user_id: userId, _role: "admin" }),
      live.from("user_subscriptions").select("plan, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
    ]);
    const paid = Boolean(subRow && (subRow.plan === "pro" || subRow.plan === "ultimate"));

    // VIP wymaga planu płatnego/admina (droższy model). Good — każdy zalogowany.
    if (quality === "vip" && !isAdmin && !paid) {
      return json({ ok: false, error: "subscription_required", message: "Jakość VIP wymaga planu Pro lub Ultimate." }, 403);
    }

    // ── LIMIT DZIENNY (ochrona kosztów Replicate) ────────────────────────────
    // Niski dla darmowych, wyższy dla Pro/Ultimate, bez limitu dla admina.
    // Progi konfigurowalne w hub_config: video_daily_limit_free / _pro.
    const freeLimit = parseInt(cfg["video_daily_limit_free"] || "2", 10);
    const proLimit = parseInt(cfg["video_daily_limit_pro"] || "10", 10);
    const dailyLimit = isAdmin ? Infinity : paid ? proLimit : freeLimit;
    if (dailyLimit !== Infinity) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await svc
        .from("video_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfDay.toISOString());
      if ((count ?? 0) >= dailyLimit) {
        return json({
          ok: false,
          error: "daily_limit",
          message: paid
            ? `Dzienny limit wideo osiągnięty (${dailyLimit}/dzień). Wróć jutro.`
            : `Dzienny limit wideo osiągnięty (${dailyLimit}/dzień). Ulepsz plan do Pro/Ultimate, aby robić więcej — albo wróć jutro.`,
          limit: dailyLimit,
          used: count ?? 0,
        }, 429);
      }
    }

    let prompt: string = String(body.prompt || "").trim();
    if (prompt.length < 3) return json({ ok: false, error: "prompt_too_short" }, 400);
    const aspect: string = body.aspect || "16:9";

    // Zdjęcie postaci (teledysk z własną osobą) — URL po uploadzie do R2.
    const characterImage: string = typeof body.image === "string" && /^https?:\/\//i.test(body.image) ? body.image : "";

    // Tryb śpiewany / teledysk z postacią: twarz MUSI być widoczna i wyeksponowana.
    const singing = body.singing === true || Boolean(characterImage);
    if (singing) {
      prompt += ", face perfectly centered and fully visible at all times, front-facing the camera, bright soft light on the face, lips clearly visible, steady camera";
    }
    const negBase = "low quality, worst quality, blurry, distorted, deformed, watermark, text";
    const negSinging = negBase + ", face turned away, back of head, side profile, occluded face, blurry face, cutaway, wide shot, multiple people";

    // Model: VIP = wyższa jakość; dla teledysku ze zdjęciem preferujemy model image→video.
    const model = quality === "vip"
      ? (cfg["video_model_vip"] || "minimax/video-01")
      : (characterImage ? (cfg["video_model_img2vid"] || cfg["video_model_good"] || "lightricks/ltx-video")
                        : (cfg["video_model_good"] || "lightricks/ltx-video"));

    // Modele wideo na Replicate są społecznościowe → wymagany version id + /v1/predictions.
    const mr = await fetch(`${REPLICATE_BASE}/models/${model}`, { headers: rHeaders });
    const mData = await mr.json();
    const version = mData?.latest_version?.id;
    if (!mr.ok || !version) {
      return json({ ok: false, error: "model_version_unresolved", details: mData }, 502);
    }

    // Budujemy input tylko z pól, które model faktycznie wspiera (Replicate waliduje schema).
    const props: Record<string, unknown> =
      mData?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(props, k);
    const input: Record<string, unknown> = { prompt };
    if (has("prompt_optimizer")) input.prompt_optimizer = true;
    if (has("negative_prompt")) input.negative_prompt = singing ? negSinging : negBase;
    if (has("aspect_ratio")) input.aspect_ratio = aspect;
    // Zdjęcie postaci → dopasuj nazwę pola do schematu modelu (różne modele, różne nazwy).
    if (characterImage) {
      const IMG_FIELDS = ["image", "input_image", "first_frame_image", "start_image", "subject_reference", "image_prompt"];
      const imgField = IMG_FIELDS.find((f) => has(f));
      if (imgField) input[imgField] = characterImage;
    }
    const rel = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST", headers: rHeaders, body: JSON.stringify({ version, input }),
    });
    const relData = await rel.json();
    if (!rel.ok) {
      if (rel.status === 402 || relData?.status === 402) {
        return json({ ok: false, error: "no_credit", message: "Konto Replicate nie ma środków — doładuj na replicate.com/account/billing" }, 402);
      }
      await svc.from("hub_log").insert({ source: "studio-video", level: "error", message: `create ${rel.status} [${model}]: ${JSON.stringify(relData).slice(0, 200)}` });
      return json({ ok: false, error: "replicate_create_failed", details: relData }, rel.status);
    }
    const predId = relData?.id;
    if (!predId) return json({ ok: false, error: "no_prediction_id", details: relData }, 502);

    // Liczymy zużycie (limit dzienny) + log.
    await svc.from("video_usage").insert({ user_id: userId });
    await svc.from("hub_log").insert({ source: "studio-video", level: "info", message: `Zlecono wideo (${quality}/${model})${characterImage ? " +postać" : ""} ${predId}`, data: { prompt: prompt.slice(0, 120) } });

    return json({ ok: true, job_id: predId, status: "starting", engine: quality, model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: "exception", message: msg.slice(0, 200) }, 500);
  }
});
