/**
 * Diagnostyka: które funkcje Supabase (główny projekt), wołane przez aplikację, istnieją.
 * Wysyła tylko OPTIONS (preflight CORS) — nie uruchamia logiki ani płatnych usług.
 * GET /api/diag-functions → { found: [...], missing: [...] }
 */
import { json, supa } from "../src/lib/serverSupa";

export const config = { runtime: "edge" };

const NAMES = "og-proxy,seo-sitemap-generate,send-transactional-email,handle-email-unsubscribe,ad-campaign-submit,ad-lead-lookup,ai-builder-stats,ai-categorize,ai-cover,ai-cover-generate,ai-learn,ai-moderate-track,ai-mood-analysis,ai-music-shrink,ai-playlist,ai-psychologist,ai-suggest-tracks,ai-vision-mood,aurora-ai-dialogue,aurora-approve-action,aurora-auto-learn,aurora-autopilot,aurora-business-intake,aurora-change-negotiate,aurora-invoice-generate,aurora-iq-tick,aurora-launch-niche,aurora-niche-scanner,aurora-plan-generate,aurora-r2-signed-download,aurora-revenue-loop,aurora-storage-offer-create,aurora-storage-usage-report,aurora-web-learn,aurora-workforce-dispatch,batch-fill-covers,blog-translate,break-even-alert,bulk-audio-features,bulk-populate,bulk-populate-movies,cover-search,cover-video-generate,customer-portal,empire-apify-research,empire-aurora-chat,generate-weekend-challenge,get-paddle-price,groua-music-engine,groua-soul,handle-email-unsubscribe,monthly-cost-report,movie-youtube-search,newsletter-subscribe-notify,notify-blog-subscribers,redeem-code,seo-blog-generate-hooks,seo-bot,seo-orchestrator,soul-dream,soul-world-ingest,studio-prompt-engine,studio-stems,studio-video,suno-generate,suno-resolve,tiktok-reel-generate,tiktok-story-generate,track-video-search,youtube-download".split(",");

export default async function handler(): Promise<Response> {
  const s = supa();
  if (!s) return json({ error: "no_supabase_env" }, 500);
  const res = await Promise.all(NAMES.map(async (n) => {
    try {
      const r = await fetch(`${s.url}/functions/v1/${n}`, { method: "OPTIONS", headers: { apikey: s.key, origin: "https://grouaistream.com", "access-control-request-method": "POST" }, signal: AbortSignal.timeout(8000) });
      const t = r.status === 404 ? await r.text() : "";
      return { n, status: r.status, missing: r.status === 404 && /not.?found/i.test(t) };
    } catch (e) { return { n, status: 0, missing: false, err: String(e).slice(0, 60) }; }
  }));
  return json({ checked: NAMES.length, missing: res.filter((x) => x.missing).map((x) => x.n), odd: res.filter((x) => !x.missing && (x.status >= 400 || x.status === 0)) });
}
