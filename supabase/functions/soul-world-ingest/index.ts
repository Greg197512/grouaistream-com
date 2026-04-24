// 🌍 Soul World Ingest — Aurora pobiera wiedzę z otwartego świata.
// Bez kluczy zewnętrznych (oprócz YouTube który już mamy opcjonalnie).
// Źródła: Wikipedia REST, MusicBrainz, iTunes RSS, YouTube trending, Reddit JSON.
// Cron: co 1h.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { semanticEmbed } from "../_shared/semanticEmbed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "GrouAIStream-Aurora/1.0 (admin@grouaistream.com)";
const MAX_ITEMS_PER_SOURCE = 8;

interface RawItem {
  title: string;
  content: string;
  summary?: string;
  source_url?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

async function fetchWikipediaOTD(): Promise<RawItem[]> {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    const events: any[] = (j.events ?? []).slice(0, MAX_ITEMS_PER_SOURCE);
    return events
      .filter((e) => /music|song|album|band|composer|musician|opera|symphony/i.test(e.text ?? ""))
      .map((e) => ({
        title: `${e.year}: ${e.text?.slice(0, 120)}`,
        content: e.text ?? "",
        summary: e.text?.slice(0, 250),
        source_url: e.pages?.[0]?.content_urls?.desktop?.page,
        language: "en",
        metadata: { year: e.year, kind: "on_this_day" },
      }));
  } catch (e) {
    console.error("[wikipedia-otd]", e);
    return [];
  }
}

async function fetchMusicBrainzReleases(): Promise<RawItem[]> {
  const url = "https://musicbrainz.org/ws/2/release/?query=date:[NOW-14DAYS%20TO%20NOW]&fmt=json&limit=15";
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    const releases: any[] = (j.releases ?? []).slice(0, MAX_ITEMS_PER_SOURCE);
    return releases.map((rel) => ({
      title: `${rel["artist-credit"]?.[0]?.name ?? "?"} — ${rel.title ?? ""}`,
      content: `Release: ${rel.title}. Artist: ${rel["artist-credit"]?.[0]?.name}. Date: ${rel.date}. Country: ${rel.country ?? "?"}. Status: ${rel.status ?? "?"}.`,
      summary: `Nowy release: ${rel.title} przez ${rel["artist-credit"]?.[0]?.name}`,
      source_url: `https://musicbrainz.org/release/${rel.id}`,
      metadata: { mbid: rel.id, country: rel.country, kind: "release" },
    }));
  } catch (e) {
    console.error("[musicbrainz]", e);
    return [];
  }
}

async function fetchITunesTop(country: "pl" | "us"): Promise<RawItem[]> {
  const url = `https://itunes.apple.com/${country}/rss/topsongs/limit=15/json`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    const entries: any[] = (j.feed?.entry ?? []).slice(0, MAX_ITEMS_PER_SOURCE);
    return entries.map((e, i) => ({
      title: `iTunes ${country.toUpperCase()} #${i + 1}: ${e["im:name"]?.label} — ${e["im:artist"]?.label}`,
      content: `Pozycja #${i + 1} w iTunes ${country.toUpperCase()}. Utwór: "${e["im:name"]?.label}" wykonawca: ${e["im:artist"]?.label}. Album: ${e["im:collection"]?.["im:name"]?.label ?? "?"}.`,
      summary: `${e["im:name"]?.label} — ${e["im:artist"]?.label} (#${i + 1} ${country.toUpperCase()})`,
      source_url: e.link?.[0]?.attributes?.href,
      language: country,
      metadata: { country, rank: i + 1, kind: "chart" },
    }));
  } catch (e) {
    console.error("[itunes]", e);
    return [];
  }
}

async function fetchRedditTop(subreddit: string): Promise<RawItem[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=15`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    const posts: any[] = (j.data?.children ?? []).slice(0, MAX_ITEMS_PER_SOURCE);
    return posts.map((p) => {
      const d = p.data;
      return {
        title: `r/${subreddit}: ${d.title?.slice(0, 140)}`,
        content: `${d.title}\n\n${(d.selftext ?? "").slice(0, 800)}\nUpvotes: ${d.ups}, comments: ${d.num_comments}`,
        summary: d.title,
        source_url: `https://reddit.com${d.permalink}`,
        metadata: { subreddit, ups: d.ups, comments: d.num_comments, kind: "discussion" },
      };
    });
  } catch (e) {
    console.error("[reddit]", subreddit, e);
    return [];
  }
}

async function fetchYouTubeTrendingMusic(): Promise<RawItem[]> {
  const ytKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!ytKey) return [];
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&regionCode=PL&maxResults=15&key=${ytKey}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    const items: any[] = (j.items ?? []).slice(0, MAX_ITEMS_PER_SOURCE);
    return items.map((it) => ({
      title: `YT-PL trending: ${it.snippet.title?.slice(0, 140)}`,
      content: `${it.snippet.title}\nKanał: ${it.snippet.channelTitle}\nWyświetlenia: ${it.statistics?.viewCount}, lajki: ${it.statistics?.likeCount}\n${(it.snippet.description ?? "").slice(0, 400)}`,
      summary: `${it.snippet.title} — ${it.snippet.channelTitle}`,
      source_url: `https://youtube.com/watch?v=${it.id}`,
      language: "pl",
      metadata: { videoId: it.id, channel: it.snippet.channelTitle, views: it.statistics?.viewCount, kind: "video_trending" },
    }));
  } catch (e) {
    console.error("[youtube]", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const result = { ingested: 0, sources: {} as Record<string, number>, elapsed_ms: 0 };
  const start = Date.now();

  const tasks: Array<[string, Promise<RawItem[]>]> = [
    ["wikipedia_otd", fetchWikipediaOTD()],
    ["musicbrainz", fetchMusicBrainzReleases()],
    ["itunes_pl", fetchITunesTop("pl")],
    ["itunes_us", fetchITunesTop("us")],
    ["reddit_wearemusic", fetchRedditTop("WeAreTheMusicMakers")],
    ["reddit_electronic", fetchRedditTop("electronicmusic")],
    ["reddit_popheads", fetchRedditTop("popheads")],
    ["youtube_pl", fetchYouTubeTrendingMusic()],
  ];

  const settled = await Promise.allSettled(tasks.map(([_, p]) => p));

  for (let i = 0; i < settled.length; i++) {
    const [sourceName, _] = tasks[i];
    const r = settled[i];
    if (r.status !== "fulfilled") continue;
    const items = r.value;
    result.sources[sourceName] = items.length;

    for (const item of items) {
      // dedup by url+title
      if (item.source_url) {
        const { data: existing } = await supabase
          .from("soul_world_knowledge")
          .select("id")
          .eq("source_url", item.source_url)
          .maybeSingle();
        if (existing) continue;
      }

      const embedText = `${item.title}\n${item.summary ?? ""}\n${item.content.slice(0, 800)}`;
      const embedding = await semanticEmbed(embedText, LOVABLE_API_KEY).catch(() => null);

      const { error } = await supabase.from("soul_world_knowledge").insert({
        source: sourceName,
        source_type: sourceName.split("_")[0],
        source_url: item.source_url ?? null,
        title: item.title.slice(0, 300),
        content: item.content.slice(0, 4000),
        summary: item.summary?.slice(0, 500) ?? null,
        language: item.language ?? "en",
        importance: 5,
        embedding,
        metadata: item.metadata ?? {},
        expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
      });

      if (!error) result.ingested++;
    }
  }

  result.elapsed_ms = Date.now() - start;
  return new Response(JSON.stringify({ success: true, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
