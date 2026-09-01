// Generates a TikTok reel: picks next template from queue, generates voiceover with ElevenLabs (Brian),
// builds word-level captions, uploads MP3 to Storage, returns reel record with everything client needs to render MP4.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { synthesizeTTS } from "../_shared/tts.ts";
import { putToR2 } from "../_shared/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Darmowy neuronowy lektor EN (głęboki, w stylu reklamy): Microsoft Edge TTS.
const REEL_VOICE = "en-US-ChristopherNeural";

interface ReelTemplate {
  id: string;
  slug: string;
  title: string;
  feature_name: string;
  hook: string;
  voiceover_script: string;
  outro: string;
  app_route: string | null;
  duration_seconds: number;
  screenshot_paths: string[];
}

function buildWordCaptions(script: string, totalDuration: number): { text: string; start: number; end: number }[] {
  // Split into 2-3 word chunks for kinetic captions
  const words = script.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf: string[] = [];
  for (const w of words) {
    buf.push(w);
    if (buf.length >= 3 || /[.!?,]$/.test(w)) {
      chunks.push(buf.join(" "));
      buf = [];
    }
  }
  if (buf.length) chunks.push(buf.join(" "));
  const per = totalDuration / chunks.length;
  return chunks.map((text, i) => ({
    text: text.replace(/[.,!?]+$/g, ""),
    start: +(i * per).toFixed(2),
    end: +((i + 1) * per).toFixed(2),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authenticated user (admin only — also fallback for cron without auth)
    const authHeader = req.headers.get("Authorization");
    let triggeredBy: string | null = null;
    let isCron = false;
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        triggeredBy = user.id;
        const { data: roleRow } = await supa.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (!roleRow) {
          return new Response(JSON.stringify({ error: "admin_only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } else {
      // Cron call — no auth header
      isCron = true;
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedTemplateId: string | undefined = body?.templateId;

    // Pick template — explicit or next in queue (least recently used)
    let template: ReelTemplate | null = null;
    if (requestedTemplateId) {
      const { data } = await supa.from("tiktok_reel_templates").select("*").eq("id", requestedTemplateId).maybeSingle();
      template = data as any;
    } else {
      const { data } = await supa
        .from("tiktok_reel_templates")
        .select("*")
        .eq("is_active", true)
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .order("queue_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      template = data as any;
    }

    if (!template) {
      return new Response(JSON.stringify({ error: "no_template_available" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Full narration: hook + script + outro
    const fullScript = `${template.hook} ${template.voiceover_script} ${template.outro}`.trim();

    // Generate voiceover — darmowy neuronowy Edge TTS (Christopher), fallback Google.
    const { audio: audioBytes, engine: ttsEngine } = await synthesizeTTS(fullScript, {
      voice: REEL_VOICE, lang: "en", rate: "+3%",
    });

    // Upload MP3 to storage
    const audioFileName = `${template.slug}-${Date.now()}.mp3`;
    const audioUrl = await putToR2({
      body: audioBytes,
      folder: "tiktok-reels/audio",
      fileName: audioFileName,
      contentType: "audio/mpeg",
    });
    if (!audioUrl) throw new Error("R2 upload failed (missing credentials or network error)");

    // Build kinetic word-chunk captions
    const captions = buildWordCaptions(fullScript, template.duration_seconds);

    // Create reel record
    const { data: reel, error: insertErr } = await supa
      .from("tiktok_reels")
      .insert({
        template_id: template.id,
        title: template.title,
        feature_name: template.feature_name,
        voiceover_script: fullScript,
        captions,
        audio_url: audioUrl,
        screenshot_urls: [],
        duration_seconds: template.duration_seconds,
        status: "voiceover_ready",
        language: "en",
        generated_by: triggeredBy,
        metadata: {
          hook: template.hook,
          outro: template.outro,
          app_route: template.app_route,
          screenshot_paths: template.screenshot_paths,
          voice: ttsEngine,
          triggered_by: isCron ? "cron" : "admin",
        },
      })
      .select()
      .single();

    if (insertErr) throw new Error(`Insert reel failed: ${insertErr.message}`);

    // Bump template usage
    await supa
      .from("tiktok_reel_templates")
      .update({ last_used_at: new Date().toISOString(), used_count: (template as any).used_count + 1 || 1 })
      .eq("id", template.id);

    return new Response(JSON.stringify({ success: true, reel }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("tiktok-reel-generate error:", e);
    return new Response(JSON.stringify({ error: e.message || "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
