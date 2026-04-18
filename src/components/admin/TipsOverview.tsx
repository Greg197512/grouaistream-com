import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Heart, Wallet, RefreshCw, Search, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Summary {
  total_balance: number;
  total_sent: number;
  total_received: number;
  total_platform_fees: number;
  total_users_with_wallet: number;
  total_tips_sent: number;
}
interface WalletRow {
  user_id: string; balance: number; total_sent: number; total_received: number;
  email: string; display_name: string | null;
}
interface TxRow {
  id: string; amount: number; artist_amount: number; platform_fee: number;
  tx_type: string; created_at: string;
  sender_email: string; sender_name: string | null;
  recipient_email: string; recipient_name: string | null;
  track_title: string | null;
}

export const TipsOverview = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [topupTarget, setTopupTarget] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState("5");
  const [topingUp, setTopingUp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_tip_overview");
    if (error) {
      toast.error("Błąd: " + error.message);
    } else {
      const d = data as any;
      setSummary(d?.summary || null);
      setWallets(d?.wallets || []);
      setTransactions(d?.transactions || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTopup = async (userId: string) => {
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0 || amount > 1000) {
      toast.error("Kwota 0.01–1000€");
      return;
    }
    setTopingUp(true);
    const { data, error } = await supabase.rpc("admin_topup_tip_credits", {
      _user_id: userId, _amount: amount,
    });
    setTopingUp(false);
    if (error || !(data as any)?.success) {
      toast.error("Błąd doładowania: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success(`Doładowano ${amount}€. Nowe saldo: ${(data as any).new_balance.toFixed(2)}€`);
    setTopupTarget(null);
    load();
  };

  const filteredWallets = wallets.filter(w =>
    !filter || w.email?.toLowerCase().includes(filter.toLowerCase()) ||
    w.display_name?.toLowerCase().includes(filter.toLowerCase()));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3 w-3" />W portfelach</div>
            <div className="text-lg font-bold text-pink-300">{Number(summary.total_balance).toFixed(2)}€</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Heart className="h-3 w-3" />Wysłano</div>
            <div className="text-lg font-bold text-rose-300">{Number(summary.total_sent).toFixed(2)}€</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Otrzymano artyści</div>
            <div className="text-lg font-bold text-emerald-300">{Number(summary.total_received).toFixed(2)}€</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Prowizja 10%</div>
            <div className="text-lg font-bold text-amber-300">{Number(summary.total_platform_fees).toFixed(2)}€</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Userów z portfelem</div>
            <div className="text-lg font-bold">{summary.total_users_with_wallet}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Tipów wysłanych</div>
            <div className="text-lg font-bold">{summary.total_tips_sent}</div>
          </CardContent></Card>
        </div>
      )}

      {/* Wallets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Portfele tipów ({filteredWallets.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3 w-3 mr-1" />Odśwież</Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Szukaj user/email..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-7 h-8 text-xs" />
          </div>
          <div className="overflow-x-auto max-h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Wysłano</TableHead>
                  <TableHead className="text-right">Otrzymano</TableHead>
                  <TableHead className="text-right">Doładuj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWallets.slice(0, 100).map(w => (
                  <TableRow key={w.user_id}>
                    <TableCell className="text-xs">
                      <div className="font-semibold">{w.display_name || "—"}</div>
                      <div className="text-muted-foreground">{w.email}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-pink-300">{Number(w.balance).toFixed(2)}€</TableCell>
                    <TableCell className="text-right text-xs text-rose-300">{Number(w.total_sent).toFixed(2)}€</TableCell>
                    <TableCell className="text-right text-xs text-emerald-300">{Number(w.total_received).toFixed(2)}€</TableCell>
                    <TableCell className="text-right">
                      {topupTarget === w.user_id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input type="number" min="0.01" max="1000" step="0.5" value={topupAmount}
                                 onChange={e => setTopupAmount(e.target.value)} className="h-7 w-16 text-xs" />
                          <Button size="sm" className="h-7 px-2" disabled={topingUp}
                                  onClick={() => handleTopup(w.user_id)}>
                            {topingUp ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setTopupTarget(null)}>×</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => { setTopupTarget(w.user_id); setTopupAmount("5"); }}>
                          <Plus className="h-3 w-3 mr-1" />Doładuj
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transakcje */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historia tipów ({transactions.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Od</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Do</TableHead>
                  <TableHead>Utwór</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                  <TableHead className="text-right">Artysta dostał</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 200).map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{t.sender_name || t.sender_email}</TableCell>
                    <TableCell><ArrowRight className="h-3 w-3 text-pink-400" /></TableCell>
                    <TableCell className="text-xs">{t.recipient_name || t.recipient_email}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground">{t.track_title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={t.tx_type === "admin_topup" ? "text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30" : "text-[10px] bg-pink-500/20 text-pink-300 border-pink-500/30"}>
                        {t.tx_type === "admin_topup" ? "Admin doładował" : "Tip"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold">{Number(t.amount).toFixed(2)}€</TableCell>
                    <TableCell className="text-right text-xs text-emerald-300">{Number(t.artist_amount).toFixed(2)}€</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("pl")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
