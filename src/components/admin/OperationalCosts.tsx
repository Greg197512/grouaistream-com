import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Lightbulb, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CostRow { id: string; service_name: string; monthly_amount: number; billing_day: number; is_active: boolean; notes: string | null; }
interface Upcoming { service_name: string; monthly_amount: number; billing_day: number; next_due: string; }
interface Overview {
  total_monthly_costs: number; platform_revenue_mtd: number; tips_volume_mtd: number;
  balance: number; shortfall: number; is_alert: boolean;
  costs: CostRow[]; upcoming: Upcoming[];
}

const REVENUE_IDEAS = [
  { icon: "🚀", title: "Boost utworów premium", desc: "5€ / 7 dni → utwór wyświetlany na #1 na stronie głównej. Cel: 10 boostów/miesiąc = 50€." },
  { icon: "💎", title: "Tier Ultimate +5€/mies", desc: "Dodaj plan 14.99€/mies: nielimitowane Suno, własny voice clone, brak reklam, 20€ tip-credits/mies." },
  { icon: "🎁", title: "Doładowanie tip-creditów", desc: "User płaci 10€ → dostaje 12€ tipów (bonus 20%). Stripe checkout. 100% marża na bonus." },
  { icon: "🎤", title: "Płatne konkursy weekendowe", desc: "Wpisowe 2€ → pula nagród 70%, platforma 30%. 50 uczestników = 30€ czystego zysku." },
  { icon: "📻", title: "Sponsored Radio Slots", desc: "Marka płaci 30€ za 3 spoty audio dziennie w GrouaRadio (TTS-generated). Skalowanie: 10 marek = 300€/mies." },
  { icon: "🎨", title: "AI Cover-on-Demand", desc: "Custom okładka AI dla utworu = 1€ (Lovable AI ~0.05€). Marża 95%. 100 sprzedaży = 95€." },
  { icon: "🔓", title: "Unlock-codes B2B", desc: "Sprzedaż kodów dostępu szkołom/firmom: 100 kodów × 5€ = 500€ jednorazowo." },
  { icon: "📊", title: "Raport AI-Psychologa Pro", desc: "Rozszerzony PDF z trendami nastroju za 3€. Już mamy infrastrukturę — tylko paywall." },
  { icon: "🤝", title: "Affiliate ElevenLabs/Suno", desc: "Linki polecające → 20% komisji. User testuje na Groua → kupuje na zewnątrz." },
  { icon: "🎟️", title: "Party Pulpit Pro", desc: "Host imprezy płaci 9€/sesja → unlimited gości + statystyki + nagranie sesji." },
];

export const OperationalCosts = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [newService, setNewService] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDay, setNewDay] = useState("1");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d, error } = await supabase.rpc("get_admin_cost_overview");
    if (error) toast.error("Błąd: " + error.message);
    else if ((d as any)?.error) toast.error((d as any).error);
    else setData(d as unknown as Overview);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCost = async () => {
    if (!newService.trim() || !newAmount) return toast.error("Podaj nazwę i kwotę");
    const { error } = await supabase.from("operational_costs").insert({
      service_name: newService.trim(), monthly_amount: Number(newAmount), billing_day: Math.min(28, Math.max(1, Number(newDay) || 1)),
    });
    if (error) toast.error(error.message);
    else { toast.success("Dodano koszt"); setNewService(""); setNewAmount(""); setNewDay("1"); load(); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("operational_costs").update({ is_active: !current }).eq("id", id);
    load();
  };

  const deleteCost = async (id: string) => {
    if (!confirm("Usunąć koszt?")) return;
    await supabase.from("operational_costs").delete().eq("id", id);
    load();
  };

  if (loading || !data) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const balance = Number(data.balance);
  const shortfall = Number(data.shortfall);

  return (
    <div className="space-y-4">
      {/* ALERT BIG */}
      {data.is_alert && (
        <Card className="border-red-500/60 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
          <CardContent className="p-5 flex items-start gap-4">
            <AlertTriangle className="h-8 w-8 text-red-300 shrink-0 animate-pulse" />
            <div className="flex-1">
              <div className="text-xl font-bold text-red-200">⚠️ Brakuje {shortfall.toFixed(2)}€ na pokrycie kosztów miesięcznych!</div>
              <div className="text-sm text-red-300/90 mt-1">
                Przychód MTD: <b>{Number(data.platform_revenue_mtd).toFixed(2)}€</b> | Koszty: <b>{Number(data.total_monthly_costs).toFixed(2)}€</b>
              </div>
              <div className="text-xs text-red-300/70 mt-2">→ Sprawdź sekcję "Pomysły monetyzacji" niżej, doładuj tipy lub zwiększ tier Ultimate.</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="h-3 w-3" />Koszty / mies</div>
          <div className="text-xl font-bold text-red-300">{Number(data.total_monthly_costs).toFixed(2)}€</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" />Przychód MTD</div>
          <div className="text-xl font-bold text-emerald-300">{Number(data.platform_revenue_mtd).toFixed(2)}€</div>
          <div className="text-[10px] text-muted-foreground">z {Number(data.tips_volume_mtd).toFixed(2)}€ tipów</div>
        </CardContent></Card>
        <Card className={cn(balance >= 0 ? "border-emerald-500/30" : "border-red-500/40")}><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Bilans</div>
          <div className={cn("text-xl font-bold", balance >= 0 ? "text-emerald-300" : "text-red-300")}>{balance >= 0 ? "+" : ""}{balance.toFixed(2)}€</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />Najbliższe</div>
          {data.upcoming?.[0] && (
            <>
              <div className="text-sm font-bold">{data.upcoming[0].service_name}</div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(data.upcoming[0].next_due).toLocaleDateString("pl")} • {Number(data.upcoming[0].monthly_amount).toFixed(0)}€
              </div>
            </>
          )}
        </CardContent></Card>
      </div>

      {/* COSTS TABLE + ADD */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Koszty stałe (subskrypcje)</CardTitle>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3 w-3 mr-1" />Odśwież</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2">
            <Input placeholder="Nazwa usługi (np. Cloudflare R2)" value={newService} onChange={e => setNewService(e.target.value)} />
            <Input type="number" placeholder="EUR / mies" value={newAmount} onChange={e => setNewAmount(e.target.value)} />
            <Input type="number" min={1} max={28} placeholder="Dzień (1-28)" value={newDay} onChange={e => setNewDay(e.target.value)} />
            <Button onClick={addCost} className="gap-1"><Plus className="h-3 w-3" />Dodaj</Button>
          </div>

          <Table>
            <TableHeader><TableRow>
              <TableHead>Usługa</TableHead><TableHead>Kwota</TableHead><TableHead>Dzień</TableHead>
              <TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.costs.map(c => (
                <TableRow key={c.id}>
                  <TableCell><div className="font-semibold">{c.service_name}</div>{c.notes && <div className="text-[10px] text-muted-foreground">{c.notes}</div>}</TableCell>
                  <TableCell className="font-bold text-red-300">{Number(c.monthly_amount).toFixed(2)}€</TableCell>
                  <TableCell className="text-xs">{c.billing_day}.</TableCell>
                  <TableCell>
                    <Badge variant="outline" onClick={() => toggleActive(c.id, c.is_active)} className={cn("cursor-pointer", c.is_active ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-muted/30 text-muted-foreground")}>
                      {c.is_active ? "aktywny" : "wyłączony"}
                    </Badge>
                  </TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => deleteCost(c.id)}><Trash2 className="h-3 w-3 text-red-400" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* IDEAS */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-300" />Pomysły monetyzacji — zawsze być na plusie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {REVENUE_IDEAS.map((idea, i) => (
              <div key={i} className="bg-card/50 border border-white/10 rounded-lg p-3">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <span className="text-lg">{idea.icon}</span>{idea.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{idea.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
