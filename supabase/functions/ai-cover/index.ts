import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function findOriginalCover(title: string, artist: string): Promise<string | null> {
  // 1. iTunes
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

  // 2. MusicBrainz + Cover Art Archive
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

  // 3. Deezer
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
  if (!LOVABLE_API_KEY) {
    console.log("LOVABLE_API_KEY not set, skipping AI cover generation");
    return null;
  }

  const genreStyle = genre ? ` in ${genre} music style` : "";
  const prompt = `Create a stunning, professional album cover art${genreStyle}. The artwork should be for a song called "${title}" by "${artist}". Make it cinematic, high-contrast, with rich colors and artistic composition. Modern music industry quality. No text or letters on the image. Abstract or semi-abstract artistic interpretation of the music mood. On a clean background.`;

  try {
    console.log(`Generating AI cover for "${title}" by ${artist}...`);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("AI image generation failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.log("No image in AI response");
      return null;
    }

    return imageUrl; // base64 data URL
  } catch (e) {
    console.error("AI cover generation error:", e);
    return null;
  }
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trackId } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!trackId) throw new Error("trackId is required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Skip if already has a real cover
    if (track.cover_url && !track.cover_url.includes("picsum.photos") && !track.cover_url.includes("placeholder")) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Already has cover" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Try finding original cover from music databases
    console.log(`Searching original cover for: "${track.title}" by ${track.artist}`);
    let coverUrl = await findOriginalCover(track.title, track.artist);
    let source = "original";

    // 2. If not found, generate AI cover
    if (!coverUrl) {
      console.log(`No original found, generating AI cover for "${track.title}"...`);
      const aiBase64 = await generateAICover(track.title, track.artist, track.genre);
      
      if (aiBase64) {
        // Upload base64 image to Supabase storage
        try {
          const base64Data = aiBase64.replace(/^data:image\/\w+;base64,/, "");
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          const filename = `covers/ai-${sanitizeFilename(track.artist)}-${sanitizeFilename(track.title)}-${Date.now()}.png`;
          
          const { error: uploadErr } = await supabase.storage
            .from("music")
            .upload(filename, binaryData, {
              contentType: "image/png",
              upsert: true,
            });

          if (!uploadErr) {
            const { data: publicUrl } = supabase.storage.from("music").getPublicUrl(filename);
            coverUrl = publicUrl.publicUrl;
            source = "ai-generated";
            console.log(`AI cover uploaded: ${coverUrl}`);
          } else {
            console.error("Upload error:", uploadErr);
          }
        } catch (e) {
          console.error("Failed to upload AI cover:", e);
        }
      }
    }

    if (!coverUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No cover found and AI generation failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update track with cover
    const { error: updateErr } = await supabase
      .from("tracks")
      .update({ cover_url: coverUrl })
      .eq("id", track.id);

    if (updateErr) throw updateErr;

    console.log(`Cover set for "${track.title}": ${source}`);

    return new Response(
      JSON.stringify({ success: true, cover_url: coverUrl, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Cover error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
