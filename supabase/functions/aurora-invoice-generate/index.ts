// Aurora Invoice Generate — tworzy fakturę/rachunek (HTML→data-URL pdf print). Klient pobiera z UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { order_id, invoice_type = "invoice" } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const { data: order, error } = await supabase
      .from("aurora_business_orders").select("*").eq("id", order_id).single();
    if (error || !order) throw new Error("Order not found");

    // Don't duplicate
    const { data: existing } = await supabase
      .from("aurora_invoices").select("id, invoice_number")
      .eq("order_id", order_id).eq("invoice_type", invoice_type).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, invoice_id: existing.id, invoice_number: existing.invoice_number, existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get next number from sequence
    const { data: seqRow } = await supabase.rpc("nextval_invoice_seq").maybeSingle().catch(() => ({ data: null }));
    let nextN = (seqRow as any)?.nextval;
    if (!nextN) {
      // Fallback: count existing
      const { count } = await supabase.from("aurora_invoices").select("*", { count: "exact", head: true });
      nextN = 1000 + (count ?? 0) + 1;
    }
    const year = new Date().getFullYear();
    const invoiceNumber = `${invoice_type === "receipt" ? "PAR" : "FV"}/${year}/${String(nextN).padStart(5, "0")}`;

    const subtotal = Number(order.price_eur ?? order.budget_eur ?? 0);
    const vatRate = 23;
    const vatAmount = +(subtotal * vatRate / 100).toFixed(2);
    const total = +(subtotal + vatAmount).toFixed(2);

    const items = [{
      name: `${order.service_type} — ${order.brief?.slice(0, 80) ?? "Zlecenie"}`,
      qty: 1,
      unit_price: subtotal,
      total: subtotal,
    }];

    const { data: inv, error: invErr } = await supabase.from("aurora_invoices").insert({
      order_id,
      user_id: order.user_id,
      invoice_number: invoiceNumber,
      invoice_type,
      buyer_name: order.client_name ?? "Klient",
      buyer_company: order.client_company,
      buyer_email: order.client_email,
      seller_name: "GrouAI Stream",
      seller_tax_id: "PL0000000000",
      seller_address: "GrouAI Stream Sp. z o.o.",
      items,
      subtotal_eur: subtotal,
      vat_rate: vatRate,
      vat_amount_eur: vatAmount,
      total_eur: total,
      currency: "EUR",
      status: order.payment_status === "paid" ? "paid" : "issued",
      issued_at: new Date().toISOString(),
      paid_at: order.paid_at,
      due_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    }).select().single();

    if (invErr) throw invErr;

    return new Response(JSON.stringify({ ok: true, invoice_id: inv.id, invoice_number: invoiceNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
