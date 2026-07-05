import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, AlertTriangle, Wallet, CreditCard, ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";

type PaymentRow = {
  kind: string;
  created_at: string;
  amount: number;
  currency: string;
  payer_id: string | null;
  payer_name: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  product: string | null;
  ref_id: string | null;
};

type PayoutRow = {
  user_id: string;
  display_name: string | null;
  total_earned: number;
  total_paid: number;
  balance: number;
  full_name: string | null;
  city: string | null;
  bank_account: string | null;
  last_request_at: string | null;
  last_request_status: string | null;
};

type FraudRow = {
  ip_address: string;
  account_count: number;
  user_ids: string[];
  display_names: string[];
  emails: string[];
  earnings_total: number;
  last_seen: string;
};

const copy = (v: string) => {
  navigator.clipboard.writeText(v);
  toast.success("Skopiowano");
};

export default function PayoutsAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [fraud, setFraud] = useState<FraudRow[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: d }, { data: f }] = await Promise.all([
      supabase.rpc("admin_payments_feed", { _limit: 100 }),
      supabase.rpc("admin_payouts_due", { _min_amount: 5 }),
      supabase.rpc("admin_ip_fraud", { _min_accounts: 2 }),
    ]);
    setPayments((p as any) || []);
    setPayouts((d as any) || []);
    setFraud((f as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totalDue = payouts.reduce((s, r) => s + Number(r.balance || 0), 0);
  const readyToPay = payouts.filter((p) => p.bank_account);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Do wypłaty (razem)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalDue.toFixed(2)} €</div>
            <div className="text-xs text-muted-foreground">{payouts.length} twórców</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Gotowe do przelewu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{readyToPay.length}</div>
            <div className="text-xs text-muted-foreground">mają podany nr konta</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Podejrzane IP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">{fraud.length}</div>
            <div className="text-xs text-muted-foreground">grup kont z tym samym IP</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Odśwież
        </Button>
      </div>

      <Tabs defaultValue="due">
        <TabsList>
          <TabsTrigger value="due">💸 Do wypłaty ({payouts.length})</TabsTrigger>
          <TabsTrigger value="payments">📥 Wpłaty ({payments.length})</TabsTrigger>
          <TabsTrigger value="fraud">🚨 Fraud IP ({fraud.length})</TabsTrigger>
        </TabsList>

        {/* PAYOUTS DUE */}
        <TabsContent value="due">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Twórca</th>
                      <th className="text-right p-3">Zarobił</th>
                      <th className="text-right p-3">Wypłacono</th>
                      <th className="text-right p-3">Saldo</th>
                      <th className="text-left p-3">Dane do przelewu</th>
                      <th className="text-left p-3">Ostatnia prośba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((r) => (
                      <tr key={r.user_id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3">
                          <div className="font-medium">{r.display_name || "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.user_id.slice(0, 8)}</div>
                        </td>
                        <td className="p-3 text-right">{Number(r.total_earned).toFixed(2)} €</td>
                        <td className="p-3 text-right text-muted-foreground">{Number(r.total_paid).toFixed(2)} €</td>
                        <td className="p-3 text-right font-bold text-primary">{Number(r.balance).toFixed(2)} €</td>
                        <td className="p-3">
                          {r.bank_account ? (
                            <div className="space-y-1">
                              <div className="font-medium">{r.full_name}</div>
                              <div className="text-xs text-muted-foreground">{r.city}</div>
                              <button
                                onClick={() => copy(r.bank_account!)}
                                className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded flex items-center gap-1 hover:bg-secondary"
                              >
                                {r.bank_account} <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-amber-400 border-amber-500/40">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              brak nr konta
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {r.last_request_at ? (
                            <>
                              {new Date(r.last_request_at).toLocaleDateString("pl-PL")}
                              <Badge variant="secondary" className="ml-2">{r.last_request_status}</Badge>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                    {!payouts.length && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          🎉 Nikt nie czeka na wypłatę
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Kiedy</th>
                      <th className="text-left p-3">Typ</th>
                      <th className="text-left p-3">Od kogo</th>
                      <th className="text-left p-3">Dla kogo</th>
                      <th className="text-right p-3">Kwota</th>
                      <th className="text-left p-3">Produkt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((r, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pl-PL")}
                        </td>
                        <td className="p-3">
                          <Badge variant={r.kind === "tip" ? "default" : "secondary"}>
                            {r.kind === "tip" ? "☕ tip" : "💳 zakup"}
                          </Badge>
                        </td>
                        <td className="p-3">{r.payer_name || "—"}</td>
                        <td className="p-3">{r.recipient_name || <span className="text-muted-foreground">platforma</span>}</td>
                        <td className="p-3 text-right font-semibold">
                          {Number(r.amount).toFixed(2)} {r.currency}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]">{r.product}</td>
                      </tr>
                    ))}
                    {!payments.length && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">Brak wpłat</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FRAUD */}
        <TabsContent value="fraud">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                Konta zarejestrowane / logowane z tego samego adresu IP. Wielokrotne konta z jednego IP + zarobki = możliwe farmienie royalties.
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">IP</th>
                      <th className="text-right p-3">Kont</th>
                      <th className="text-left p-3">Konta</th>
                      <th className="text-right p-3">Zarobki łączne</th>
                      <th className="text-left p-3">Ostatnio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraud.map((r) => (
                      <tr key={r.ip_address} className="border-t border-border hover:bg-muted/20 align-top">
                        <td className="p-3 font-mono text-xs">
                          <button onClick={() => copy(r.ip_address)} className="hover:underline flex items-center gap-1">
                            {r.ip_address} <Copy className="h-3 w-3" />
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <Badge variant={r.account_count >= 3 ? "destructive" : "secondary"}>
                            {r.account_count}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {r.user_ids.map((uid, i) => (
                              <div key={uid} className="text-xs">
                                <span className="font-medium">{r.display_names?.[i] || "—"}</span>
                                <span className="text-muted-foreground ml-2">{r.emails?.[i] || ""}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {Number(r.earnings_total).toFixed(2)} €
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(r.last_seen).toLocaleDateString("pl-PL")}
                        </td>
                      </tr>
                    ))}
                    {!fraud.length && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          ✅ Brak podejrzanych grup IP
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
