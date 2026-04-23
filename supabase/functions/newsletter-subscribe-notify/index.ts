// Wysyła sygnał o nowym zapisie do newslettera do n8n router webhook.
// Best-effort: jeśli n8n niedostępne, zapis i tak był OK po stronie bazy.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, source, event } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const N8N_URL = Deno.env.get("N8N_ROUTER_WEBHOOK_URL");
    if (!N8N_URL) {
      // Tichaj — n8n opcjonalne, zapis i tak był ok.
      return new Response(JSON.stringify({ ok: true, n8n: "not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: event || "newsletter.subscribed",
        email: email.toLowerCase().trim(),
        source: source || "blog_inline",
        timestamp: new Date().toISOString(),
        platform: "grouai-stream",
      }),
      signal: AbortSignal.timeout(5000),
    }).catch((e) => {
      console.warn("[newsletter-subscribe-notify] n8n fetch failed:", e?.message);
      return null;
    });

    return new Response(
      JSON.stringify({ ok: true, n8n: r?.ok ? "delivered" : "fail_silent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[newsletter-subscribe-notify] error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
