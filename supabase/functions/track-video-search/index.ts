// Track YouTube Music Video Search — finds AI/official music videos for tracks
// Modes: single (by trackId) or batch (fill missing video_url on tracks)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchYouTube(query: string): Promise<{ videoId: string; title: string } | null> {
  try {
    const response = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "pl", gl: "PL" } },
        query,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    if (!contents) return null;
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents;
      if (!items) continue;
      for (const item of items) {
        const video = item?.videoRenderer;
        if (video?.videoId) {
          return {
            videoId: video.videoId,
            title: video.title?.runs?.[0]?.text || query,
          };
        }
      }
    }
    return null;
  } catch (e) {
    console.error("YT scrape error:", e);
    return null;
  }
}

function buildQuery(title: string, artist?: string | null) {
  // Bias to AI-generated music videos (Suno / AI visualizer style)
  const parts = [artist, title].filter(Boolean).join(" ");
  return `${parts} AI music video suno visualizer`;
}

async function findForTrack(track: { id: string; title: string; artist?: string | null }) {
  const base = [track.artist, track.title].filter(Boolean).join(" ");
  const queries = [
    `${base} AI music video suno visualizer`,
    `${base} AI generated music video`,
    `${base} AI visualizer 4k`,
    `${base} music video`,
  ];
  for (const q of queries) {
    const res = await searchYouTube(q);
    if (res) return res;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "single";

    if (mode === "single") {
      const { trackId, title, artist } = body;
      if (!trackId || !title) {
        return new Response(JSON.stringify({ success: false, error: "trackId and title required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const yt = await findForTrack({ id: trackId, title, artist });
      if (!yt) {
        return new Response(JSON.stringify({ success: false, error: "not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const videoUrl = `https://www.youtube.com/watch?v=${yt.videoId}`;
      const coverUrl = `https://img.youtube.com/vi/${yt.videoId}/hqdefault.jpg`;
      await supabase.from("tracks").update({ video_url: videoUrl, cover_url: coverUrl }).eq("id", trackId);
      return new Response(
        JSON.stringify({ success: true, videoUrl, coverUrl, videoId: yt.videoId, youtubeTitle: yt.title }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // batch mode — fill first N tracks that have no video_url
    const batchSize = Math.min(Number(body.batchSize) || 15, 30);
    const sunoOnly = body.sunoOnly !== false; // default true
    let q = supabase
      .from("tracks")
      .select("id, title, artist")
      .is("video_url", null);
    if (sunoOnly) q = q.ilike("audio_url", "%suno%");
    const { data: tracks } = await q
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, total: 0, message: "All tracks have videos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let updated = 0;
    for (const t of tracks) {
      const yt = await findForTrack(t as any);
      if (!yt) continue;
      const videoUrl = `https://www.youtube.com/watch?v=${yt.videoId}`;
      const coverUrl = `https://img.youtube.com/vi/${yt.videoId}/hqdefault.jpg`;
      const { error } = await supabase
        .from("tracks")
        .update({ video_url: videoUrl, cover_url: coverUrl })
        .eq("id", t.id);
      if (!error) updated++;
      // gentle throttle
      await new Promise((r) => setTimeout(r, 250));
    }

    return new Response(
      JSON.stringify({ success: true, updated, total: tracks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("track-video-search error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
