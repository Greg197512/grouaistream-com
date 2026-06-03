/**
 * covers-xai — generuje okładki dla 4 najnowszych utworów bez covera
 * używa xAI Aurora (Grok) do generowania obrazów
 * wgrywa na Cloudflare R2, aktualizuje cover_url w tabeli tracks
 *
 * Invoke: POST /functions/v1/covers-xai
 * Body (opcjonalne): { "limit": 4 }
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

// ─── R2 helpers ───────────────────────────────────────────────────────────────
function getR2Client() {
  const endpoint = Deno.env.get("S3_ENDPOINT");
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY");
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: Deno.env.get("S3_REGION") || "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadToR2(key: string, data: Uint8Array, contentType: string): Promise<string | null> {
  const client = getR2Client();
  const bucket = Deno.env.get("S3_BUCKET_NAME");
  if (!client || !bucket) { console.error("[covers-xai] R2 not configured"); return null; }
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
  return `${R2_PUBLIC_BASE}/${key}`;
}

function sanitize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

// ─── Prompt builder — dopasowany do gatunku ───────────────────────────────────
function buildPrompt(title: string, artist: string, genre: string | null): string {
  const g = (genre || "").toLowerCase();

  const genreStyle: Record<string, string> = {
    "electronic": "neon cyberpunk cityscape, deep purple and electric blue gradient, abstract waveforms, futuristic geometry",
    "hip-hop": "luxury noir rap cover, amber neon reflections on wet asphalt, powerful silhouette, cinematic haze, golden hour",
    "rock": "dark dramatic rock energy, electric guitar sparks, stormy atmosphere, bold contrast, raw power",
    "metal": "dark volcanic landscape, molten lava, skull motifs, monochrome with red accents, epic and ominous",
    "pop": "vibrant pastel gradient, modern minimalist, geometric shapes, bright and clean, editorial fashion",
    "jazz": "vintage smoky jazz club, warm amber tones, brass instruments silhouette, Art Deco style, film grain",
    "classical": "elegant dark marble, golden ornamental patterns, dramatic chiaroscuro lighting, renaissance oil painting style",
    "ambient": "cosmic nebula, soft ethereal light, floating particles, deep space, calming infinite depth",
    "soul": "warm golden sunset over city rooftop, soulful silhouette, rich earthy tones, warm film photography",
    "reggae": "tropical sunset, palm trees silhouette, warm orange and green, relaxed vibration, watercolor wash",
    "blues": "midnight blues club, single spotlight, moody indigo and deep blue, vintage vinyl aesthetic",
    "folk": "misty forest at dawn, acoustic warmth, earthy tones, hand-drawn illustration style, nature texture",
    "ai": "artificial neural network visualization, glowing nodes, digital matrix, futuristic purple and cyan",
  };

  let styleHint = "premium cinematic album cover";
  for (const [key, style] of Object.entries(genreStyle)) {
    if (g.includes(key)) { styleHint = style; break; }
  }

  return `Premium album cover art for track "${title}" by ${artist}. Style: ${styleHint}. Square format 1:1. Hyper-realistic or painterly, cinematic lighting, no text, no letters, no watermarks, ultra high quality.`;
}

// ─── xAI Aurora image generation ─────────────────────────────────────────────
async function generateWithXAI(prompt: string, xaiKey: string): Promise<Uint8Array | null> {
  console.log("[covers-xai] Generating with xAI Aurora:", prompt.slice(0, 80));

  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${xaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-2-image",
      prompt,
      n: 1,
      response_format: "url",
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[covers-xai] xAI error:", res.status, err);
    return null;
  }

  const data = await res.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) { console.error("[covers-xai] no image URL in response"); return null; }

  // Download the image
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!imgRes.ok) { console.error("[covers-xai] image download failed"); return null; }

  const buffer = await imgRes.arrayBuffer();
  return new Uint8Array(buffer);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) {
      return new Response(JSON.stringify({ error: "XAI_API_KEY not set in Supabase secrets" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit ?? 4, 10);

    // Pobierz najnowsze tracki bez okładki
    const { data: tracks, error: fetchErr } = await supabase
      .from("tracks")
      .select("id, title, artist, genre")
      .or("cover_url.is.null,cover_url.eq.")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fetchErr) throw fetchErr;
    if (!tracks || tracks.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Wszystkie nowe tracki mają już okładki ✅", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[covers-xai] Processing ${tracks.length} tracks`);

    const results: { id: string; title: string; status: string; url?: string }[] = [];

    for (const track of tracks) {
      console.log(`[covers-xai] → ${track.title} / ${track.artist}`);

      try {
        const prompt = buildPrompt(track.title, track.artist, track.genre);
        const imageBytes = await generateWithXAI(prompt, xaiKey);

        if (!imageBytes) {
          results.push({ id: track.id, title: track.title, status: "error: generation failed" });
          continue;
        }

        // Wgraj na R2
        const key = `covers/xai-${sanitize(track.title)}-${track.id.slice(0, 8)}.jpg`;
        const publicUrl = await uploadToR2(key, imageBytes, "image/jpeg");

        if (!publicUrl) {
          results.push({ id: track.id, title: track.title, status: "error: R2 upload failed" });
          continue;
        }

        // Aktualizuj cover_url w bazie
        const { error: updateErr } = await supabase
          .from("tracks")
          .update({ cover_url: publicUrl })
          .eq("id", track.id);

        if (updateErr) {
          results.push({ id: track.id, title: track.title, status: "error: DB update failed" });
          continue;
        }

        results.push({ id: track.id, title: track.title, status: "ok ✅", url: publicUrl });
        console.log(`[covers-xai] ✅ ${track.title} → ${publicUrl}`);

      } catch (err) {
        console.error(`[covers-xai] Error for ${track.title}:`, err);
        results.push({ id: track.id, title: track.title, status: `error: ${String(err)}` });
      }
    }

    const ok = results.filter(r => r.status.startsWith("ok")).length;
    return new Response(JSON.stringify({ success: true, processed: ok, total: tracks.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[covers-xai] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
