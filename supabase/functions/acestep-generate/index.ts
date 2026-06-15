// GrouAI Studio — ACE-Step 1.5 engine.
// Output contract is 1:1 with groua-music-engine so SunoGeneratePanel can switch
// engines by changing only the function name + body fields.
//
// ACE-Step API (verified, docs/en/API.md):
//   POST /release_task  -> { data: { task_id, status } }
//   POST /query_result  -> { data: [{ task_id, status: 0|1|2, result: "<json string>" }] }
//   result[0].file = "/v1/audio?path=..." -> absolute URL = ACESTEP_API_URL + file
// Auth: Authorization: Bearer <ACESTEP_API_KEY>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { archiveToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACESTEP_API_URL = (Deno.env.get("ACESTEP_API_URL") || "").replace(/\/+$/, "");
const ACESTEP_API_KEY = Deno.env.get("ACESTEP_API_KEY") || "";
const ACESTEP_MODEL = Deno.env.get("ACESTEP_MODEL") || "acestep-v15-turbo";

function aceHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ACESTEP_API_KEY) h["Authorization"] = `Bearer ${ACESTEP_API_KEY}`;
  return h;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!ACESTEP_API_URL) return json({ error: "ACESTEP_API_URL not configured" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const supa = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = body.action ?? "generate";

  try {
    // ================= STATUS =================
    if (action === "status") {
      const taskId = body.task_id || body.prediction_id || body.replicate_id;
      if (!taskId) return json({ error: "task_id required" }, 400);

      const qr = await fetch(`${ACESTEP_API_URL}/query_result`, {
        method: "POST",
        headers: aceHeaders(),
        body: JSON.stringify({ task_id_list: [taskId] }),
      });
      const qrData = await qr.json();
      if (!qr.ok) return json({ error: "ACE-Step query failed", details: qrData }, qr.status);

      const entry = qrData?.data?.[0];
      const st = entry?.status; // 0=pending, 1=ok, 2=failed

      if (st === 1) {
        let file = "";
        try {
          const parsed = typeof entry.result === "string" ? JSON.parse(entry.result) : entry.result;
          file = parsed?.[0]?.file || "";
        } catch { /* ignore */ }

        const audioUrl = file.startsWith("http") ? file : `${ACESTEP_API_URL}${file}`;
        const r2Url = await archiveToR2({
          sourceUrl: audioUrl,
          folder: "acestep",
          id: taskId,
          fetchHeaders: aceHeaders(),
        });
        const finalUrl = r2Url || audioUrl;

        if (body.generation_id) {
          await supa.from("generations").update({
            status: "completed",
            audio_url: finalUrl,
          }).eq("id", body.generation_id);
        }

        return json({
          id: taskId,
          status: "succeeded",
          output: finalUrl,
          audio_url: finalUrl,
          r2_archived: !!r2Url,
        });
      }

      if (st === 2) {
        if (body.generation_id) {
          await supa.from("generations").update({ status: "failed" }).eq("id", body.generation_id);
        }
        return json({ id: taskId, status: "failed" });
      }

      return json({ id: taskId, status: "processing" });
    }

    // ================= GENERATE =================
    const { data: userData } = await supa.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const prompt: string = (body.prompt || body.caption || "").trim();
    if (prompt.length < 3) return json({ error: "prompt too short" }, 400);

    const instrumental: boolean = !!body.instrumental;
    const lyrics: string = instrumental ? "" : (body.lyrics || "").trim();
    const vocalLang: string = body.vocal_language || body.language || "pl";
    const duration: number = Math.min(Math.max(body.duration || body.duration_seconds || 30, 10), 240);
    const title: string = body.title || "GrouAI Track";

    const releaseBody: Record<string, unknown> = {
      prompt,
      lyrics,
      vocal_language: vocalLang,
      audio_duration: duration,
      audio_format: "mp3",
      model: ACESTEP_MODEL,
      thinking: true,
      use_format: true,
      use_cot_caption: true,
      use_cot_language: true,
      inference_steps: 8,
      batch_size: 1,
    };
    if (body.bpm) releaseBody.bpm = body.bpm;
    if (body.key_scale || body.music_key) releaseBody.key_scale = body.key_scale || body.music_key;
    if (instrumental) releaseBody.task_type = "text2music";

    const rel = await fetch(`${ACESTEP_API_URL}/release_task`, {
      method: "POST",
      headers: aceHeaders(),
      body: JSON.stringify(releaseBody),
    });
    const relData = await rel.json();
    if (!rel.ok) return json({ error: "ACE-Step release failed", details: relData }, rel.status);

    const taskId = relData?.data?.task_id;
    if (!taskId) return json({ error: "No task_id from ACE-Step", details: relData }, 502);

    const { data: gen } = await supa.from("generations").insert({
      user_id: userId,
      title,
      genre: body.genre || "ai",
      prompt: prompt.slice(0, 2000),
      lyrics: lyrics.slice(0, 4000),
      instrumental,
      status: "pending",
      replicate_id: taskId,
      engine: "acestep",
    }).select().single();

    return json({
      id: taskId,
      generation_id: gen?.id ?? null,
      status: "starting",
      engine: "acestep-v15",
      duration,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[acestep-generate] fatal", msg);
    return json({ error: msg }, 500);
  }
});
