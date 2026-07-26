import { useCallback, useEffect, useState } from "react";
import { Trophy, Loader2, RefreshCw, Lock, Truck, Check, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { gameAdminList, gameAdminMarkShipped } from "@/lib/hubGame";

// Panel admina: zwycięzcy gry „Wygraj swoją płytę" — kto wygrał, co wybrał,
// adres wysyłki i status. PIN wspólny z panelami B2B.
interface Pick { medium: string; tracks: any[]; ship_name: string; ship_address: string; ship_email: string; status: string; }
interface Round { id: string; title: string; status: string; ends_at: string; winner_name: string | null; winner_email: string | null; pick: Pick | null; }

const MEDIUM_LABEL: Record<string, string> = { vinyl: "🟠 Winyl", cd: "⚪ CD", nfc: "🔵 NFC" };

export function GameWinnersPanel() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pin, setPin] = useState<string>(() => localStorage.getItem("b2b-pricing-pin") || "");

  const load = useCallback(async (thePin?: string) => {
    const p = (thePin ?? pin).trim();
    if (!p) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = await gameAdminList(p);
      if (!d?.ok) throw new Error(d?.error === "bad_pin" ? "Zły PIN" : (d?.error || "błąd"));
      setRounds(d.rounds || []); setPlayers(d.active_players || 0);
      localStorage.setItem("b2b-pricing-pin", p);
    } catch (e: any) { toast.error("Nie udało się: " + (e?.message || "")); }
    finally { setLoading(false); }
  }, [pin]);

  useEffect(() => { if (pin) void load(); /* eslint-disable-next-line */ }, []);

  const markShipped = async (round_id: string, status: "shipped" | "submitted") => {
    setBusy(round_id);
    try {
      const d = await gameAdminMarkShipped(pin.trim(), round_id, status);
      if (!d?.ok) throw new Error(d?.error || "błąd");
      toast.success(status === "shipped" ? "Oznaczono jako wysłane 📦" : "Cofnięto do „do wysłania”");
      await load();
    } catch (e: any) { toast.error("Nie udało się: " + (e?.message || "")); }
    finally { setBusy(null); }
  };

  const active = rounds.find((r) => r.status === "active");
  const winners = rounds.filter((r) => r.status !== "active");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Zwycięzcy gry — „Wygraj swoją płytę”</h3>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Odśwież
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative sm:max-w-[240px]">
          <Lock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input type="password" placeholder="PIN admina" value={pin} onChange={(e) => setPin(e.target.value)} className="pl-7" />
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>Wczytaj</Button>
      </div>

      {active && (
        <div className="rounded-xl border border-border p-3 flex items-center gap-3">
          <Disc3 className="h-5 w-5 text-[#FFB020]" />
          <div className="text-sm">
            <b>Runda trwa</b> — kończy się {new Date(active.ends_at).toLocaleString("pl-PL")}
            <span className="text-muted-foreground"> · {players} graczy</span>
          </div>
        </div>
      )}

      {loading && rounds.length === 0 ? (
        <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>
      ) : winners.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Brak rozstrzygniętych rund (lub zły PIN). Zwycięzcy pojawią się po pierwszym losowaniu.</div>
      ) : (
        <div className="space-y-2">
          {winners.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Trophy className="h-4 w-4 text-[#FFB020]" />
                <span className="font-semibold text-sm">{r.winner_name || "— brak zgłoszeń —"}</span>
                {r.winner_email && <span className="text-xs text-muted-foreground">{r.winner_email}</span>}
                <span className="text-[11px] text-muted-foreground ml-auto">runda do {new Date(r.ends_at).toLocaleDateString("pl-PL")}</span>
              </div>

              {r.pick ? (
                <div className="text-xs space-y-1.5 pl-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{MEDIUM_LABEL[r.pick.medium] || r.pick.medium}</Badge>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.pick.status === "shipped" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {r.pick.status === "shipped" ? "Wysłane" : "Do wysłania"}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <b>Wysyłka:</b> {r.pick.ship_name} · {r.pick.ship_email} · {r.pick.ship_address}
                  </div>
                  <div className="text-muted-foreground/90">
                    <b>Utwory ({r.pick.tracks?.length || 0}):</b>{" "}
                    {(r.pick.tracks || []).map((t: any, i: number) => (
                      <span key={i}>{typeof t === "string" ? t : t.title}{i < (r.pick!.tracks.length - 1) ? ", " : ""}</span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    {r.pick.status !== "shipped" ? (
                      <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-500" disabled={busy === r.id}
                        onClick={() => void markShipped(r.id, "shipped")}>
                        {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />} Oznacz wysłane
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 gap-1" disabled={busy === r.id}
                        onClick={() => void markShipped(r.id, "submitted")}>
                        <Check className="h-3 w-3" /> Cofnij
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pl-6">
                  {r.winner_name ? "Zwycięzca jeszcze nie wybrał utworów/nośnika." : "W tej rundzie nie było zgłoszeń (0 losów)."}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Zwycięzca wybiera 10 utworów + nośnik + adres na stronie <b>/wygraj</b>. Tu zamawiasz płytę u dostawcy i oznaczasz „wysłane”. PIN wspólny z panelami B2B.
      </p>
    </div>
  );
}
