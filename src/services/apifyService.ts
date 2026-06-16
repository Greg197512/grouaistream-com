import { ApifyClient } from "apify-client";

export type ApifyActorId =
  | "apify/google-search-scraper"
  | "apify/website-content-crawler"
  | "clockworks/free-tiktok-scraper"
  | "streamers/youtube-scraper";

export interface ApifyRunOptions {
  actorId: ApifyActorId;
  input: Record<string, unknown>;
  maxItems?: number;
}

export interface ResearchResult {
  title: string;
  url: string;
  text: string;
  source: string;
  scrapedAt: string;
}

export interface GoogleSearchResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

export interface TikTokResult {
  text: string;
  authorMeta: { name: string; fans: number };
  diggCount: number;
  playCount: number;
  shareCount: number;
  webVideoUrl: string;
}

export interface YouTubeResult {
  title: string;
  url: string;
  viewCount: number;
  likeCount: number;
  channelName: string;
  description: string;
  publishedAt: string;
}

function getClient(): ApifyClient {
  const token = import.meta.env.VITE_APIFY_TOKEN;
  if (!token) throw new Error("Brak VITE_APIFY_TOKEN w zmiennych środowiskowych");
  return new ApifyClient({ token });
}

export async function runGoogleSearch(
  query: string,
  maxResults = 10
): Promise<GoogleSearchResult[]> {
  const client = getClient();
  const run = await client.actor("apify/google-search-scraper").call({
    queries: query,
    maxPagesPerQuery: 1,
    resultsPerPage: maxResults,
    countryCode: "pl",
    languageCode: "pl",
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const results: GoogleSearchResult[] = [];
  for (const item of items as Record<string, unknown>[]) {
    const organicResults = (item.organicResults as Record<string, unknown>[]) ?? [];
    for (const r of organicResults) {
      results.push({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        description: String(r.description ?? ""),
        position: Number(r.position ?? 0),
      });
    }
  }
  return results.slice(0, maxResults);
}

export async function scrapeWebsite(url: string): Promise<ResearchResult[]> {
  const client = getClient();
  const run = await client.actor("apify/website-content-crawler").call({
    startUrls: [{ url }],
    maxCrawlPages: 3,
    crawlerType: "cheerio",
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return (items as Record<string, unknown>[]).map((item) => ({
    title: String(item.title ?? "Bez tytułu"),
    url: String(item.url ?? url),
    text: String(item.text ?? "").slice(0, 2000),
    source: "website",
    scrapedAt: new Date().toISOString(),
  }));
}

export async function scrapeTikTok(
  hashtag: string,
  maxItems = 10
): Promise<TikTokResult[]> {
  const client = getClient();
  const run = await client.actor("clockworks/free-tiktok-scraper").call({
    hashtags: [hashtag],
    resultsPerPage: maxItems,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return (items as TikTokResult[]).slice(0, maxItems);
}

export async function scrapeYouTube(
  query: string,
  maxItems = 10
): Promise<YouTubeResult[]> {
  const client = getClient();
  const run = await client.actor("streamers/youtube-scraper").call({
    searchKeywords: query,
    maxResults: maxItems,
    type: "video",
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return (items as YouTubeResult[]).slice(0, maxItems);
}

export async function runCustomActor(
  opts: ApifyRunOptions
): Promise<Record<string, unknown>[]> {
  const client = getClient();
  const run = await client.actor(opts.actorId).call(opts.input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return (items as Record<string, unknown>[]).slice(
    0,
    opts.maxItems ?? 20
  );
}
