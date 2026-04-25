// Faktury — generuje + lista do druku/zapisania PDF (window.print)
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Plus } from "lucide-react";
import { toast } from "sonner";

interface Invoice {
  id: string; invoice_number: string; invoice_type: string; status: string;
  buyer_name: string; buyer_company: string | null; total_eur: number; vat_amount_eur: number;
  subtotal_eur: number; currency: string; issued_at: string | null; items: any;
  seller_name: string; seller_address: string | null; seller_tax_id: string | null;
}

const printInvoice = (inv: Invoice) => {
  const items = Array.isArray(inv.items) ? inv.items : [];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoice_number}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:800px;margin:auto}
    h1{color:#FF6A1F;margin:0 0 8px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}
    .box{border:1px solid #ddd;padding:12px;border-radius:8px}
    .box h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;color:#666}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
    th{background:#fafafa;font-size:12px}
    .totals{margin-top:20px;text-align:right}
    .totals div{padding:4px 0}
    .total{font-size:20px;font-weight:bold;color:#FF6A1F;border-top:2px solid #111;padding-top:8px;margin-top:8px}
    .meta{color:#666;font-size:12px}
  </style></head><body>
  <h1>${inv.invoice_type === "receipt" ? "Rachunek" : inv.invoice_type === "proforma" ? "Faktura proforma" : "Faktura VAT"} ${inv.invoice_number}</h1>
  <div class="meta">Data wystawienia: ${inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("pl-PL") : "—"} • Status: ${inv.status}</div>
  <div class="grid">
    <div class="box"><h3>Sprzedawca</h3>
      <div><strong>${inv.seller_name}</strong></div>
      ${inv.seller_address ? `<div>${inv.seller_address}</div>` : ""}
      ${inv.seller_tax_id ? `<div>NIP: ${inv.seller_tax_id}</div>` : ""}
    </div>
    <div class="box"><h3>Nabywca</h3>
      <div><strong>${inv.buyer_company ?? inv.buyer_name}</strong></div>
      ${inv.buyer_company ? `<div>${inv.buyer_name}</div>` : ""}
    </div>
  </div>
  <table><thead><tr><th>Pozycja</th><th>Ilość</th><th>Cena</th><th>Wartość</th></tr></thead><tbody>
    ${items.map((it: any) => `<tr><td>${it.name}</td><td>${it.qty}</td><td>${Number(it.unit_price).toFixed(2)} ${inv.currency}</td><td>${Number(it.total).toFixed(2)} ${inv.currency}</td></tr>`).join("")}
  </tbody></table>
  <div class="totals">
    <div>Netto: ${inv.subtotal_eur.toFixed(2)} ${inv.currency}</div>
    <div>VAT: ${inv.vat_amount_eur.toFixed(2)} ${inv.currency}</div>
    <div class="total">Do zapłaty: ${inv.total_eur.toFixed(2)} ${inv.currency}</div>
  </div>
  <div class="meta" style="margin-top:40px;text-align:center">Wygenerowano przez GrouAI Stream • ${new Date().toLocaleString("pl-PL")}</div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
};

export const InvoicesPanel = ({ orderId }: { orderId: string }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("aurora_invoices").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
    setInvoices((data ?? []) as Invoice[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  const generate = async (type: "invoice" | "receipt") => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("aurora-invoice-generate", {
      body: { order_id: orderId, invoice_type: type },
    });
    setGenerating(false);
    if (error || !(data as any)?.ok) { toast.error("Nie wygenerowano"); return; }
    toast.success(`Dokument ${(data as any).invoice_number} gotowy`);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Faktury i rachunki</CardTitle>
            <CardDescription>Dokumenty do pobrania (PDF przez druk → zapisz jako PDF)</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => generate("invoice")} disabled={generating} className="gap-1">
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Faktura VAT
            </Button>
            <Button size="sm" variant="secondary" onClick={() => generate("receipt")} disabled={generating} className="gap-1">
              <Plus className="w-3 h-3" /> Rachunek
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
          invoices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Brak dokumentów. Wygeneruj fakturę lub rachunek 👆</p> :
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{inv.invoice_number}</span>
                    <Badge variant="outline" className="text-[10px]">{inv.invoice_type}</Badge>
                    <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-[10px]">{inv.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {inv.buyer_company ?? inv.buyer_name} • {inv.total_eur.toFixed(2)} {inv.currency}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => printInvoice(inv)} className="gap-1">
                  <Download className="w-3 h-3" /> PDF
                </Button>
              </div>
            ))}
          </div>
        }
      </CardContent>
    </Card>
  );
};
