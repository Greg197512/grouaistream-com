// GROUAI HUB — hub-pricing
// Odczyt/zapis cen usług B2B (hub_config.price_<segment>). Czyta aurora-b2b-flow.
//  GET  → { services:[{key,label,price}], ok:true }   (publiczny — ceny nie są tajne)
//  POST { pin, prices:{segment:amount} } → zapis (weryfikacja hub_config.pricing_pin)
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SERVICES: { key: string; label: string; def: number }[] = [
  { key: "music_production", label: "Muzyka / audio", def: 99 },
  { key: "video_edit", label: "Montaż video", def: 149 },
  { key: "video_ad", label: "Reklama / klip video", def: 199 },
  { key: "graphic_design", label: "Grafika / branding", def: 99 },
  { key: "seo_audit", label: "Audyt SEO", def: 149 },
  { key: "seo_content", label: "SEO Content", def: 49 },
  { key: "landing_page", label: "Landing Page", def: 299 },
  { key: "social_post", label: "Social / TikTok / Reels", def: 19 },
  { key: "automation_flow", label: "Automatyzacja", def: 199 },
  { key: "lead_research", label: "Lead Research", def: 99 },
  { key: "other", label: "Inne (broker)", def: 99 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const r of cfgRows || []) cfg[r.key] = r.value ?? "";

  const build = () => SERVICES.map((s) => {
    const v = parseFloat(cfg["price_" + s.key] || "");
    return { key: s.key, label: s.label, price: isFinite(v) && v > 0 ? v : s.def, isDefault: !(isFinite(v) && v > 0) };
  });

  if (req.method === "GET") return json({ ok: true, services: build() });

  if (req.method === "POST") {
    let body: any;
    try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
    const pin = String(body?.pin ?? "");
    const savedPin = cfg["pricing_pin"] || "";
    if (!savedPin || pin !== savedPin) return json({ ok: false, error: "Nieprawidłowy PIN" }, 403);
    const prices = body?.prices ?? {};
    const valid = new Set(SERVICES.map((s) => s.key));
    let saved = 0;
    for (const [key, raw] of Object.entries(prices)) {
      if (!valid.has(key)) continue;
      const amount = Math.round(parseFloat(String(raw)) * 100) / 100;
      if (!isFinite(amount) || amount <= 0) continue;
      const { error } = await db.from("hub_config").upsert({ key: "price_" + key, value: String(amount) }, { onConflict: "key" });
      if (!error) saved++;
    }
    await db.from("hub_log").insert({ source: "hub-pricing", level: "info", message: `Zapisano ${saved} cen B2B`, data: {} });
    return json({ ok: true, saved, services: build() });
  }

  return json({ ok: false, error: "method_not_allowed" }, 405);
});
