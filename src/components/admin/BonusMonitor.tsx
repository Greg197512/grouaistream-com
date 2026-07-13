import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Gift, Wallet, CheckCircle2, RefreshCw, Banknote, Copy, Crown, Star } from "lucide-react";
import { toast } from "sonner";
import { RatingsAuditTable } from "./RatingsAuditTable";

interface UserBonusRow {
  user_id: string;
  email: string;
  display_name: string | null;
  uploads_count: number;
  likes_count: number;
  mood_sessions_count: number;
  studio_count: number;
  ratings_count: number;
  uploads_claimed: boolean;
  likes_claimed: boolean;
  mood_claimed: boolean;
  studio_claimed: boolean;
  ratings_claimed: boolean;
  mood_first_claimed: boolean;
  total_earned: number;
  total_requested: number;
}

interface PendingPayout {
  detail_id: string;
  user_id: string;
  full_name: string;
  city: string;
  bank_account: string;
  amount: number;
  acknowledged: boolean;
  created_at: string;
  payout_request_id: string;
  email: string;
  display_name: string | null;
}

const MILESTONES = [
  { key: "uploads", label: "50 uploadów", target: 50, countField: "uploads_count" as const, claimedField: "uploads_claimed" as const, amount: 12 },
  { key: "likes", label: "50 polubień", target: 50, countField: "likes_count" as const, claimedField: "likes_claimed" as const, amount: 12 },
  { key: "mood", label: "5 sesji nastroju", target: 5, countField: "mood_sessions_count" as const, claimedField: "mood_claimed" as const, amount: 5 },
  { key: "studio", label: "5 utw. Studio", target: 5, countField: "studio_count" as const, claimedField: "studio_claimed" as const, amount: 12 },
  { key: "ratings", label: "50 ocen ★", target: 50, countField: "ratings_count" as const, claimedField: "ratings_claimed" as const, amount: 12 },
];

export const BonusMonitor = () => {
  const [users, setUsers] = useState<UserBonusRow[]>([]);
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [bonusRes, payoutRes] = await Promise.all([
      supabase.rpc("get_all_users_bonus_progress"),
      supabase.rpc("get_pending_payouts"),
    ]);

    if (bonusRes.error) {
      toast.error("Błąd ładowania: " + bonusRes.error.message);
    } else {
      const data = (bonusRes.data as any) || [];
      setUsers(Array.isArray(data) ? data : []);
    }
    if (payoutRes.error) {
      toast.error("Błąd wypłat: " + payoutRes.error.message);
    } else {
      const data = (payoutRes.data as any) || [];
      setPayouts(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAcknowledge = async (detailId: string) => {
    setAcking(detailId);
    const { data, error } = await supabase.rpc("acknowledge_payout", { _detail_id: detailId });
    if (error || !(data as any)?.success) {
      toast.error("Nie udało się potwierdzić");
    } else {
      toast.success("Wypłata potwierdzona ✅");
      setPayouts(prev => prev.filter(p => p.detail_id !== detailId));
    }
    setAcking(null);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Skopiowano: ${label}`);
  };

  // Top section: użytkownicy gotowi do bonusu (osiągnęli próg ale nie odebrali)
  const eligible = users.filter(u =>
    MILESTONES.some(m => u[m.countField] >= m.target && !u[m.claimedField])
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending wypłaty */}
      {payouts.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              Oczekujące wypłaty ({payouts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead>Miejscowość</TableHead>
                    <TableHead>Numer konta</TableHead>
                    <TableHead className="text-right">Kwota</TableHead>
                    <TableHead className="text-right">Akcja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map(p => (
                    <TableRow key={p.detail_id}>
                      <TableCell>
                        <div className="text-xs">
                          <div className="font-semibold">{p.display_name || "—"}</div>
                          <div className="text-muted-foreground">{p.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell>{p.city}</TableCell>
                      <TableCell>
                        <button onClick={() => copyText(p.bank_account, "konto")} className="text-xs font-mono hover:text-primary flex items-center gap-1">
                          {p.bank_account}
                          <Copy className="h-3 w-3" />
                        </button>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">{Number(p.amount).toFixed(2)} $</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleAcknowledge(p.detail_id)} disabled={acking === p.detail_id}>
                          {acking === p.detail_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Wysłano</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Użytkownicy gotowi do bonusu */}
      {eligible.length > 0 && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-emerald-400" />
              Użytkownicy gotowi do odbioru bonusu ({eligible.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {eligible.map(u => {
                const ready = MILESTONES.filter(m => u[m.countField] >= m.target && !u[m.claimedField]);
                return (
                  <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/50">
                    <div>
                      <div className="font-semibold">{u.display_name || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ready.map(m => (
                        <Badge key={m.key} className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          🎁 {m.label} (+{m.amount}$)
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pełna lista bonusów wszystkich userów */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Postęp bonusów wszystkich użytkowników
          </CardTitle>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3 w-3 mr-1" />Odśwież
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  {MILESTONES.map(m => <TableHead key={m.key}>{m.label}</TableHead>)}
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="text-xs">
                        <div className="font-semibold">{u.display_name || "—"}</div>
                        <div className="text-muted-foreground">{u.email}</div>
                      </div>
                    </TableCell>
                    {MILESTONES.map(m => {
                      const count = u[m.countField];
                      const claimed = u[m.claimedField];
                      const pct = Math.min(100, (count / m.target) * 100);
                      const ready = count >= m.target && !claimed;
                      return (
                        <TableCell key={m.key} className="min-w-[120px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className={ready ? "text-emerald-400 font-bold" : "text-muted-foreground"}>
                                {count}/{m.target}
                              </span>
                              {claimed && <Badge variant="outline" className="text-[9px] h-4 px-1">✓</Badge>}
                              {ready && <Badge className="text-[9px] h-4 px-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">GO</Badge>}
                            </div>
                            <Progress value={pct} className={`h-1 ${ready ? "[&>div]:bg-emerald-400" : ""}`} />
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      <div className="text-sm font-bold text-primary">{Number(u.total_earned).toFixed(2)} $</div>
                      {Number(u.total_requested) > 0 && (
                        <div className="text-[10px] text-muted-foreground">wypł: {Number(u.total_requested).toFixed(2)} $</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Audyt ocen 1-5★ */}
      <RatingsAuditTable />
    </div>
  );
};
