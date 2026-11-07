/**
 * Cron Vercel co godzinę — „żywe algorytmy” zamiast agentów AI (Grok usunięty 5.11, zero kosztów).
 *  1) Strażnik strony (runGuardian): strona, baza, plik audio na R2; budzi uśpioną bazę.
 *  2) Puls serwisu: nowe utwory (24 h), łączna liczba utworów, wpisy bloga — liczone z bazy (anon, RLS).
 *  3) Alarm: gdy strażnik widzi awarię → e-mail do właściciela (SHOP_NOTIFY_EMAIL), najwyżej raz na 6 h.
 *  4) Puls bazy powiadomień czatu (PUSH_DB_URL, darmowy Supabase usypia po tygodniu bez ruchu).
 */
import { runGuardian } from "./site-guardian";
import { env, json, supa } from "../src/lib/serverSupa";
import { mailConfigFromEnv, sendMail } from "../src/lib/shopMail";

export const config = { runtime: "edge" };

async function count(path: string): Promise<number | null> {
  const s = supa();
  if (!s) return null;
  try {
    const r = await fetch(`${s.url}/rest/v1/${path}`, {
      method: "HEAD",
      headers: { apikey: s.key, authorization: `Bearer ${s.key}`, prefer: "count=exact", range: "0-0" },
      signal: AbortSignal.timeout(8000),
    });
    const m = (r.headers.get("content-range") || "").match(/\/(\d+)$/);
    return m ? Number(m[1]) : null;
  } catch { return null; }
}

export default async function handler(): Promise<Response> {
  const now = new Date();
  const guard = await runGuardian();
  const bad = guard.checks.filter((c) => !c.ok);

  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const [tracksTotal, tracks24h, blogPosts] = await Promise.all([
    count("tracks?select=id&audio_url=not.is.null"),
    count(`tracks?select=id&created_at=gte.${since}`),
    count("seo_blog_posts?select=id&is_published=eq.true"),
  ]);
  let pushDb: number | string | null = null;
  const pu = env("PUSH_DB_URL"), pk = env("PUSH_DB_KEY");
  if (pu && pk) {
    try {
      const r = await fetch(`${pu.replace(/\/+$/, "")}/rest/v1/rpc/chat_push_count`, {
        method: "POST", headers: { apikey: pk, authorization: `Bearer ${pk}`, "content-type": "application/json" },
        body: JSON.stringify({ p_secret: env("PUSH_DB_SECRET") ?? "" }), signal: AbortSignal.timeout(8000),
      });
      pushDb = r.ok ? Number(await r.text()) : `http ${r.status}`;
    } catch (e) { pushDb = String((e as Error).message).slice(0, 80); }
  }
  const pulse = { tracksTotal, tracks24h, blogPosts, pushDb };

  let alerted = false;
  const notify = env("SHOP_NOTIFY_EMAIL");
  const cfg = mailConfigFromEnv(env, "Strażnik GrouAI");
  if (bad.length && notify && cfg) {
    const slot = `${now.toISOString().slice(0, 10)}-${Math.floor(now.getUTCHours() / 6)}`; // raz na 6 h
    alerted = await sendMail(cfg, {
      to: notify, key: `guardian-${slot}`,
      subject: `🚨 GrouAI Stream: problem (${bad.map((c) => c.name).join(", ")})`,
      html: `<div style="font:15px/1.6 Arial,sans-serif;max-width:560px;margin:auto;padding:20px">
<h2 style="margin:0 0 8px">Strażnik wykrył problem</h2>
<ul>${bad.map((c) => `<li><b>${c.name}</b>: ${String(c.detail ?? "").replace(/</g, "&lt;").slice(0, 200)}</li>`).join("")}</ul>
<p>Naprawione automatycznie: ${guard.healed.length ? guard.healed.join(", ") : "nic"}.</p>
<p style="color:#71717a;font-size:12px">${now.toISOString()} · kolejny alarm najwcześniej za 6 h</p></div>`,
    });
  }

  return json({ ok: guard.ok, at: now.toISOString(), guardian: { bad, healed: guard.healed }, pulse, alerted, agents: "usunięte (żywe algorytmy, bez AI)" });
}
