import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all tracks without cover_url
    const { data: tracksWithoutCovers, error: fetchError } = await supabase
      .from("tracks")
      .select("id, title, artist, genre")
      .is("cover_url", null)
      .limit(100);

    if (fetchError) throw fetchError;

    const total = tracksWithoutCovers?.length || 0;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    console.log(`[batch-cover-generation] Starting batch: ${total} tracks without covers`);

    // Process each track with delay to avoid rate limiting
    for (const track of tracksWithoutCovers || []) {
      try {
        // Invoke ai-cover-generate for this track
        const { data: coverData, error: invokeError } = await supabase.functions.invoke(
          "ai-cover-generate",
          {
            body: {
              title: track.title,
              style: track.genre,
              description: "",
              mode: "auto",
            },
          }
        );

        if (invokeError) {
          console.error(`[batch-cover-generation] Error for track ${track.id}:`, invokeError);
          failed++;
        } else if (coverData?.cover_url) {
          // Update track with cover URL
          const { error: updateError } = await supabase
            .from("tracks")
            .update({ cover_url: coverData.cover_url })
            .eq("id", track.id);

          if (updateError) {
            console.error(`[batch-cover-generation] Update error for track ${track.id}:`, updateError);
            failed++;
          } else {
            console.log(`[batch-cover-generation] ✓ Track ${track.id}: ${track.title}`);
            succeeded++;
          }
        } else {
          console.warn(`[batch-cover-generation] No cover generated for track ${track.id}`);
          failed++;
        }

        processed++;

        // Small delay between requests to avoid overwhelming the API
        if (processed < total) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[batch-cover-generation] Exception for track ${track.id}:`, error);
        failed++;
        processed++;
      }
    }

    console.log(`[batch-cover-generation] Completed: ${succeeded}/${total} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total,
        processed,
        succeeded,
        failed,
        message: `Processed ${total} tracks: ${succeeded} with covers, ${failed} failed`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[batch-cover-generation] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
