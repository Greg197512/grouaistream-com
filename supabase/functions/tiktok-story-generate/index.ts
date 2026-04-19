// Generuje 30s historię artysty: skrypt (Gemini) + audio (ElevenLabs) + 4 obrazy avatar AI
// Cron uruchamia codziennie. Zwraca też gotowe captions zsynchronizowane z TTS.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const S3_ENDPOINT = Deno.env.get("S3_ENDPOINT")!;
const S3_BUCKET = Deno.env.get("S3_BUCKET_NAME")!;
const S3_ACCESS_KEY = Deno.env.get("S3_ACCESS_KEY_ID")!;
const S3_SECRET = Deno.env.get("S3_SECRET_ACCESS_KEY")!;
const S3_REGION = Deno.env.get("S3_REGION") || "auto";

// Domyślny voice — kobiecy, energetyczny DJ ("Sarah")
const DJ_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

async function uploadToR2(key: string, data: Uint8Array, contentType: string): Promise<string> {
  // Prosty PUT do R2 z AWS Sig V4
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
  return url;
}

async function generateScript(artist: { name: string; era: string; genre: string; story_hook: string }) {
  const sys = `Jesteś scenarzystą wirusowych rolek TikTok/Shorts o legendarnych muzykach. Tworzysz emocjonalne 30-sekundowe historie po polsku. Mówisz jak charyzmatyczna AI DJ-ka — dynamicznie, intymnie, z dramaturgią. Każda historia kończy się outro o GrouAIStream.`;

  const user = `Stwórz scenariusz 30-sekundowej rolki o artyście: ${artist.name} (${artist.era}, ${artist.genre}).
Hook startowy: ${artist.story_hook}

WYMAGANIA:
- Hook (pierwsze 3 sekundy, max 12 słów) — coś co zatrzyma scroll
- Główna historia (20 sekund, ~55 słów) — zaskakujący fakt, dramat, emocja
- Outro (7 sekund, ~22 słowa) — DOKŁADNIE ten format: "A wiesz gdzie najlepiej posłuchasz [artysty]? Na GrouAIStream — dziecku marki GrouaRock. Muzyka, która patrzy ci w oczy. grouaistream.com"

Zwróć WYŁĄCZNIE JSON.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
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
              outro: { type: "string" },
              image_prompts: {
                type: "array",
                items: { type: "string" },
                description: "4 hyperrealistyczne prompty obrazów avatar AI DJ-ki + sceneria pasująca do artysty/ery, format pionowy 9:16, kinowe światło"
              },
            },
            required: ["hook", "main", "outro", "image_prompts"],
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

async function generateImage(prompt: string): Promise<Uint8Array> {
  const fullPrompt = `${prompt}. Vertical 9:16 aspect ratio, photorealistic 4K, cinematic lighting, neon orange and black GrouAIStream brand atmosphere, professional photography, depth of field, no text overlays.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
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
  // Proste captions: dzielimy każdą część na ~3-słowne kawałki, równomiernie po czasie
  const parts = [
    { text: hook, start: 0, end: 3 },
    { text: main, start: 3, end: 23 },
    { text: outro, start: 23, end: 30 },
  ];
  const captions: { text: string; start: number; end: number }[] = [];
  for (const p of parts) {
    const words = p.text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(" "));
    const dur = (p.end - p.start) / chunks.length;
    chunks.forEach((c, i) => captions.push({ text: c, start: p.start + i * dur, end: p.start + (i + 1) * dur }));
  }
  return captions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Wybierz najmniej używanego aktywnego artystę
    const { data: artistRow, error: artErr } = await supabase
      .from("tiktok_artists_pool")
      .select("*")
      .eq("is_active", true)
      .order("used_count", { ascending: true })
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();

    if (artErr) throw artErr;
    if (!artistRow) throw new Error("No active artist in pool");

    console.log(`[tiktok-story] Generating story for ${artistRow.name}`);

    // 2) Skrypt + prompty obrazów
    const story = await generateScript(artistRow);
    const fullText = `${story.hook}. ${story.main}. ${story.outro}`;

    // 3) TTS
    console.log("[tiktok-story] Generating TTS...");
    const audio = await generateTTS(fullText, DJ_VOICE_ID);
    const storyId = crypto.randomUUID();
    const audioKey = `tiktok/${storyId}/audio.mp3`;
    const audioUrl = await uploadToR2(audioKey, audio, "audio/mpeg");

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
        artist_name: artistRow.name,
        era: artistRow.era,
        genre: artistRow.genre,
        hook: story.hook,
        script: story.main,
        outro: story.outro,
        audio_url: audioUrl,
        image_urls: imageUrls,
        captions,
        voice_id: DJ_VOICE_ID,
        status: "ready",
        metadata: { image_prompts: story.image_prompts },
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // 7) Aktualizuj pool
    await supabase
      .from("tiktok_artists_pool")
      .update({ used_count: artistRow.used_count + 1, last_used_at: new Date().toISOString() })
      .eq("id", artistRow.id);

    return new Response(JSON.stringify({ success: true, story: inserted }), {
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
