// GrouAI Studio — ACE-Step engine via Replicate.
// Model: lucataco/ace-step (community port of ACE-Step 1.5 with vocals)
// Auth: REPLICATE_API_TOKEN
//
// Output contract is 1:1 with groua-music-engine.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { archiveToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN") || "";
const REPLICATE_BASE = "https://api.replicate.com/v1";
const ACE_MODEL = Deno.env.get("ACE_REPLICATE_MODEL") || "lucataco/ace-step";

function rHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractAudioUrl(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      return (o.audio as string) || (o.url as string) || "";
    }
  }
  if (typeof output === "object") {
    const o = output as Record<string, unknown>;
    return (o.audio as string) || (o.url as string) || "";
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!REPLICATE_API_TOKEN) return json({ error: "REPLICATE_API_TOKEN not configured" }, 500);

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
      const predId = body.task_id || body.prediction_id || body.replicate_id;
      if (!predId) return json({ error: "prediction_id required" }, 400);

      const r = await fetch(`${REPLICATE_BASE}/predictions/${predId}`, { headers: rHeaders() });
      const data = await r.json();
      if (!r.ok) return json({ error: "Replicate poll failed", details: data }, r.status);

      const st = data?.status;

      if (st === "succeeded") {
        const audioUrl = extractAudioUrl(data.output);
        if (!audioUrl) return json({ error: "no audio in output", details: data.output }, 502);

        const r2Url = await archiveToR2({
          sourceUrl: audioUrl,
          folder: "acestep",
          id: predId,
        });
        const finalUrl = r2Url || audioUrl;

        if (body.generation_id) {
          await supa.from("generations").update({
            status: "completed",
            audio_url: finalUrl,
          }).eq("id", body.generation_id);
        }

        return json({
          id: predId,
          status: "succeeded",
          output: finalUrl,
          audio_url: finalUrl,
          r2_archived: !!r2Url,
        });
      }

      if (st === "failed" || st === "canceled") {
        if (body.generation_id) {
          await supa.from("generations").update({ status: "failed" }).eq("id", body.generation_id);
        }
        return json({ id: predId, status: "failed", error: data?.error });
      }

      return json({ id: predId, status: "processing" });
    }

    // ================= GENERATE =================
    const { data: userData } = await supa.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const prompt: string = (body.prompt || body.caption || "").trim();
    if (prompt.length < 3) return json({ error: "prompt too short" }, 400);

    const instrumental: boolean = !!body.instrumental;
    const lyrics: string = instrumental ? "[instrumental]" : (body.lyrics || "[instrumental]").trim();
    const duration: number = Math.min(Math.max(body.duration || body.duration_seconds || 60, 10), 240);
    const title: string = body.title || "GrouAI Track";

    // lucataco/ace-step input schema
    const input: Record<string, unknown> = {
      tags: prompt,
      lyrics,
      duration,
      scheduler: "euler",
      guidance_scale: 15,
      number_of_steps: 60,
    };

    const rel = await fetch(`${REPLICATE_BASE}/models/${ACE_MODEL}/predictions`, {
      method: "POST",
      headers: rHeaders(),
      body: JSON.stringify({ input }),
    });
    const relData = await rel.json();
    if (!rel.ok) return json({ error: "Replicate create failed", details: relData }, rel.status);

    const predId = relData?.id;
    if (!predId) return json({ error: "No prediction id from Replicate", details: relData }, 502);

    const { data: gen } = await supa.from("generations").insert({
      user_id: userId,
      title,
      genre: body.genre || "ai",
      prompt: prompt.slice(0, 2000),
      lyrics: lyrics.slice(0, 4000),
      instrumental,
      status: "pending",
      replicate_id: predId,
      engine: "acestep",
    }).select().single();

    return json({
      id: predId,
      generation_id: gen?.id ?? null,
      status: "starting",
      engine: "acestep-replicate",
      duration,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[acestep-generate] fatal", msg);
    return json({ error: msg }, 500);
  }
});
