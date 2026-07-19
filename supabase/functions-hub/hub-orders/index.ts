// GROUAI HUB — hub-orders
// Panel admina B2B: lista zleceń + akcje (potwierdź zlecenie / potwierdź wpłatę).
//  GET  ?pin=XXX                         → { ok, orders:[...] }
//  POST { pin, action, order }           → wywołuje etap aurora-b2b-flow (server-side HMAC)
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function hmacKey(hubToken: string, role: string, orderId: string) {
  const data = new TextEncoder().encode(`${hubToken}:${role}:${orderId}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const r of cfgRows || []) cfg[r.key] = r.value ?? "";
  const hubToken = cfg["hub_token"] || "";
  const pinOk = (p: string) => cfg["pricing_pin"] && p === cfg["pricing_pin"];
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/aurora-b2b-flow`;

  const url = new URL(req.url);

  if (req.method === "GET") {
    if (!pinOk(url.searchParams.get("pin") || "")) return json({ ok: false, error: "Nieprawidłowy PIN" }, 403);
    const { data } = await db.from("hub_leads")
      .select("aurora_order_id, email, name, company, segment, status, brief, meta, created_at")
      .not("aurora_order_id", "is", null)
      .order("created_at", { ascending: false }).limit(100);
    const orders = (data || []).map((l: any) => {
      const m = l.meta || {};
      const stage = m.payment_confirmed_at ? "paid" : m.client_paid_reported_at ? "payment_reported"
        : m.offer_sent_at ? "offer_sent" : m.flow_started ? "confirmed" : "new";
      return {
        order_id: l.aurora_order_id, email: l.email, name: l.name, company: l.company,
        segment: l.segment, brief: String(l.brief || "").slice(0, 160),
        stage, offer_amount: m.offer_amount ?? null, invoice_no: m.invoice_no ?? null,
        created_at: l.created_at,
        offer_sent_at: m.offer_sent_at ?? null, client_paid_at: m.client_paid_reported_at ?? null,
        paid_at: m.payment_confirmed_at ?? null, files: m.files ?? null,
      };
    });
    return json({ ok: true, orders });
  }

  if (req.method === "POST") {
    let body: any;
    try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
    if (!pinOk(String(body?.pin ?? ""))) return json({ ok: false, error: "Nieprawidłowy PIN" }, 403);
    const order = String(body?.order ?? "");
    const action = String(body?.action ?? "");
    const amount = body?.amount;
    if (!order) return json({ ok: false, error: "order_required" }, 400);

    const kAdmin = await hmacKey(hubToken, "admin", order);
    let target = "";
    if (action === "confirm_order") {
      target = `${base}?stage=confirm_order&order=${encodeURIComponent(order)}&k=${kAdmin}`;
      if (amount && isFinite(Number(amount)) && Number(amount) > 0) target += `&amount=${Number(amount)}`;
    } else if (action === "confirm_payment") {
      target = `${base}?stage=confirm_payment&order=${encodeURIComponent(order)}&k=${kAdmin}`;
    } else {
      return json({ ok: false, error: "unknown_action" }, 400);
    }
    try {
      const r = await fetch(target, { method: "GET" });
      return json({ ok: r.ok, status: r.status });
    } catch (e) {
      return json({ ok: false, error: String(e).slice(0, 160) }, 502);
    }
  }

  return json({ ok: false, error: "method_not_allowed" }, 405);
});
