import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, PlayCircle, Download } from "lucide-react";
import { toast } from "sonner";

interface MonthRow {
  report_month: string;
  fixed_total: number;
  variable_total: number;
  total: number;
}

interface BreakdownRow {
  service_name: string;
  category: string;
  amount_eur: number;
  usage_metric: Record<string, unknown>;
  notes: string | null;
}

export const CostReportsPanel = () => {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_cost_report_summary", { _months: 12 });
    if (error) {
      toast.error("Błąd: " + error.message);
    } else {
      const d = data as any;
      setMonths(d?.months ?? []);
      setBreakdown(d?.current_breakdown ?? []);
      setCurrentMonth(d?.current_month ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    const { error } = await supabase.functions.invoke("monthly-cost-report", { body: { manual: true } });
    if (error) {
      toast.error("Błąd: " + error.message);
    } else {
      toast.success("✅ Raport wygenerowany");
      setTimeout(load, 1500);
    }
    setGenerating(false);
  };

  const handleExportCSV = () => {
    const header = "Service,Category,Amount EUR,Notes\n";
    const rows = breakdown.map(b =>
      `"${b.service_name}",${b.category},${b.amount_eur},"${b.notes ?? ''}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `koszty-${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const current = months.find(m => m.report_month === currentMonth);
  const prev = months[1];
  const delta = current && prev && prev.total > 0
    ? Math.round(((current.total - prev.total) / prev.total) * 100)
    : 0;

  const maxBar = Math.max(...months.map(m => m.total), 1);

  return (
    <div className="space-y-4">
      {/* Bieżący miesiąc */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              💸 Bieżący miesiąc — {currentMonth}
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              Live preview, finalizacja 1. dnia kolejnego miesiąca
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <Download className="h-3 w-3 mr-1" />CSV
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <><PlayCircle className="h-3 w-3 mr-1" />Przelicz teraz</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Stałe</div>
              <div className="text-2xl font-bold text-blue-300">
                {Number(current?.fixed_total ?? 0).toFixed(2)}€
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Zmienne</div>
              <div className="text-2xl font-bold text-amber-300">
                {Number(current?.variable_total ?? 0).toFixed(2)}€
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">RAZEM</div>
              <div className="text-2xl font-bold text-foreground">
                {Number(current?.total ?? 0).toFixed(2)}€
              </div>
              {prev && (
                <div className={`text-xs flex items-center gap-1 ${delta >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {delta >= 0 ? '+' : ''}{delta}% vs poprz.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wykres trendu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📊 Trend ostatnich 12 miesięcy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {months.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                Brak danych. Kliknij <strong>Przelicz teraz</strong>, aby wygenerować pierwszy raport.
              </div>
            )}
            {months.map(m => {
              const widthPct = (m.total / maxBar) * 100;
              const isCurrent = m.report_month === currentMonth;
              return (
                <div key={m.report_month} className="flex items-center gap-3">
                  <div className="text-xs w-20 font-mono text-muted-foreground">
                    {m.report_month.slice(0, 7)}
                  </div>
                  <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden relative">
                    <div
                      className={`h-full ${isCurrent ? 'bg-primary' : 'bg-primary/40'} transition-all`}
                      style={{ width: `${widthPct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2 text-xs font-semibold">
                      {Number(m.total).toFixed(2)}€
                      <span className="text-muted-foreground ml-2 font-normal">
                        ({Number(m.fixed_total).toFixed(0)} fix / {Number(m.variable_total).toFixed(0)} var)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown bieżącego miesiąca */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">🧾 Breakdown — {currentMonth}</CardTitle>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3 w-3 mr-1" />Odśwież
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usługa</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Szczegóły</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Brak danych dla bieżącego miesiąca
                  </TableCell></TableRow>
                )}
                {breakdown.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-xs">{b.service_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${
                        b.category === 'fixed'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {b.category === 'fixed' ? 'stałe' : 'zmienne'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {b.notes || JSON.stringify(b.usage_metric).slice(0, 60)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {Number(b.amount_eur).toFixed(2)}€
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <div><strong className="text-foreground">🤖 Automatyzacja:</strong> Raport liczy się codziennie o 02:00 UTC (live preview) oraz finalizuje 1. dnia miesiąca o 03:00 UTC.</div>
          <div><strong className="text-foreground">📊 Stałe:</strong> Z tabeli operational_costs (Lovable, n8n, ElevenLabs, Suno).</div>
          <div><strong className="text-foreground">⚡ Zmienne:</strong> R2 storage/egress, Suno generacje, ElevenLabs TTS, Cover AI, AI Gateway, Paddle prowizje — wyliczane z realnego użycia.</div>
        </CardContent>
      </Card>
    </div>
  );
};
