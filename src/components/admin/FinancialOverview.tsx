import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, TrendingDown, Wallet, Sparkles, RefreshCw, Search, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Tx {
  id: string;
  user_id: string;
  amount: number;
  earning_type: string;
  description: string;
  created_at: string;
  email: string;
  display_name: string | null;
  row_kind: "earning" | "payout";
}

interface Summary {
  total_streams_paid: number;
  total_bonuses_paid: number;
  total_weekend_paid: number;
  total_like_bonuses_paid?: number;
  total_tips_paid?: number;
  total_earnings_all: number;
  total_payouts_paid: number;
  total_payouts_pending: number;
  users_with_balance: number;
}

const TYPE_LABELS: Record<string, string> = {
  stream: "Stream",
  bonus: "Bonus milowy",
  weekend_bonus: "Weekend AI",
  like_bonus: "Polubienie ❤️",
  tip: "Tip",
  payout: "Wypłata",
};

const TYPE_COLORS: Record<string, string> = {
  stream: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  bonus: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  weekend_bonus: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  like_bonus: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  tip: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
  payout: "bg-red-500/20 text-red-300 border-red-500/30",
};

export const FinancialOverview = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_financial_overview");
    if (error) {
      toast.error("Błąd: " + error.message);
    } else {
      setSummary((data as any)?.summary || null);
      setTransactions((data as any)?.transactions || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    const { error } = await supabase.functions.invoke("generate-weekend-challenge");
    if (error) {
      toast.error("Nie udało się wygenerować: " + error.message);
    } else {
      toast.success("✨ Nowe wyzwanie weekendowe wygenerowane!");
      load();
    }
    setGenerating(false);
  };

  const filtered = transactions.filter(t => {
    if (typeFilter !== "all" && t.earning_type !== typeFilter) return false;
    if (filter && !(t.email?.toLowerCase().includes(filter.toLowerCase()) ||
                    t.display_name?.toLowerCase().includes(filter.toLowerCase()) ||
                    t.description?.toLowerCase().includes(filter.toLowerCase()))) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" />Streamy</div>
            <div className="text-xl font-bold text-blue-300">{Number(summary.total_streams_paid).toFixed(2)}$</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-3 w-3" />Bonusy</div>
            <div className="text-xl font-bold text-emerald-300">{Number(summary.total_bonuses_paid).toFixed(2)}$</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" />Weekend</div>
            <div className="text-xl font-bold text-amber-300">{Number(summary.total_weekend_paid).toFixed(2)}$</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">❤️ Polubienia</div>
            <div className="text-xl font-bold text-pink-300">{Number(summary.total_like_bonuses_paid || 0).toFixed(2)}$</div>
            <div className="text-[10px] text-muted-foreground">0,10 $ / like</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">💜 Tipy</div>
            <div className="text-xl font-bold text-fuchsia-300">{Number(summary.total_tips_paid || 0).toFixed(2)}$</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="h-3 w-3" />Wypłacone</div>
            <div className="text-xl font-bold text-red-300">{Number(summary.total_payouts_paid).toFixed(2)}$</div>
            <div className="text-[10px] text-muted-foreground">oczekuje: {Number(summary.total_payouts_pending).toFixed(2)}$</div>
          </CardContent></Card>
        </div>
      )}

      {/* Weekend AI generator */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-300" />Generator wyzwań weekendowych AI</div>
            <div className="text-xs text-muted-foreground">Tworzy nowe wyzwanie (1-5$) na 72h. Wyłącza poprzednie aktywne.</div>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="bg-amber-500 hover:bg-amber-600 text-black">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Calendar className="h-4 w-4 mr-2" />Wygeneruj</>}
          </Button>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Wszystkie wydatki ({filtered.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3 w-3 mr-1" />Odśwież</Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Szukaj usera, opisu..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-7 h-8 text-xs" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all", "stream", "bonus", "weekend_bonus", "like_bonus", "tip", "payout"].map(t => (
                <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"} onClick={() => setTypeFilter(t)} className="h-8 text-xs">
                  {t === "all" ? "Wszystkie" : TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">
                      <div className="font-semibold">{t.display_name || "—"}</div>
                      <div className="text-muted-foreground">{t.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[t.earning_type] || ""}`}>
                        {TYPE_LABELS[t.earning_type] || t.earning_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">{t.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("pl")}</TableCell>
                    <TableCell className={`text-right font-bold ${t.amount < 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {t.amount < 0 ? "" : "+"}{Number(t.amount).toFixed(2)}$
                    </TableCell>
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
