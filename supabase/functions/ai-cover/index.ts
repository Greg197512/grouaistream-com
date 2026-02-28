import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trackId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!trackId) throw new Error("trackId is required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the track
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

    // Skip if already has cover
    if (track.cover_url && !track.cover_url.includes("picsum.photos")) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Already has cover" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate cover image using AI
    const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{
          role: "user",
          content: `Create a beautiful square album cover art for a ${track.genre || "music"} song titled "${track.title}" by ${track.artist}. Style: modern, artistic, vibrant colors, professional album art. No text on the image.`
        }],
        modalities: ["image", "text"],
      }),
    });

    if (!imgResponse.ok) {
      if (imgResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (imgResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI image generation failed: ${imgResponse.status}`);
    }

    const imgData = await imgResponse.json();
    const imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload base64 image to storage
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const imagePath = `covers/${track.id}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("music")
      .upload(imagePath, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage.from("music").getPublicUrl(imagePath);

    // Update track with cover URL
    const { error: updateErr } = await supabase
      .from("tracks")
      .update({ cover_url: urlData.publicUrl })
      .eq("id", track.id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, cover_url: urlData.publicUrl }),
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
