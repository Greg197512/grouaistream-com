// Generuje 30s rolkę TikTok/Shorts na temat NAJNOWSZEGO posta bloga GrouAI Stream:
// - skrypt (Gemini) na podstawie tytułu + treści posta
// - głos DJ-ki (ElevenLabs TTS)
// - podkład muzyczny pasujący do nastroju (ElevenLabs Music)
// - 4 obrazy AI (Gemini image)
// - captions zsynchronizowane z TTS
// Bez outro reklamowego — sama treść.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const S3_ENDPOINT = Deno.env.get("S3_ENDPOINT")!;
const S3_BUCKET = Deno.env.get("S3_BUCKET_NAME")!;
const S3_ACCESS_KEY = Deno.env.get("S3_ACCESS_KEY_ID")!;
const S3_SECRET = Deno.env.get("S3_SECRET_ACCESS_KEY")!;
const S3_REGION = Deno.env.get("S3_REGION") || "auto";
const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

// Domyślny voice — kobiecy, energetyczny DJ ("Sarah")
const DJ_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

async function uploadToR2(key: string, data: Uint8Array, contentType: string): Promise<string> {
  const url = `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHashBuf = await crypto.subtle.digest("SHA-256", data);
  const payloadHash = Array.from(new Uint8Array(payloadHashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  const host = new URL(S3_ENDPOINT).host;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n/${S3_BUCKET}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${S3_REGION}/s3/aws4_request`;
  const crHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest));
  const crHash = Array.from(new Uint8Array(crHashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crHash}`;

  async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
    const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  }
  const kDate = await hmac(new TextEncoder().encode("AWS4" + S3_SECRET), dateStamp);
  const kRegion = await hmac(kDate, S3_REGION);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const sigBuf = await hmac(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  const auth = `AWS4-HMAC-SHA256 Credential=${S3_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Host": host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Content-Type": contentType,
      "Authorization": auth,
    },
    body: data,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed [${res.status}]: ${text}`);
  }
  return `${R2_PUBLIC_BASE}/${key}`;
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function generateScript(post: { title: string; description: string; content: string; category: string; tags: string[] | null }) {
  const excerpt = stripHtml(post.content).slice(0, 1800);
  const tags = (post.tags || []).slice(0, 6).join(", ");

  const sys = `Jesteś scenarzystą wirusowych rolek TikTok/Shorts o muzyce, AI i kulturze. Tworzysz emocjonalne 30-sekundowe historie po polsku na podstawie artykułów blogowych. Mówisz jak charyzmatyczna AI DJ-ka — dynamicznie, intymnie, z dramaturgią. Ekstrahujesz NAJBARDZIEJ INTRYGUJĄCY wątek z artykułu i robisz z niego rolkę. Nie reklamujesz, nie wymieniasz nazwy serwisu — tylko opowiadasz historię z artykułu.`;

  const user = `Stwórz 30-sekundowy scenariusz rolki na podstawie artykułu z bloga GrouAI Stream:

TYTUŁ: ${post.title}
KATEGORIA: ${post.category}
TAGI: ${tags || "brak"}
OPIS: ${post.description}

TREŚĆ ARTYKUŁU (skrót):
${excerpt}

WYMAGANIA:
- Hook (pierwsze 3 sekundy, max 12 słów) — coś, co zatrzyma scroll, najmocniejsza myśl/fakt z artykułu
- Główna treść (~25 sekund, ~70 słów) — najciekawszy wątek z artykułu opowiedziany emocjonalnie
- BEZ outro reklamowego — kończysz mocnym puentowym zdaniem na temat artykułu (~2s, max 8 słów)
- mood: jedno słowo opisujące nastrój (np. "cinematic", "lo-fi chill", "dark electronic", "uplifting", "mysterious", "energetic")
- 4 hyperrealistyczne prompty obrazów AI w pionie 9:16 pasujące do tematu artykułu (kinowe światło, neonowo-pomarańczowa atmosfera GrouAI Stream, bez tekstu na obrazach)

Zwróć WYŁĄCZNIE JSON.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-2-9b-it:free",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      tools: [{
        type: "function",
        function: {
          name: "story",
          parameters: {
            type: "object",
            properties: {
              hook: { type: "string" },
              main: { type: "string" },
              outro: { type: "string", description: "Krótka, mocna puenta tematyczna (max 8 słów). NIE reklama." },
              mood: { type: "string", description: "Jedno słowo: nastrój dla podkładu muzycznego" },
              image_prompts: {
                type: "array",
                items: { type: "string" },
                description: "4 prompty obrazów 9:16, tematycznie powiązane z artykułem",
              },
            },
            required: ["hook", "main", "outro", "mood", "image_prompts"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "story" } },
    }),
  });

  if (!res.ok) throw new Error(`Gemini script failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const args = data.choices[0].message.tool_calls[0].function.arguments;
  return typeof args === "string" ? JSON.parse(args) : args;
}

async function generateTTS(text: string, voiceId: string): Promise<Uint8Array> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true, speed: 1.05 },
      }),
    }
  );
  if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function generateBackgroundMusic(mood: string, durationSeconds = 30): Promise<Uint8Array | null> {
  try {
    const prompt = `${mood} instrumental background music for a 30-second short-form video, modern production, subtle, no vocals, low-mid energy so a voiceover sits clearly on top, neon orange / dark cinematic GrouAI Stream vibe`;
    const res = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, music_length_ms: durationSeconds * 1000 }),
    });
    if (!res.ok) {
      console.warn(`[tiktok-story] music gen failed ${res.status}: ${await res.text()}`);
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.warn("[tiktok-story] music gen exception:", e);
    return null;
  }
}

async function generateImage(prompt: string): Promise<Uint8Array> {
  const fullPrompt = `${prompt}. Vertical 9:16 aspect ratio, photorealistic 4K, cinematic lighting, neon orange and black GrouAI Stream brand atmosphere, professional photography, depth of field, no text overlays.`;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-2-9b-it:free",
      messages: [{ role: "user", content: fullPrompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw new Error(`Image failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const dataUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) throw new Error("No image returned");
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function buildCaptions(hook: string, main: string, outro: string) {
  const parts = [
    { text: hook, start: 0, end: 3 },
    { text: main, start: 3, end: 28 },
    { text: outro, start: 28, end: 30 },
  ];
  const captions: { text: string; start: number; end: number }[] = [];
  for (const p of parts) {
    const words = p.text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(" "));
    if (chunks.length === 0) continue;
    const dur = (p.end - p.start) / chunks.length;
    chunks.forEach((c, i) => captions.push({ text: c, start: p.start + i * dur, end: p.start + (i + 1) * dur }));
  }
  return captions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Najnowszy opublikowany post bloga
    const { data: post, error: postErr } = await supabase
      .from("seo_blog_posts")
      .select("id, title, slug, description, content, category, tags")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (postErr) throw postErr;
    if (!post) throw new Error("No published blog post found");

    console.log(`[tiktok-story] Generating story from blog post: "${post.title}"`);

    // 2) Skrypt + prompty obrazów + mood
    const story = await generateScript(post);
    const fullText = `${story.hook}. ${story.main}. ${story.outro}`;
    const storyId = crypto.randomUUID();

    // 3) TTS + Music równolegle
    console.log(`[tiktok-story] Generating TTS + music (mood: ${story.mood})...`);
    const [audio, music] = await Promise.all([
      generateTTS(fullText, DJ_VOICE_ID),
      generateBackgroundMusic(story.mood, 30),
    ]);

    const audioKey = `tiktok/${storyId}/voice.mp3`;
    const audioUrl = await uploadToR2(audioKey, audio, "audio/mpeg");

    let musicUrl: string | null = null;
    if (music) {
      const musicKey = `tiktok/${storyId}/music.mp3`;
      musicUrl = await uploadToR2(musicKey, music, "audio/mpeg");
    }

    // 4) 4 obrazy równolegle
    console.log("[tiktok-story] Generating 4 images...");
    const imgPromises = (story.image_prompts as string[]).slice(0, 4).map(async (p, idx) => {
      const img = await generateImage(p);
      const key = `tiktok/${storyId}/img${idx}.png`;
      return uploadToR2(key, img, "image/png");
    });
    const imageUrls = await Promise.all(imgPromises);

    // 5) Captions
    const captions = buildCaptions(story.hook, story.main, story.outro);

    // 6) Zapis do DB
    const { data: inserted, error: insErr } = await supabase
      .from("tiktok_stories")
      .insert({
        id: storyId,
        artist_name: post.title.slice(0, 200),
        era: post.category,
        genre: story.mood,
        hook: story.hook,
        script: story.main,
        outro: story.outro,
        audio_url: audioUrl,
        image_urls: imageUrls,
        captions,
        voice_id: DJ_VOICE_ID,
        status: "ready",
        blog_post_id: post.id,
        metadata: {
          source: "blog_post",
          blog_post_slug: post.slug,
          blog_post_title: post.title,
          mood: story.mood,
          music_url: musicUrl,
          image_prompts: story.image_prompts,
        },
      })
      .select()
      .single();

    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, story: inserted, music_url: musicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[tiktok-story] error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
