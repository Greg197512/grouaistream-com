import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APIFY_BASE = "https://api.apify.com/v2";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RunRequest {
  mode: "google" | "website" | "tiktok" | "youtube";
  query: string;
  maxItems?: number;
}

function buildInput(mode: string, query: string, maxItems: number): [string, Record<string, unknown>] {
  switch (mode) {
    case "google":
      return [
        "apify/google-search-scraper",
        { queries: query, maxPagesPerQuery: 1, resultsPerPage: maxItems, countryCode: "pl", languageCode: "pl" },
      ];
    case "website":
      return [
        "apify/website-content-crawler",
        { startUrls: [{ url: query }], maxCrawlPages: 3, crawlerType: "cheerio" },
      ];
    case "tiktok":
      return [
        "clockworks/free-tiktok-scraper",
        { hashtags: [query.replace(/^#/, "")], resultsPerPage: maxItems, shouldDownloadVideos: false, shouldDownloadCovers: false },
      ];
    case "youtube":
      return [
        "streamers/youtube-scraper",
        { searchKeywords: query, maxResults: maxItems, type: "video" },
      ];
    default:
      throw new Error(`Nieznany tryb: ${mode}`);
  }
}

async function apifyFetch(path: string, token: string, init?: RequestInit) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${APIFY_BASE}${path}${sep}token=${token}`, init);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function waitForRun(runId: string, token: string): Promise<string> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const { data } = await apifyFetch(`/actor-runs/${runId}`, token);
    if (data.status === "SUCCEEDED") return data.defaultDatasetId;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status))
      throw new Error(`Apify run ${data.status}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Timeout — Apify Actor działał >2 min");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const token = Deno.env.get("APIFY_TOKEN");
    if (!token) throw new Error("Brak APIFY_TOKEN w sekretach Supabase");

    // Auth check
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body: RunRequest = await req.json();
    const { mode, query, maxItems = 10 } = body;
    if (!mode || !query) throw new Error("Brak mode lub query");

    const [actorId, input] = buildInput(mode, query, maxItems);

    // 1. Start actor run
    const startTime = Date.now();
    const { data: runData } = await apifyFetch(
      `/acts/${encodeURIComponent(actorId)}/runs`,
      token,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );
    const runId: string = runData.id;

    // 2. Wait for finish
    const datasetId = await waitForRun(runId, token);

    // 3. Fetch results
    const items = await apifyFetch(
      `/datasets/${datasetId}/items?limit=${maxItems}&clean=true`,
      token
    );

    // Normalize results
    let results: unknown[] = Array.isArray(items) ? items : [];
    if (mode === "google") {
      const flat: unknown[] = [];
      for (const item of results as Record<string, unknown>[]) {
        const organic = (item.organicResults as unknown[]) ?? [];
        flat.push(...organic);
      }
      results = flat.slice(0, maxItems);
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Save to DB
    await supabase.from("empire_research_jobs").insert({
      user_id: user.id,
      mode,
      query,
      status: "done",
      results,
      result_count: results.length,
      duration_seconds: duration,
      apify_run_id: runId,
    });

    return new Response(
      JSON.stringify({ ok: true, results, duration, runId }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
