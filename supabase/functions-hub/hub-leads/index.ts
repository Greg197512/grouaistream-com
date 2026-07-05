// GROUAI HUB — hub-leads
// Podgląd leadów dla admina + eksport do Google Ads Customer Match.
// Auth: ?t=<hub_token>.
//   GET ?t=..                      → JSON: statystyki + 100 ostatnich leadów
//   GET ?t=..&format=csv           → CSV WSZYSTKICH leadów (wgląd)
//   GET ?t=..&format=customer_match → CSV pod Google Ads Customer Match
//                                     (tylko zgoda marketingowa; kolumna Email)
//   GET ?t=..&segment=b2b          → filtr segmentu
// Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value").eq("key", "hub_token");
  const hubToken = cfgRows?.[0]?.value || "";

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!hubToken || token !== hubToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const segment = url.searchParams.get("segment");
  const format = url.searchParams.get("format");

  let q = db.from("hub_leads").select("*").order("created_at", { ascending: false });
  if (segment) q = q.eq("segment", segment);
  const { data: leads } = await q.limit(format ? 5000 : 100);
  const rows = leads || [];

  // Eksport CSV pod Google Ads Customer Match (nagłówek zgodny z szablonem Google)
  if (format === "customer_match") {
    const consented = rows.filter((l: any) => l.consent_marketing === true && l.status !== "unsub");
    const lines = ["Email"];
    for (const l of consented) lines.push(String(l.email).trim().toLowerCase());
    return new Response(lines.join("\n"), {
      headers: { ...cors, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="groua-customer-match.csv"' },
    });
  }

  // Pełny eksport CSV (wgląd)
  if (format === "csv") {
    const cols = ["id", "created_at", "segment", "email", "name", "company", "status", "consent_marketing", "gclid", "utm_campaign", "utm_source", "aurora_order_id"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [cols.join(",")];
    for (const l of rows) lines.push(cols.map((c) => esc((l as any)[c])).join(","));
    return new Response(lines.join("\n"), {
      headers: { ...cors, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="groua-leads.csv"' },
    });
  }

  // JSON: statystyki + ostatnie leady
  const bySeg: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let consentedCount = 0, last24 = 0;
  const dayAgo = Date.now() - 86400_000;
  for (const l of rows) {
    bySeg[l.segment] = (bySeg[l.segment] || 0) + 1;
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    if (l.consent_marketing) consentedCount++;
    if (new Date(l.created_at).getTime() > dayAgo) last24++;
  }
  return new Response(JSON.stringify({
    ok: true,
    total_shown: rows.length,
    last_24h: last24,
    consented_for_remarketing: consentedCount,
    by_segment: bySeg,
    by_status: byStatus,
    exports: {
      wglad_csv: `?t=${token}&format=csv`,
      google_customer_match: `?t=${token}&format=customer_match`,
    },
    recent: rows.slice(0, 100).map((l: any) => ({
      id: l.id, at: l.created_at, segment: l.segment, email: l.email, name: l.name,
      company: l.company, status: l.status, campaign: l.utm_campaign, aurora_order: l.aurora_order_id,
    })),
  }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
