import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOPICS = [
  { topic: "Jak AI zmienia sposób, w jaki słuchamy muzyki w 2026", category: "trends", tags: ["AI", "music", "technology"] },
  { topic: "Detekcja nastroju w muzyce — przyszłość spersonalizowanego streamingu", category: "feature", tags: ["mood", "AI", "personalization"] },
  { topic: "Jak zarabiać na muzyce w erze AI — przewodnik dla niezależnych twórców", category: "monetization", tags: ["earnings", "creators", "monetization"] },
  { topic: "Sterowanie muzyką głosem — koniec ery klikania", category: "feature", tags: ["voice", "UX", "AI"] },
  { topic: "Top gatunki muzyczne dominujące na platformach streamingowych", category: "trends", tags: ["genres", "trends", "streaming"] },
  { topic: "Live radio z AI DJ-em — jak to działa i dlaczego to przyszłość", category: "feature", tags: ["radio", "DJ", "live"] },
  { topic: "Jak stworzyć utwór muzyczny w 30 sekund używając AI", category: "tutorial", tags: ["AI generation", "Suno", "tutorial"] },
  { topic: "Psychologia muzyki — co Twoje ulubione utwory mówią o Tobie", category: "psychology", tags: ["psychology", "mood", "analysis"] },
  { topic: "Imprezy z AI DJ — jak zorganizować magiczną sesję muzyczną", category: "tutorial", tags: ["party", "DJ", "QR"] },
  { topic: "Streaming muzyki bez bota — dlaczego prawdziwe odsłuchy mają znaczenie", category: "industry", tags: ["streaming", "verified", "fair"] },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const triggeredBy = req.headers.get("x-trigger") || "cron";

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Pick a topic not used recently
    const { data: recent } = await supabaseAdmin
      .from("seo_blog_posts")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(20);

    const recentTitles = new Set((recent || []).map((r) => r.title));
    const available = TOPICS.filter((t) => !recentTitles.has(t.topic));
    const pick = (available.length > 0 ? available : TOPICS)[Math.floor(Math.random() * (available.length || TOPICS.length))];

    // Generate via Lovable AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Jesteś profesjonalnym copywriterem SEO dla GrouAI Stream — platformy streamingowej z AI, mood detection, voice control i monetyzacją dla twórców (URL: grouaistream.com). Pisz po polsku, w stylu premium ale przystępnie. Używaj nagłówków H2/H3 (markdown). 800-1200 słów. Zwracaj TYLKO JSON: {\"title\":\"...\",\"description\":\"...max 155 chars...\",\"content\":\"...markdown...\"}",
          },
          {
            role: "user",
            content: `Napisz artykuł blogowy SEO na temat: "${pick.topic}". Naturalnie wpleć linki do GrouAI Stream (https://grouaistream.com), wymień funkcje (mood detection, AI DJ, voice commands, GrouaRadio, monetyzacja 65% dla twórców). Zachęć do rejestracji.`,
          },
        ],
      }),
    });

    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    let parsed: { title: string; description: string; content: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: try to extract JSON block
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned invalid JSON");
      parsed = JSON.parse(m[0]);
    }

    const slug = slugify(parsed.title) + "-" + Math.random().toString(36).slice(2, 7);

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("seo_blog_posts")
      .insert({
        title: parsed.title,
        slug,
        description: parsed.description.slice(0, 160),
        content: parsed.content,
        category: pick.category,
        tags: pick.tags,
        is_published: true,
        generated_by_ai: true,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    await supabaseAdmin.from("seo_settings").update({ last_blog_at: new Date().toISOString() }).eq("id", 1);
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "blog_generate",
      _level: "success",
      _message: `Nowy post AI: "${parsed.title}"`,
      _metadata: { slug, post_id: inserted.id, category: pick.category },
      _triggered_by: triggeredBy,
    });

    // Auto-ping new URL
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/indexnow-ping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ urls: [`https://grouaistream.com/blog/${slug}`] }),
      });
    } catch {
      // non-fatal
    }

    return new Response(JSON.stringify({ success: true, post: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "blog_generate",
      _level: "error",
      _message: `Błąd generowania bloga: ${msg}`,
      _metadata: {},
      _triggered_by: triggeredBy,
    });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
