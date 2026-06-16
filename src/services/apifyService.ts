const APIFY_BASE = "https://api.apify.com/v2";

function token(): string {
  const t = import.meta.env.VITE_APIFY_TOKEN as string | undefined;
  if (!t) throw new Error("Brak VITE_APIFY_TOKEN — wklej token w panelu Research Agent");
  return t;
}

async function runActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<string> {
  const res = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify Actor error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const { data } = await res.json();
  return data.id as string;
}

async function waitForRun(runId: string, timeoutMs = 120_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token()}`
    );
    const { data } = await res.json();
    if (data.status === "SUCCEEDED") return data.defaultDatasetId as string;
    if (data.status === "FAILED" || data.status === "ABORTED")
      throw new Error(`Run zakończony ze statusem: ${data.status}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Timeout — Actor działał zbyt długo (>2 min)");
}

async function fetchDataset<T>(datasetId: string, limit = 20): Promise<T[]> {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token()}&limit=${limit}&clean=true`
  );
  if (!res.ok) throw new Error(`Dataset fetch error ${res.status}`);
  return res.json();
}

async function runAndFetch<T>(
  actorId: string,
  input: Record<string, unknown>,
  limit = 20
): Promise<T[]> {
  const runId = await runActor(actorId, input);
  const datasetId = await waitForRun(runId);
  return fetchDataset<T>(datasetId, limit);
}

export interface GoogleSearchResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

export interface ResearchResult {
  title: string;
  url: string;
  text: string;
  source: string;
  scrapedAt: string;
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

export async function runGoogleSearch(
  query: string,
  maxResults = 10
): Promise<GoogleSearchResult[]> {
  type Raw = { organicResults?: GoogleSearchResult[] };
  const items = await runAndFetch<Raw>(
    "apify/google-search-scraper",
    { queries: query, maxPagesPerQuery: 1, resultsPerPage: maxResults, countryCode: "pl", languageCode: "pl" },
    1
  );
  const results: GoogleSearchResult[] = [];
  for (const item of items) {
    for (const r of item.organicResults ?? []) results.push(r);
  }
  return results.slice(0, maxResults);
}

export async function scrapeWebsite(url: string): Promise<ResearchResult[]> {
  type Raw = { title?: string; url?: string; text?: string };
  const items = await runAndFetch<Raw>(
    "apify/website-content-crawler",
    { startUrls: [{ url }], maxCrawlPages: 3, crawlerType: "cheerio" },
    3
  );
  return items.map((i) => ({
    title: i.title ?? "Bez tytułu",
    url: i.url ?? url,
    text: (i.text ?? "").slice(0, 2000),
    source: "website",
    scrapedAt: new Date().toISOString(),
  }));
}

export async function scrapeTikTok(
  hashtag: string,
  maxItems = 10
): Promise<TikTokResult[]> {
  return runAndFetch<TikTokResult>(
    "clockworks/free-tiktok-scraper",
    { hashtags: [hashtag], resultsPerPage: maxItems, shouldDownloadVideos: false, shouldDownloadCovers: false },
    maxItems
  );
}

export async function scrapeYouTube(
  query: string,
  maxItems = 10
): Promise<YouTubeResult[]> {
  return runAndFetch<YouTubeResult>(
    "streamers/youtube-scraper",
    { searchKeywords: query, maxResults: maxItems, type: "video" },
    maxItems
  );
}
