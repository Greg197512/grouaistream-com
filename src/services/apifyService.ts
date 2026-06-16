import { supabase } from "@/integrations/supabase/client";

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

type ResearchMode = "google" | "website" | "tiktok" | "youtube";

async function callEdgeFunction<T>(
  mode: ResearchMode,
  query: string,
  maxItems = 10
): Promise<{ results: T[]; duration: number }> {
  const { data, error } = await supabase.functions.invoke("empire-apify-research", {
    body: { mode, query, maxItems },
  });

  if (error) throw new Error(error.message ?? "Edge Function error");
  if (!data?.ok) throw new Error(data?.error ?? "Apify request failed");

  return { results: data.results as T[], duration: data.duration as number };
}

export async function runGoogleSearch(
  query: string,
  maxItems = 10
): Promise<GoogleSearchResult[]> {
  const { results } = await callEdgeFunction<GoogleSearchResult>("google", query, maxItems);
  return results;
}

export async function scrapeWebsite(url: string): Promise<ResearchResult[]> {
  const { results } = await callEdgeFunction<ResearchResult>("website", url, 3);
  return results;
}

export async function scrapeTikTok(
  hashtag: string,
  maxItems = 10
): Promise<TikTokResult[]> {
  const { results } = await callEdgeFunction<TikTokResult>("tiktok", hashtag, maxItems);
  return results;
}

export async function scrapeYouTube(
  query: string,
  maxItems = 10
): Promise<YouTubeResult[]> {
  const { results } = await callEdgeFunction<YouTubeResult>("youtube", query, maxItems);
  return results;
}
