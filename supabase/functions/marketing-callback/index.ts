// Marketing Callback — n8n raportuje wynik publikacji per platforma.
// Wywoływane przez workflow social-distribution po próbie publikacji.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallbackPayload {
  marketing_post_id?: string;
  platform: string; // x | facebook | instagram | linkedin | tiktok
  status: "published" | "failed" | "skipped";
  external_url?: string | null;
  external_id?: string | null;
  error?: string | null;
  title?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as CallbackPayload | CallbackPayload[];
    const items = Array.isArray(body) ? body : [body];

    const results: any[] = [];
    for (const item of items) {
      if (!item?.platform || !item?.status) {
        results.push({ ok: false, error: "missing platform/status" });
        continue;
      }

      await supabase.from("marketing_logs").insert({
        post_id: item.marketing_post_id ?? null,
        action: `n8n_callback_${item.platform}`,
        api_payload: { platform: item.platform, title: item.title } as any,
        response: {
          status: item.status,
          external_url: item.external_url ?? null,
          external_id: item.external_id ?? null,
          error: item.error ?? null,
        } as any,
        next_action: item.status === "failed" ? "review" : null,
      });

      // Best-effort: jeśli FAIL, oznacz post jako failed; jeśli WSZYSTKIE OK to nic — autopilot ustawił published.
      if (item.marketing_post_id && item.status === "failed") {
        await supabase
          .from("marketing_posts")
          .update({ status: "partial_failed" })
          .eq("id", item.marketing_post_id);
      }

      results.push({ ok: true, platform: item.platform });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("marketing-callback error", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
