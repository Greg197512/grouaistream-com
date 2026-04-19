import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI/Tech news source URLs to scrape via Firecrawl when in news_hunt mode
const NEWS_SOURCES = [
  "https://techcrunch.com/category/artificial-intelligence/",
  "https://www.theverge.com/ai-artificial-intelligence",
  "https://news.ycombinator.com/",
  "https://venturebeat.com/category/ai/",
];

const TOPICS = [
  // AI News (NEW)
  { topic: "Najnowsze przełomy w AI w tym tygodniu — co musisz wiedzieć", category: "ai_news", tags: ["AI","news","weekly"] },
  { topic: "OpenAI vs Google vs Anthropic — wyścig modeli AI 2026", category: "ai_news", tags: ["openai","google","anthropic"] },
  { topic: "Nowe modele AI dla muzyki — co wyszło w tym miesiącu", category: "ai_news", tags: ["AI","music","models"] },
  { topic: "Tech newsy z świata AI — co zmienia się tu i teraz", category: "tech_news", tags: ["tech","AI","update"] },
  { topic: "Jak nowinki AI wpływają na branżę muzyczną — najświeższe wieści", category: "ai_news", tags: ["AI","music industry","news"] },
  // Trends
  { topic: "Jak AI zmienia sposób, w jaki słuchamy muzyki w 2026", category: "trends", tags: ["AI","music","technology"] },
  { topic: "Top gatunki muzyczne dominujące na platformach streamingowych w 2026", category: "trends", tags: ["genres","trends","streaming"] },
  { topic: "Streaming muzyki bez bota — dlaczego prawdziwe odsłuchy mają znaczenie", category: "trends", tags: ["streaming","verified","fair"] },
  { topic: "Koniec ery Spotify? Nowa fala platform muzycznych z AI", category: "trends", tags: ["spotify","alternatives","AI"] },
  { topic: "Czy AI zabije kreatywność w muzyce? Spojrzenie z 2026 roku", category: "trends", tags: ["AI","creativity","debate"] },
  { topic: "Mikrogatunki w streamingu — dlaczego niszowa muzyka wygrywa", category: "trends", tags: ["niche","genres","discovery"] },
  { topic: "Wpływ TikToka na muzykę w 2026 — od viralu do kariery", category: "trends", tags: ["tiktok","viral","social"] },
  // Features
  { topic: "Detekcja nastroju w muzyce — przyszłość spersonalizowanego streamingu", category: "feature", tags: ["mood","AI","personalization"] },
  { topic: "Sterowanie muzyką głosem — koniec ery klikania", category: "feature", tags: ["voice","UX","AI"] },
  { topic: "Live radio z AI DJ-em — jak to działa i dlaczego to przyszłość", category: "feature", tags: ["radio","DJ","live"] },
  { topic: "AI DJ vs ludzki DJ — kto naprawdę wygrywa parkiet", category: "feature", tags: ["DJ","AI","comparison"] },
  { topic: "Mood detection przez kamerę — magia czy science fiction", category: "feature", tags: ["mood","camera","AI"] },
  { topic: "Voice control w aplikacji muzycznej — kompletny przewodnik", category: "feature", tags: ["voice","tutorial","UX"] },
  { topic: "Crossfade i mashup w czasie rzeczywistym — sztuka miksowania AI", category: "feature", tags: ["mixing","crossfade","AI"] },
  // Monetization
  { topic: "Jak zarabiać na muzyce w erze AI — przewodnik dla niezależnych twórców", category: "monetization", tags: ["earnings","creators","monetization"] },
  { topic: "65% dla twórcy vs 30% Spotify — dlaczego model fair stream wygrywa", category: "monetization", tags: ["earnings","fair","streaming"] },
  { topic: "Tipy i mikropłatności — jak fani naprawdę wspierają artystów", category: "monetization", tags: ["tips","fans","support"] },
  { topic: "Boost utworów — czy płatna promocja muzyki działa w 2026", category: "monetization", tags: ["boost","promotion","ads"] },
  { topic: "Weekend Challenge — jak zdobyć dodatkowe $50 jako twórca", category: "monetization", tags: ["challenge","earnings","weekend"] },
  { topic: "Royalty splits dla AI-generated music — kto dostaje pieniądze", category: "monetization", tags: ["royalties","AI","legal"] },
  { topic: "Sponsorship dla niezależnych twórców muzyki — gdzie szukać marek", category: "monetization", tags: ["sponsorship","brands","business"] },
  // Tutorials
  { topic: "Jak stworzyć utwór muzyczny w 30 sekund używając AI", category: "tutorial", tags: ["AI generation","Suno","tutorial"] },
  { topic: "Imprezy z AI DJ — jak zorganizować magiczną sesję muzyczną", category: "tutorial", tags: ["party","DJ","QR"] },
  { topic: "Klonowanie głosu w 5 minut — kompletny tutorial ElevenLabs", category: "tutorial", tags: ["voice clone","ElevenLabs","tutorial"] },
  { topic: "Jak zaimportować playlistę ze Spotify do GrouAI Stream", category: "tutorial", tags: ["import","spotify","tutorial"] },
  { topic: "Tworzenie covers utworów z AI — krok po kroku", category: "tutorial", tags: ["covers","AI","tutorial"] },
  { topic: "Promocja muzyki na Instagramie i TikToku w 2026 — sprawdzone taktyki", category: "tutorial", tags: ["promotion","social","tutorial"] },
  { topic: "Jak nagrać podcast z AI moderatorem — pełny workflow", category: "tutorial", tags: ["podcast","AI","tutorial"] },
  // Psychology
  { topic: "Psychologia muzyki — co Twoje ulubione utwory mówią o Tobie", category: "psychology", tags: ["psychology","mood","analysis"] },
  { topic: "Muzyka i emocje — dlaczego jeden utwór potrafi zmienić cały dzień", category: "psychology", tags: ["emotions","mood","science"] },
  { topic: "Dopamina, basy i drop — neuronauka muzyki elektronicznej", category: "psychology", tags: ["neuroscience","electronic","dopamine"] },
  { topic: "Sad music makes us happy — paradoks smutnej muzyki", category: "psychology", tags: ["sad","emotions","paradox"] },
  { topic: "Muzyka do pracy, do snu, do biegania — czy AI wybiera lepiej niż my", category: "psychology", tags: ["productivity","sleep","sport"] },
  // Industry
  { topic: "Spotify vs Apple vs Tidal vs GrouAI — porównanie modeli wypłat 2026", category: "industry", tags: ["comparison","payouts","platforms"] },
  { topic: "Independent artists w 2026 — koniec uzależnienia od labeli", category: "industry", tags: ["indie","labels","independence"] },
  { topic: "AI a prawo autorskie w muzyce — co musisz wiedzieć w 2026", category: "industry", tags: ["copyright","AI","legal"] },
  { topic: "Vinyl wraca — analogowy renesans w cyfrowym świecie", category: "industry", tags: ["vinyl","analog","trends"] },
  { topic: "Concerts as a service — jak streaming koncertów zmienia branżę", category: "industry", tags: ["concerts","live","streaming"] },
  // AI Music Tools
  { topic: "Najlepsze AI tools dla twórców muzyki w 2026 — ranking", category: "tools", tags: ["tools","AI","ranking"] },
  { topic: "Suno vs Udio vs ElevenLabs Music — szczerze porównane", category: "tools", tags: ["suno","udio","elevenlabs"] },
  { topic: "Free AI music generators — które są naprawdę darmowe", category: "tools", tags: ["free","AI","tools"] },
  { topic: "Voice cloning tools — od ElevenLabs po Resemble AI", category: "tools", tags: ["voice","cloning","tools"] },
  // Lifestyle
  { topic: "Soundtrack Twojego życia — playlistowanie według nastroju dnia", category: "lifestyle", tags: ["lifestyle","playlist","mood"] },
  { topic: "Muzyka rano vs wieczorem — co mówi nauka", category: "lifestyle", tags: ["routine","science","mood"] },
  { topic: "Dlaczego słuchamy tych samych utworów w kółko — efekt mere exposure", category: "lifestyle", tags: ["psychology","habit","loop"] },
  // SEO/marketing for musicians
  { topic: "SEO dla muzyków — jak Twoje utwory mają być znalezione w Google", category: "marketing", tags: ["SEO","musicians","marketing"] },
  { topic: "Email marketing dla niezależnych artystów — buduj fanbase za darmo", category: "marketing", tags: ["email","fanbase","marketing"] },
  { topic: "Cover art generowany AI — jak wyróżnić utwór wizualnie", category: "marketing", tags: ["cover","art","AI"] },
  { topic: "Jak zostać AI-driven artystą w 2026 — manifest", category: "marketing", tags: ["manifesto","AI artist","future"] },
  // Future
  { topic: "Brain-computer music — muzyka prosto z myśli (rok 2030?)", category: "future", tags: ["BCI","future","sci-fi"] },
  { topic: "Muzyka generowana w czasie rzeczywistym dla gier wideo", category: "future", tags: ["gaming","AI","procedural"] },
  { topic: "Holograficzne koncerty — co dalej po Abba Voyage", category: "future", tags: ["hologram","concerts","future"] },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Inject affiliate links into markdown by linking first occurrence of any keyword to its URL
function injectAffiliateLinks(content: string, links: Array<{ display_text: string; url: string; keywords: string[] }>): string {
  let result = content;
  const used = new Set<string>();
  for (const link of links) {
    if (used.has(link.url)) continue;
    for (const kw of link.keywords) {
      if (!kw) continue;
      // Don't replace inside existing markdown links or headings
      const pattern = new RegExp(`(?<!\\[)\\b(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?!\\]|\\()`, "i");
      if (pattern.test(result)) {
        result = result.replace(pattern, `[${link.display_text}](${link.url})`);
        used.add(link.url);
        break;
      }
    }
  }
  return result;
}

async function generateCoverImage(LOVABLE_API_KEY: string, title: string, category: string): Promise<string | null> {
  const isNews = category === "ai_news" || category === "tech_news";
  const sceneHint = isNews
    ? "futuristic AI laboratory with glowing neural networks, holographic data streams, server racks with neon orange LEDs, cinematic depth of field"
    : "moody music studio with vinyl records glowing under neon, audio waveforms in the air, professional DJ equipment, cinematic atmosphere";

  const prompt = `Create a HYPERREALISTIC, 4K, photorealistic editorial hero image for blog article: "${title}".
SCENE: ${sceneHint}.
STYLE: Shot on Hasselblad H6D-100c, 50mm prime lens, f/1.4 aperture, dramatic cinematic lighting, deep blacks, neon orange and amber accents, aurora borealis ambient glow, ultra-sharp focus on subject, premium magazine cover quality, 16:9 aspect ratio.
MOOD: Premium, intelligent, futuristic, emotionally captivating — like a National Geographic meets Wired magazine cover.
ABSOLUTE RULES: NO text, NO letters, NO logos, NO watermarks, NO typography. Pure photorealistic image only.`;

  const attempts = [
    "google/gemini-3-pro-image-preview",
    "google/gemini-3.1-flash-image-preview",
    "google/gemini-2.5-flash-image",
  ];

  for (const model of attempts) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      if (!res.ok) {
        console.error(`Cover gen ${model} failed`, res.status);
        continue;
      }
      const data = await res.json();
      const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (dataUrl) {
        console.log(`Cover generated with ${model}`);
        return dataUrl;
      }
    } catch (e) {
      console.error(`Cover gen ${model} exception`, e);
    }
  }
  return null;
}

// Fetch trending AI/tech news via Firecrawl search (best effort)
async function huntLatestNews(FIRECRAWL_API_KEY: string | undefined): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "latest AI music technology breakthrough this week",
        limit: 5,
        tbs: "qdr:w",
      }),
    });
    if (!res.ok) {
      console.error("Firecrawl search failed", res.status);
      return null;
    }
    const data = await res.json();
    const results = data?.data || data?.web?.results || [];
    if (!results.length) return null;
    return results.slice(0, 5).map((r: any) =>
      `- ${r.title || ""}: ${r.description || r.snippet || ""} (${r.url || ""})`
    ).join("\n");
  } catch (e) {
    console.error("News hunt failed", e);
    return null;
  }
}

async function uploadCoverToStorage(supabase: any, dataUrl: string, slug: string): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const ext = mime.split("/")[1] || "png";
    const b64 = match[2];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `covers/${slug}.${ext}`;
    const { error } = await supabase.storage.from("blog-assets").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (error) {
      console.error("Storage upload failed", error);
      return null;
    }
    const { data } = supabase.storage.from("blog-assets").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error("Upload exception", e);
    return null;
  }
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
      .limit(40);

    const recentTitles = new Set((recent || []).map((r: any) => r.title));
    const available = TOPICS.filter((t) => !recentTitles.has(t.topic));
    const pick = (available.length > 0 ? available : TOPICS)[Math.floor(Math.random() * (available.length || TOPICS.length))];

    // Generate text content via Lovable AI
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
              "Jesteś profesjonalnym copywriterem SEO dla GrouAI Stream — platformy streamingowej z AI, mood detection, voice control i monetyzacją dla twórców (URL: grouaistream.com). Pisz po polsku, w stylu premium ale przystępnie, z lekkim humorem. Używaj nagłówków H2/H3 (markdown), list, blockquotes, **bold**. 1000-1500 słów. Każda sekcja H2 ma 2-4 akapity. Zwracaj TYLKO JSON: {\"title\":\"...\",\"description\":\"...max 155 chars...\",\"content\":\"...markdown...\"}",
          },
          {
            role: "user",
            content: `Napisz artykuł blogowy SEO na temat: "${pick.topic}". Naturalnie wpleć linki do GrouAI Stream (https://grouaistream.com), wymień funkcje (mood detection, AI DJ, voice commands, GrouaRadio, monetyzacja 65% dla twórców). Wymień też powiązane narzędzia (Suno, ElevenLabs, Spotify) — będą one zlinkowane affiliate automatycznie. Zachęć do rejestracji na końcu.`,
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
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned invalid JSON");
      parsed = JSON.parse(m[0]);
    }

    const slug = slugify(parsed.title) + "-" + Math.random().toString(36).slice(2, 7);

    // Inject affiliate links
    const { data: affiliates } = await supabaseAdmin
      .from("blog_affiliate_links")
      .select("display_text, url, keywords, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    const enrichedContent = injectAffiliateLinks(parsed.content, affiliates || []);

    // Generate cover image (best effort, non-fatal)
    let coverUrl: string | null = null;
    const dataUrl = await generateCoverImage(LOVABLE_API_KEY, parsed.title, pick.category);
    if (dataUrl) {
      coverUrl = await uploadCoverToStorage(supabaseAdmin, dataUrl, slug);
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("seo_blog_posts")
      .insert({
        title: parsed.title,
        slug,
        description: parsed.description.slice(0, 160),
        content: enrichedContent,
        category: pick.category,
        tags: pick.tags,
        cover_url: coverUrl,
        is_published: true,
        generated_by_ai: true,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Generate distribution hooks (X / Telegram / Email) — best effort
    try {
      const hookRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Jesteś social media copywriterem. Tworzysz krótkie, mocne hooki promujące artykuł blogowy. Zwracasz TYLKO JSON: {\"x_hook\":\"...max 240 znaków, bez hashtagów spam, 1-2 emoji ok\",\"telegram_hook\":\"...max 400 znaków, emoji ok, lekko bardziej rozwinięte niż x\",\"email_hook\":\"...1 zdanie hook do przeczytania w preview email, max 120 znaków, bez emoji\",\"email_subject\":\"...max 60 znaków, intrygujący\"}",
            },
            {
              role: "user",
              content: `Artykuł: "${parsed.title}"\nOpis: ${parsed.description}\nLink: https://grouaistream.com/blog/${slug}\nKategoria: ${pick.category}\n\nWygeneruj hooki.`,
            },
          ],
        }),
      });
      if (hookRes.ok) {
        const hd = await hookRes.json();
        const hraw = hd.choices?.[0]?.message?.content || "";
        const hclean = hraw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        let hookData: any;
        try {
          hookData = JSON.parse(hclean);
        } catch {
          const m = hclean.match(/\{[\s\S]*\}/);
          if (m) hookData = JSON.parse(m[0]);
        }
        if (hookData) {
          await supabaseAdmin.from("blog_post_hooks").insert({
            post_id: inserted.id,
            x_hook: hookData.x_hook?.slice(0, 280) || null,
            telegram_hook: hookData.telegram_hook?.slice(0, 500) || null,
            email_hook: hookData.email_hook?.slice(0, 160) || null,
            email_subject: hookData.email_subject?.slice(0, 80) || null,
          });
        }
      }
    } catch (e) {
      console.error("Hook gen failed", e);
    }

    await supabaseAdmin.from("seo_settings").update({ last_blog_at: new Date().toISOString() }).eq("id", 1);
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "blog_generate",
      _level: "success",
      _message: `Nowy post AI: "${parsed.title}"`,
      _metadata: { slug, post_id: inserted.id, category: pick.category, has_cover: !!coverUrl },
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
