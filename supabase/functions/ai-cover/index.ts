import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.600.0";

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function getCorsHeaders(req: Request) {
  const allowedOrigins = [
    "https://grouaistream-com.lovable.app",
    "https://id-preview--462bddcb-d545-4f42-bc51-5f437cb12bbe.lovable.app",
  ];
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const R2_PUBLIC_BASE = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";

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
  if (!client || !bucket) {
    console.error("R2 not configured");
    return null;
  }
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));
  return `${R2_PUBLIC_BASE}/${key}`;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function findOriginalCover(title: string, artist: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=5`);
    if (itunesRes.ok) {
      const data = await itunesRes.json();
      if (data.results?.length > 0) {
        const artwork = data.results[0].artworkUrl100;
        if (artwork) return artwork.replace("100x100bb", "3000x3000bb");
      }
    }
  } catch (e) { console.log("iTunes search failed:", e); }

  try {
    const query = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const mbRes = await fetch(`https://musicbrainz.org/ws/2/recording?query=${query}&limit=3&fmt=json`, {
      headers: { "User-Agent": "GrooveAI/1.0 (music-app)" }
    });
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      for (const recording of mbData.recordings || []) {
        for (const release of recording.releases || []) {
          if (release.id) {
            try {
              const coverRes = await fetch(`https://coverartarchive.org/release/${release.id}`, { redirect: "follow" });
              if (coverRes.ok) {
                const coverData = await coverRes.json();
                const front = coverData.images?.find((img: any) => img.front);
                if (front) return front.image || front.thumbnails?.["1200"] || front.thumbnails?.large;
              }
            } catch { /* skip */ }
          }
        }
      }
    }
  } catch (e) { console.log("MusicBrainz search failed:", e); }

  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const deezerRes = await fetch(`https://api.deezer.com/search?q=${query}&limit=3`);
    if (deezerRes.ok) {
      const data = await deezerRes.json();
      if (data.data?.length > 0) {
        const albumCover = data.data[0].album?.cover_xl || data.data[0].album?.cover_big;
        if (albumCover) return albumCover.replace("/1000x1000", "/1800x1800").replace("/500x500", "/1800x1800");
      }
    }
  } catch (e) { console.log("Deezer search failed:", e); }

  return null;
}

async function generateAICover(title: string, artist: string, genre: string | null): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const genreStyle = genre ? ` The music style is ${genre}.` : "";
  const prompt = `Create a breathtaking, photographic-quality album cover art for a song called "${title}" by "${artist}".${genreStyle} The image must look like a professional photograph or cinematic movie still — NOT cartoon, NOT illustration, NOT abstract art. Think: Hasselblad camera quality, dramatic natural or studio lighting, rich vivid colors, shallow depth of field with beautiful bokeh. The scene should emotionally represent the mood and theme of the song title. Ultra-realistic, high-resolution, award-winning photography style. No text, no letters, no words, no logos on the image. On a clean background.`;

  const attempts = [
    { model: "google/gemini-3.1-flash-image-preview", timeoutMs: 90000 },
    { model: "google/gemini-2.5-flash-image", timeoutMs: 45000 },
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      }, attempt.timeoutMs);

      if (!response.ok) {
        console.error("AI cover generation failed:", attempt.model, response.status, await response.text());
        continue;
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl) return imageUrl;
    } catch (e) {
      console.error("AI cover generation error:", attempt.model, e);
    }
  }

  return null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { trackId, allow_ai_fallback, source: callSource } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Authentication: trigger calls use anon key + source flag, user calls validate JWT ---
    const isTriggerCall = callSource === "auto_trigger";

    if (!isTriggerCall) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // --- End authentication ---

    if (!trackId) throw new Error("trackId is required");

    // For user calls, AI is allowed by default; for trigger calls, only if flag is true
    const aiAllowed = isTriggerCall ? !!allow_ai_fallback : true;

    const supabase = createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY);

    const { data: track, error: fetchError } = await supabase
      .from("tracks")
      .select("id, title, artist, genre, cover_url")
      .eq("id", trackId)
      .single();

    if (fetchError || !track) {
      return new Response(
        JSON.stringify({ success: false, error: "Track not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (track.cover_url && !track.cover_url.includes("picsum.photos") && !track.cover_url.includes("placeholder")) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Already has cover" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let coverUrl = await findOriginalCover(track.title, track.artist);
    let source = "original";

    if (!coverUrl && aiAllowed) {
      const aiBase64 = await generateAICover(track.title, track.artist, track.genre);
      
      if (aiBase64) {
        try {
          const base64Data = aiBase64.replace(/^data:image\/\w+;base64,/, "");
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const key = `covers/ai-${sanitizeFilename(track.artist)}-${sanitizeFilename(track.title)}-${Date.now()}.png`;
          const r2Url = await uploadToR2(key, binaryData, "image/png");
          if (r2Url) {
            coverUrl = r2Url;
            source = "ai-generated";
          }
        } catch (e) {
          console.error("Failed to upload AI cover to R2:", e);
        }
      }
    }

    // Gradient placeholder fallback (free users, or AI failed)
    if (!coverUrl) {
      const seed = encodeURIComponent(`${track.artist}-${track.title}-${track.id}`);
      coverUrl = `https://picsum.photos/seed/${seed}/600/600`;
      source = "placeholder";
    }

    const { error: updateErr } = await supabase
      .from("tracks")
      .update({ cover_url: coverUrl })
      .eq("id", track.id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, cover_url: coverUrl, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Cover error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
