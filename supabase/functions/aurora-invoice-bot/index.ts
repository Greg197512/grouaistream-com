// aurora-invoice-bot — automatyzacja faktur B2B
//
// Co robi:
//  1. Przyjmuje zdarzenie zamówienia/płatności (z Aurory, Paddle albo n8n).
//  2. Buduje fakturę: numer FV/RRRR/MM/NNN, VAT 23%, kwoty netto/VAT/brutto,
//     dane sprzedawcy + nabywcy, pozycje.
//  3. Renderuje fakturę jako HTML (gotowe do PDF przez n8n / przeglądarkę).
//  4. Publikuje podsumowanie na kanale Discord (embed).
//  5. Przekazuje pełny payload do n8n (dalsze kroki: PDF, e-mail, księgowość).
//  6. Zapisuje fakturę w tabeli `invoices` (log + numeracja).
//
// Sekrety (Supabase → Settings → Secrets):
//  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (są domyślnie)
//  - DISCORD_INVOICE_WEBHOOK_URL  (webhook kanału #faktury na Discordzie)
//  - N8N_INVOICE_WEBHOOK_URL      (opcjonalnie; fallback: N8N_WEBHOOK_URL)
//  - INVOICE_SELLER_JSON          (opcjonalnie; dane sprzedawcy w JSON)

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VAT_RATE = 0.23;

type InvoiceItem = { name: string; qty: number; unit_net: number };

const DEFAULT_SELLER = {
  name: "GrouAI Stream",
  address: "ul. Przykładowa 1, 00-001 Warszawa",
  nip: "0000000000",
  email: "kontakt@grouaistream.com",
  iban: "PL00 0000 0000 0000 0000 0000 0000",
};

function money(v: number, currency: string) {
  return `${v.toFixed(2)} ${currency}`;
}

function invoiceHtml(inv: any): string {
  const rows = inv.items
    .map(
      (it: InvoiceItem, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.name}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">${money(it.unit_net, inv.currency)}</td>
        <td style="text-align:right">${money(it.qty * it.unit_net, inv.currency)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 24px}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:#666;font-size:13px}
  .grid{display:flex;justify-content:space-between;gap:24px;margin:20px 0}
  .box{flex:1}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th,td{border:1px solid #ddd;padding:8px}
  th{background:#0ea5e9;color:#fff;text-align:left}
  .totals{margin-top:16px;width:280px;margin-left:auto;font-size:14px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{font-weight:700;font-size:16px;border-top:2px solid #0ea5e9;margin-top:6px;padding-top:8px}
  .header{border-bottom:3px solid #0ea5e9;padding-bottom:12px}
</style></head><body>
  <div class="header">
    <h1>Faktura ${inv.number}</h1>
    <div class="muted">Data wystawienia: ${inv.issue_date} · Termin płatności: ${inv.due_date} · Metoda: ${inv.payment_method}</div>
  </div>
  <div class="grid">
    <div class="box"><strong>Sprzedawca</strong><br>${inv.seller.name}<br><span class="muted">${inv.seller.address}<br>NIP: ${inv.seller.nip}<br>${inv.seller.email}</span></div>
    <div class="box"><strong>Nabywca</strong><br>${inv.buyer.name}<br><span class="muted">${inv.buyer.email}${inv.buyer.nip ? `<br>NIP: ${inv.buyer.nip}` : ""}</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Nazwa</th><th style="text-align:center">Ilość</th><th style="text-align:right">Cena netto</th><th style="text-align:right">Wartość netto</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Netto:</span><span>${money(inv.net, inv.currency)}</span></div>
    <div><span>VAT (23%):</span><span>${money(inv.vat, inv.currency)}</span></div>
    <div class="grand"><span>Do zapłaty:</span><span>${money(inv.gross, inv.currency)}</span></div>
  </div>
  <p class="muted" style="margin-top:24px">Płatność: przelew na ${inv.seller.iban} · w tytule numer faktury ${inv.number}.<br>Dokument wygenerowany automatycznie przez Aurorę · GrouAI Stream.</p>
</body></html>`;
}

async function sendDiscord(webhookUrl: string, inv: any) {
  const desc = [
    `**Nabywca:** ${inv.buyer.name} (${inv.buyer.email})`,
    `**Usługa:** ${inv.items.map((i: InvoiceItem) => i.name).join(", ")}`,
    `**Netto:** ${money(inv.net, inv.currency)} · **VAT:** ${money(inv.vat, inv.currency)}`,
    `**Do zapłaty:** ${money(inv.gross, inv.currency)}`,
    `**Termin:** ${inv.due_date}`,
  ].join("\n");

  const r = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "GrouAI Faktury",
      embeds: [
        {
          title: `🧾 Nowa faktura ${inv.number}`,
          description: desc.slice(0, 1800),
          color: 0x0ea5e9,
          footer: { text: "GrouAI Stream · faktura automatyczna" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  return { ok: r.ok, status: r.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const {
      order_id = null,
      client_email = null,
      client_name = "Klient",
      client_nip = null,
      service_type = "usługa",
      currency = "PLN",
      amount_net,
      items,
      payment_method = "przelew",
    } = body ?? {};

    // Pozycje: albo przekazane, albo jedna z amount_net.
    const lineItems: InvoiceItem[] =
      Array.isArray(items) && items.length
        ? items
        : [{ name: service_type, qty: 1, unit_net: Number(amount_net) || 0 }];

    const net = lineItems.reduce((s, it) => s + it.qty * it.unit_net, 0);
    const vat = Math.round(net * VAT_RATE * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;

    // Numer faktury: FV/RRRR/MM/NNN — kolejny numer w danym miesiącu.
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const monthStart = new Date(yyyy, now.getMonth(), 1).toISOString();
    let seq = 1;
    try {
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart);
      seq = (count ?? 0) + 1;
    } catch (_) { /* tabela może nie istnieć — numeracja od 1 */ }
    const number = `FV/${yyyy}/${mm}/${String(seq).padStart(3, "0")}`;

    const dueDate = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    let seller = DEFAULT_SELLER;
    try {
      const custom = Deno.env.get("INVOICE_SELLER_JSON");
      if (custom) seller = { ...DEFAULT_SELLER, ...JSON.parse(custom) };
    } catch (_) { /* zły JSON — użyj domyślnych */ }

    const invoice = {
      number,
      issue_date: now.toISOString().slice(0, 10),
      due_date: dueDate,
      currency,
      payment_method,
      seller,
      buyer: { name: client_name, email: client_email, nip: client_nip },
      items: lineItems,
      net,
      vat,
      gross,
      order_id,
    };

    const html = invoiceHtml(invoice);

    // 1) Discord
    let discord = { ok: false, status: 0 };
    const discordUrl = Deno.env.get("DISCORD_INVOICE_WEBHOOK_URL");
    if (discordUrl) discord = await sendDiscord(discordUrl, invoice).catch(() => ({ ok: false, status: 0 }));

    // 2) n8n (dalsze kroki: PDF, e-mail, księgowość)
    let n8n = { ok: false, status: 0 };
    const n8nUrl = Deno.env.get("N8N_INVOICE_WEBHOOK_URL") || Deno.env.get("N8N_WEBHOOK_URL");
    if (n8nUrl) {
      try {
        const r = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "invoice.created", data: { ...invoice, html } }),
        });
        n8n = { ok: r.ok, status: r.status };
      } catch (_) { /* n8n offline — nie blokuj */ }
    }

    // 3) Log do bazy
    await supabase
      .from("invoices")
      .insert({
        number,
        order_id,
        client_email,
        client_name,
        service_type,
        currency,
        net,
        vat,
        gross,
        status: "issued",
        html,
        created_at: now.toISOString(),
      })
      .catch((e: unknown) => console.error("invoices insert failed:", e));

    return json({ ok: true, invoice, delivered: { discord, n8n } });
  } catch (error) {
    console.error("[aurora-invoice-bot] error:", error);
    return json({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});
