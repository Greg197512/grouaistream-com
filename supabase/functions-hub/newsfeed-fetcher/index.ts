// GROUAI HUB — newsfeed-fetcher
// Zastępuje workflow n8n pobierający RSS. Cron woła tę funkcję co 2h:
// pobiera kanały RSS (muzyka + AI), deduplikuje, zapisuje do hub_news_items
// i (jeśli skonfigurowano bvstv_ingest_token) pcha świeże pozycje do
// brain-newsfeed-ingest na projekcie LIVE (Mózg GrouAI).
//
// Auth: ?t=<hub_token> lub x-hub-token. Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FEEDS: Array<{ name: string; url: string; importance: number }> = [
  { name: "Music Business Worldwide", url: "https://www.musicbusinessworldwide.com/feed/", importance: 6 },
  { name: "Pitchfork — News", url: "https://pitchfork.com/feed/feed-news/rss", importance: 5 },
  { name: "TechCrunch — AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", importance: 5 },
  { name: "Hacker News — front", url: "https://hnrss.org/frontpage", importance: 4 },
];

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? stripTags(m[1]) : "";
}

function parseRss(xml: string): Array<{ title: string; link: string; summary: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; summary: string; pubDate: string }> = [];
  const chunks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of chunks.slice(0, 25)) {
    const chunk = raw.split(/<\/item>/i)[0];
    const title = pick(chunk, "title");
    let link = pick(chunk, "link");
    if (!link) {
      const m = chunk.match(/<link[^>]*href="([^"]+)"/i);
      link = m ? m[1] : "";
    }
    const summary = pick(chunk, "description").slice(0, 500);
    const pubDate = pick(chunk, "pubDate");
    if (title && link) items.push({ title, link, summary, pubDate });
  }
  return items;
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  const maxAgeMs = 48 * 3600 * 1000;
  const fresh: Array<{ title: string; url: string; source_name: string; summary: string; importance: number }> = [];
  const feedStats: Record<string, { fetched: number; new: number; error?: string }> = {};

  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed.url, {
        headers: { "User-Agent": "GrouAI-Hub/1.0 (+https://grouaistream.com)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const xml = await r.text();
      const items = parseRss(xml);
      feedStats[feed.name] = { fetched: items.length, new: 0 };

      for (const item of items) {
        const age = item.pubDate ? Date.now() - new Date(item.pubDate).getTime() : 0;
        if (Number.isFinite(age) && age > maxAgeMs) continue;

        const hash = await sha256(item.link.toLowerCase().trim());
        const { data: seen } = await db.from("hub_news_seen").select("url_hash").eq("url_hash", hash).maybeSingle();
        if (seen) continue;

        await db.from("hub_news_seen").insert({ url_hash: hash, source: feed.name });
        await db.from("hub_news_items").insert({
          title: item.title.slice(0, 300),
          url: item.link,
          source: feed.name,
          summary: item.summary,
        });
        fresh.push({ title: item.title, url: item.link, source_name: feed.name, summary: item.summary, importance: feed.importance });
        feedStats[feed.name].new++;
      }
    } catch (e) {
      feedStats[feed.name] = { fetched: 0, new: 0, error: String(e).slice(0, 150) };
    }
  }

  // Push do Mózgu na LIVE (opcjonalny — wymaga tokenu ingest z panelu admina)
  let brainPush: any = { skipped: true, reason: "bvstv_ingest_token not set" };
  if (fresh.length > 0 && cfg["bvstv_ingest_token"]) {
    const liveUrl = cfg["bvstv_url"] || "https://bvstvawnigyczvofzhps.supabase.co";
    try {
      const r = await fetch(`${liveUrl}/functions/v1/brain-newsfeed-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ingest-token": cfg["bvstv_ingest_token"] },
        body: JSON.stringify({ items: fresh.slice(0, 50) }),
      });
      brainPush = { skipped: false, status: r.status, body: (await r.text()).slice(0, 300) };
    } catch (e) {
      brainPush = { skipped: false, error: String(e).slice(0, 200) };
    }
  }

  await db.from("hub_log").insert({
    source: "newsfeed-fetcher",
    level: "info",
    message: `RSS: ${fresh.length} nowych pozycji (${Object.entries(feedStats).map(([k, v]) => `${k}: +${v.new}${v.error ? " ERR" : ""}`).join("; ")})`,
    data: { feeds: feedStats, brain_push: brainPush },
  });

  return json({ ok: true, new_items: fresh.length, feeds: feedStats, brain_push: brainPush });
});
