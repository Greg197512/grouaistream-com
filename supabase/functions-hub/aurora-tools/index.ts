// GROUAI HUB — aurora-tools
// Skrzynka narzędziowa Aurory: REALNE integracje biznesowe (nie tylko AI).
//  - seo_scan:  prawdziwy skan strony klienta — title/meta/H1/alt/canonical/OG,
//               HTTPS, robots.txt, sitemap.xml + Google PageSpeed Insights (CWV).
//  - keywords:  podpowiedzi słów kluczowych z Google Suggest (realne zapytania ludzi).
// Woła to aurora-worker przy zleceniach SEO/landing — audyty powstają na PRAWDZIWYCH
// pomiarach strony klienta, a AI tylko je interpretuje.
//
// Wejście: POST { action: "seo_scan"|"keywords", url?, query?, lang? }
// Auth: x-hub-token / ?t= (usługa wewnętrzna). Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function normalizeUrl(raw: string): string | null {
  let u = String(raw ?? "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (!/\./.test(parsed.hostname) || /localhost|127\.|0\.0\.0\.0|\[|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname)) return null;
    return parsed.toString();
  } catch { return null; }
}

async function fetchText(url: string, ms: number): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AuroraBot/1.0; +https://grouaistream.com)" },
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text: text.slice(0, 400_000), finalUrl: r.url };
  } catch (e) {
    return { ok: false, status: 0, text: String(e).slice(0, 120), finalUrl: url };
  }
}

const strip = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => (tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i")) || [])[1] ?? null;

function analyzeHtml(html: string, finalUrl: string) {
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] ?? "");
  const metaTags = html.match(/<meta[^>]+>/gi) || [];
  let description: string | null = null, robotsMeta: string | null = null, ogTitle: string | null = null, ogImage: string | null = null, viewport: string | null = null;
  for (const m of metaTags) {
    const n = (attr(m, "name") || attr(m, "property") || "").toLowerCase();
    if (n === "description") description = attr(m, "content");
    if (n === "robots") robotsMeta = attr(m, "content");
    if (n === "og:title") ogTitle = attr(m, "content");
    if (n === "og:image") ogImage = attr(m, "content");
    if (n === "viewport") viewport = attr(m, "content");
  }
  const canonical = attr((html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]*>/i) || [""])[0], "href");
  const h1s = (html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || []).map((h) => strip(h)).filter(Boolean);
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  const imgs = html.match(/<img[^>]+>/gi) || [];
  const imgsNoAlt = imgs.filter((i) => !/alt\s*=\s*["'][^"']+["']/i.test(i)).length;
  const host = new URL(finalUrl).hostname;
  const hrefs = (html.match(/<a[^>]+href\s*=\s*["']([^"'#]+)["']/gi) || []).map((a) => attr(a, "href") || "");
  let internal = 0, external = 0;
  for (const h of hrefs) {
    if (/^https?:\/\//i.test(h)) { try { new URL(h).hostname === host ? internal++ : external++; } catch { /**/ } }
    else if (h.startsWith("/") || !h.includes(":")) internal++;
  }
  const wordCount = strip(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")).split(/\s+/).filter((w) => w.length > 1).length;
  const hasJsonLd = /application\/ld\+json/i.test(html);
  return {
    title, title_length: title.length,
    meta_description: description, meta_description_length: (description || "").length,
    robots_meta: robotsMeta, canonical, viewport,
    og: { title: ogTitle, image: ogImage },
    h1_count: h1s.length, h1: h1s.slice(0, 3), h2_count: h2Count,
    images: imgs.length, images_without_alt: imgsNoAlt,
    links: { internal, external }, word_count_approx: wordCount,
    structured_data_jsonld: hasJsonLd,
    issues: [
      !title && "BRAK <title>",
      title.length > 60 && "Title za długi (>60 znaków)",
      !description && "BRAK meta description",
      (description || "").length > 160 && "Meta description za długa (>160)",
      h1s.length === 0 && "BRAK H1",
      h1s.length > 1 && "Więcej niż jeden H1",
      imgsNoAlt > 0 && `${imgsNoAlt} obrazów bez ALT`,
      !canonical && "Brak canonical",
      !viewport && "Brak meta viewport (mobile!)",
      !hasJsonLd && "Brak danych strukturalnych JSON-LD",
    ].filter(Boolean),
  };
}

async function pageSpeed(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=seo`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!r.ok) return { error: `psi_${r.status}` };
    const d = await r.json();
    const cat = d?.lighthouseResult?.categories;
    const audits = d?.lighthouseResult?.audits;
    const ms = (k: string) => audits?.[k]?.displayValue ?? null;
    return {
      performance_score: cat?.performance?.score != null ? Math.round(cat.performance.score * 100) : null,
      seo_score: cat?.seo?.score != null ? Math.round(cat.seo.score * 100) : null,
      lcp: ms("largest-contentful-paint"), cls: ms("cumulative-layout-shift"),
      tbt: ms("total-blocking-time"), fcp: ms("first-contentful-paint"), speed_index: ms("speed-index"),
    };
  } catch (e) { return { error: String(e).slice(0, 100) }; }
}

async function googleSuggest(q: string, lang: string): Promise<string[]> {
  try {
    const r = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d?.[1]) ? d[1].map((x: unknown) => String(x)).slice(0, 10) : [];
  } catch { return []; }
}

async function keywordResearch(query: string, lang: string) {
  const base = query.trim().slice(0, 80);
  const variants = [base, `${base} cena`, `jak ${base}`, `${base} opinie`, `najlepszy ${base}`];
  const out: Record<string, string[]> = {};
  const results = await Promise.allSettled(variants.map((v) => googleSuggest(v, lang)));
  results.forEach((r, i) => { if (r.status === "fulfilled" && r.value.length) out[variants[i]] = r.value; });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value").eq("key", "hub_token");
  const hubToken = cfgRows?.[0]?.value ?? "";
  const token = new URL(req.url).searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!hubToken || token !== hubToken) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = String(body.action ?? "");
  const lang = String(body.lang ?? "pl").slice(0, 5);

  if (action === "keywords") {
    const q = String(body.query ?? "").trim();
    if (!q) return json({ error: "query required" }, 400);
    const suggestions = await keywordResearch(q, lang);
    return json({ ok: true, tool: "google_suggest", data: suggestions });
  }

  if (action === "seo_scan") {
    const url = normalizeUrl(body.url);
    if (!url) return json({ error: "invalid_url" }, 400);
    const origin = new URL(url).origin;

    const [pageRes, robotsRes, sitemapRes] = await Promise.all([
      fetchText(url, 20000),
      fetchText(`${origin}/robots.txt`, 8000),
      fetchText(`${origin}/sitemap.xml`, 8000),
    ]);

    const data: Record<string, unknown> = {
      url, final_url: pageRes.finalUrl, http_status: pageRes.status, https: pageRes.finalUrl.startsWith("https://"),
      reachable: pageRes.ok,
      robots_txt: robotsRes.ok ? { exists: true, has_sitemap_ref: /sitemap:/i.test(robotsRes.text), disallow_all: /disallow:\s*\/\s*$/im.test(robotsRes.text) } : { exists: false },
      sitemap_xml: sitemapRes.ok ? { exists: true, url_count_approx: (sitemapRes.text.match(/<loc>/g) || []).length } : { exists: false },
    };
    if (pageRes.ok) data.onpage = analyzeHtml(pageRes.text, pageRes.finalUrl);

    // PageSpeed + słowa kluczowe (z tytułu strony) równolegle
    const kwSeed = (data.onpage as any)?.title || new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    const [psi, kw] = await Promise.all([
      body.pagespeed === false ? Promise.resolve(null) : pageSpeed(url),
      body.keywords === false ? Promise.resolve({}) : keywordResearch(String(kwSeed).split(/[|–—-]/)[0].trim(), lang),
    ]);
    if (psi) data.pagespeed_mobile = psi;
    if (kw && Object.keys(kw).length) data.keyword_suggestions = kw;

    await db.from("hub_log").insert({
      source: "aurora-tools", level: "info",
      message: `SEO scan ${new URL(url).hostname} — status ${pageRes.status}, issues: ${((data.onpage as any)?.issues || []).length}`,
    });
    return json({ ok: true, tool: "seo_scan", data });
  }

  return json({ error: "unknown_action", actions: ["seo_scan", "keywords"] }, 400);
});
