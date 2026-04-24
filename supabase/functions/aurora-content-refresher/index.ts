// Aurora Content Refresher — odświeża najlepsze landingi i posty
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function rewriteWithAI(title: string, body: string): Promise<{ title: string; body: string }> {
  if (!LOVABLE_API_KEY) return { title, body };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Jesteś SEO copywriterem. Odśwież treść — popraw hooki, zaktualizuj CTA, dodaj świeże frazy. Zachowaj długość ±10%. Zwróć JSON {title, body}." },
        { role: "user", content: `Tytuł: ${title}\n\nTreść:\n${body}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return { title, body };
  const j = await res.json();
  try {
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return { title: parsed.title ?? title, body: parsed.body ?? body };
  } catch { return { title, body }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const REFRESH_AFTER_DAYS = 30;
    const cutoff = new Date(Date.now() - REFRESH_AFTER_DAYS * 86400000).toISOString();

    // Najlepsze landingi nisz starsze niż 30 dni
    const { data: niches } = await supabase
      .from("aurora_niches")
      .select("id, niche_name, launched_url, content_pillars")
      .eq("status", "launched")
      .lt("launched_at", cutoff)
      .order("opportunity_score", { ascending: false })
      .limit(5);

    const refreshed: any[] = [];

    for (const n of niches ?? []) {
      const pillarText = JSON.stringify(n.content_pillars ?? []);
      const fresh = await rewriteWithAI(n.niche_name, pillarText);
      await supabase
        .from("aurora_niches")
        .update({ content_pillars: { refreshed_at: new Date().toISOString(), text: fresh.body } })
        .eq("id", n.id);
      await supabase.from("aurora_content_refresh_log").insert({
        target_type: "niche_landing",
        target_id: n.id,
        niche_id: n.id,
        changes: { title: fresh.title },
      });
      refreshed.push({ id: n.id, name: n.niche_name });
    }

    return new Response(JSON.stringify({ ok: true, refreshed_count: refreshed.length, refreshed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
