// GROUAI HUB — higgsfield-video v1: teledysk / film z tekstu (Higgsfield Cloud API).
// Czeka na higgsfield_api_key w hub_config. Async: submit -> poll status -> URL.
// Auth: JWT użytkownika z LIVE (bvstv) — tylko zalogowani (płatny backend).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  // Autoryzacja użytkownika przez auth LIVE (bvstv).
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) return json({ ok: false, error: "unauthorized", message: "Zaloguj się, aby tworzyć wideo" }, 401);
  try {
    const bvstv = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"]);
    const { data: u } = await bvstv.auth.getUser(token);
    if (!u?.user) return json({ ok: false, error: "unauthorized", message: "Zaloguj się, aby tworzyć wideo" }, 401);
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const key = cfg["higgsfield_api_key"];
  const base = cfg["higgsfield_base_url"] || "https://api.higgsfield.ai/v1";
  // Brak klucza → funkcja gotowa, ale czeka na Grega. Przyjazny komunikat dla UI.
  if (!key) {
    return json({
      ok: false,
      pending: true,
      message: "🎬 Silnik wideo jest wbudowany — czeka tylko na klucz Higgsfield (cloud.higgsfield.ai). Po dodaniu klucza zacznie generować.",
    }, 200);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }

  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (cfg["higgsfield_api_secret"]) headers["hf-secret"] = cfg["higgsfield_api_secret"];

  try {
    // Sprawdzenie statusu istniejącego zadania.
    if (body.action === "status") {
      const jobId = String(body.job_id || "");
      if (!jobId) return json({ ok: false, error: "no_job_id" }, 422);
      const r = await fetch(`${base}/generations/${jobId}`, { headers, signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      const rawStatus = String(j.status || j.state || "processing").toLowerCase();
      const done = ["completed", "succeeded", "success", "done"].includes(rawStatus);
      const failed = ["failed", "error", "canceled", "cancelled"].includes(rawStatus);
      const videoUrl =
        j.output_url || j.result?.url || j.output?.url ||
        (Array.isArray(j.output) ? j.output[0] : null) || j.video_url || j.url || null;
      return json({
        ok: true,
        status: done ? "completed" : failed ? "failed" : "processing",
        video_url: done ? videoUrl : null,
      });
    }

    // Nowe zlecenie: tekst -> wideo.
    const prompt = String(body.prompt || "").trim();
    if (prompt.length < 3) return json({ ok: false, error: "empty_prompt" }, 422);
    const model = cfg["higgsfield_video_model"] || "higgsfield-text-to-video";
    const payload = {
      task: "text-to-video",
      model,
      prompt,
      duration: Number(body.duration || 5),
      aspect_ratio: body.aspect || "9:16",
    };
    const r = await fetch(`${base}/generations`, {
      method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      await db.from("hub_log").insert({ source: "higgsfield-video", level: "error", message: `submit ${r.status}: ${JSON.stringify(j).slice(0, 200)}` });
      return json({ ok: false, error: "higgsfield_error", status: r.status, detail: j }, 502);
    }
    const jobId = j.id || j.job_id || j.generation_id || null;
    await db.from("hub_log").insert({ source: "higgsfield-video", level: "info", message: `Zlecono wideo ${jobId || "?"}`, data: { prompt: prompt.slice(0, 120) } });
    return json({ ok: true, job_id: jobId });
  } catch (e) {
    return json({ ok: false, error: "exception", message: String(e).slice(0, 200) }, 500);
  }
});
