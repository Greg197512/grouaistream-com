import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDEXNOW_KEY = "afe06e072b8e4d01a107df5a4b0722ff";
const HOST = "grouaistream.com";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

const ALL_URLS = [
  `https://${HOST}/`,
  `https://${HOST}/search`,
  `https://${HOST}/library`,
  `https://${HOST}/radio`,
  `https://${HOST}/radio-live`,
  `https://${HOST}/upload`,
  `https://${HOST}/suno`,
  `https://${HOST}/movies`,
  `https://${HOST}/earn`,
  `https://${HOST}/server`,
  `https://${HOST}/liked`,
  `https://${HOST}/mood-history`,
  `https://${HOST}/my-tracks`,
  `https://${HOST}/local-player`,
  `https://${HOST}/album-creator`,
  `https://${HOST}/import-youtube`,
  `https://${HOST}/earnings`,
  `https://${HOST}/settings`,
  `https://${HOST}/auth`,
  `https://${HOST}/legal`,
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let urlsToPing = ALL_URLS;

    // Allow passing specific URLs in body
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.urls && Array.isArray(body.urls) && body.urls.length > 0) {
          urlsToPing = body.urls;
        }
      } catch {
        // Use default URLs
      }
    }

    const indexNowPayload = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList: urlsToPing,
    };

    // Ping all IndexNow endpoints + Google sitemap in parallel
    const [bingResponse, yandexResponse, naverResponse, googleResponse] = await Promise.all([
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(indexNowPayload),
      }),
      fetch("https://yandex.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(indexNowPayload),
      }),
      fetch("https://searchadvisor.naver.com/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(indexNowPayload),
      }),
      // Google Sitemap ping
      fetch(`https://www.google.com/ping?sitemap=https://${HOST}/sitemap.xml`),
    ]);

    const bingStatus = bingResponse.status;
    const bingText = await bingResponse.text().catch(() => "");

    const result = {
      success: bingStatus === 200 || bingStatus === 202,
      urls_submitted: urlsToPing.length,
      bing: { status: bingStatus, response: bingText },
      yandex: { status: yandexResponse.status },
      naver: { status: naverResponse.status },
      google_sitemap_ping: { status: googleResponse.status },
      timestamp: new Date().toISOString(),
    };

    console.log("IndexNow ping result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("IndexNow ping error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
