// GrouAI Studio Router → proxy to n8n Multi-Engine Router workflow.
// User clicks "Generuj" with ElevenLabs toggle OFF → this function forwards the
// request to the n8n webhook which decides Suno / ElevenLabs / MusicGen.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const N8N_WEBHOOK_URL = Deno.env.get("N8N_ROUTER_WEBHOOK_URL");
    if (!N8N_WEBHOOK_URL) {
      return new Response(JSON.stringify({
        error: "router_not_configured",
        message: "Router n8n nie jest skonfigurowany. Administrator musi dodać sekret N8N_ROUTER_WEBHOOK_URL.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userJwt = req.headers.get("Authorization")?.replace("Bearer ", "") || "";

    console.log("[studio-router] Forwarding to n8n:", {
      prompt: body.prompt?.substring(0, 80),
      duration: body.duration,
      hasVocals: body.hasVocals,
      quality: body.quality,
    });

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, userJwt }),
    });

    const text = await n8nResponse.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!n8nResponse.ok) {
      console.error("[studio-router] n8n error:", n8nResponse.status, text);
      return new Response(JSON.stringify({
        error: "router_failed",
        message: `n8n router zwrócił ${n8nResponse.status}`,
        details: data,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[studio-router] error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown_error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
