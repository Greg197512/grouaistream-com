/**
 * Zdrowie GrouAI Studio — bez generowania i bez kosztów:
 *  - Suno (suno-generate action=health): czy klucz ustawiony i ile kredytów zostało,
 *  - zapis na R2 (suno-generate action=r2test: mały plik tekstowy),
 *  - obecność funkcji silników (OPTIONS): acestep-generate, groua-music-engine, studio-prompt-engine, studio-stems, studio-video.
 *  - ceny „kawy” w Paddle (get-paddle-price, tylko odczyt).
 * GET /api/diag-studio
 */
import { json, supa } from "../src/lib/serverSupa";

export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  const s = supa();
  if (!s) return json({ error: "no_supabase_env" }, 500);
  const H = { apikey: s.key, authorization: `Bearer ${s.key}`, "content-type": "application/json" };
  const post = async (fn: string, body: unknown) => {
    try {
      const r = await fetch(`${s.url}/functions/v1/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      return { http: r.status, ...(await r.json().catch(() => ({}))) };
    } catch (e) { return { error: String(e).slice(0, 120) }; }
  };
  const exists = async (fn: string) => {
    try {
      const r = await fetch(`${s.url}/functions/v1/${fn}`, { method: "OPTIONS", headers: { apikey: s.key, origin: "https://grouaistream.com", "access-control-request-method": "POST" }, signal: AbortSignal.timeout(8000) });
      return r.status !== 404;
    } catch { return null; }
  };
  const engines = ["acestep-generate", "groua-music-engine", "studio-prompt-engine", "studio-stems", "studio-video", "ai-cover-generate"];
  const coffees = ["grouai_coffee_black", "grouai_coffee_latte", "grouai_coffee_irish"];
  const [suno, r2, ...rest] = await Promise.all([
    post("suno-generate", { action: "health" }), post("suno-generate", { action: "r2test" }),
    ...engines.map(exists),
    ...coffees.map((id) => post("get-paddle-price", { priceId: id, environment: "live" })),
  ]);
  const ex = rest.slice(0, engines.length);
  const paddle = Object.fromEntries(coffees.map((id, i) => {
    const r = rest[engines.length + i] as { http?: number; paddleId?: string; error?: string };
    return [id, r?.error ? `brak: ${r.error}` : r?.http === 200 ? "OK" : `HTTP ${r?.http}`];
  }));
  return json({ suno, r2, functions: Object.fromEntries(engines.map((e, i) => [e, ex[i]])), paddleCoffee: paddle });
}
