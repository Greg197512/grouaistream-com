import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2, RefreshCw, Search, UserPlus, Calendar, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Panel subskrypcji dla admina.
// Źródło: user_subscriptions (admin ma pełny dostęp przez RLS; tabela jest lustrem
// płatności Paddle utrzymywanym triggerem sync_paddle_to_user_subscription).
// Tabela `subscriptions` (surowe dane Paddle) jest dla admina niewidoczna przez RLS —
// jeżeli kiedyś zostanie dodana polityka SELECT dla admina, panel automatycznie
// pokaże też flagę "anuluje się" (cancel_at_period_end).

type PlanValue = "free" | "pro" | "ultimate";

interface SubRow {
  user_id: string;
  plan: PlanValue;
  status: string;
  current_period_end: string | null;
  updated_at: string;
  display_name?: string;
  cancel_at_period_end?: boolean | null; // z tabeli Paddle, jeśli dostępna
}

const PLAN_BADGE: Record<PlanValue, { label: string; cls: string }> = {
  ultimate: { label: "ULTIMATE", cls: "bg-gradient-to-r from-amber-400 to-yellow-500 text-black" },
  pro: { label: "PRO", cls: "bg-primary text-primary-foreground" },
  free: { label: "FREE", cls: "bg-secondary text-muted-foreground" },
};

export function SubscriptionsAdminPanel() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Formularz "przyznaj plan"
  const [grantSearch, setGrantSearch] = useState("");
  const [grantMatches, setGrantMatches] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const [grantPlan, setGrantPlan] = useState<PlanValue>("pro");
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: subs, error } = await supabase
        .from("user_subscriptions")
        .select("user_id, plan, status, current_period_end, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const userIds = (subs ?? []).map((s) => s.user_id);
      let names: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        for (const p of profiles ?? []) names[p.user_id] = p.display_name ?? "";
      }

      // Bonus: szczegóły Paddle (cancel_at_period_end), jeśli RLS pozwoli.
      let paddleFlags: Record<string, boolean | null> = {};
      try {
        const { data: paddleRows } = await supabase
          .from("subscriptions")
          .select("user_id, cancel_at_period_end")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        for (const r of paddleRows ?? []) paddleFlags[r.user_id] = r.cancel_at_period_end;
      } catch {
        /* brak dostępu — trudno, pokazujemy bez flagi */
      }

      setRows(
        (subs ?? []).map((s) => ({
          ...(s as SubRow),
          display_name: names[s.user_id] || undefined,
          cancel_at_period_end: paddleFlags[s.user_id] ?? null,
        }))
      );
    } catch (e: any) {
      toast.error("Nie udało się pobrać subskrypcji: " + (e?.message || "błąd"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Realtime (jeśli tabela jest w publikacji) + odświeżanie po powrocie do karty
    const channel = supabase
      .channel("admin-user-subscriptions")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_subscriptions" }, () => void load())
      .subscribe();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [load]);

  // Wyszukiwarka użytkowników do przyznania planu
  useEffect(() => {
    if (grantSearch.trim().length < 2) {
      setGrantMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .ilike("display_name", `%${grantSearch.trim()}%`)
        .limit(6);
      setGrantMatches(data ?? []);
    }, 350);
    return () => clearTimeout(t);
  }, [grantSearch]);

  const setPlanFor = async (userId: string, plan: PlanValue, label: string) => {
    setSavingUserId(userId);
    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            plan,
            status: plan === "free" ? "inactive" : "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success(`Ustawiono plan ${plan.toUpperCase()} dla ${label}`);
      await load();
    } catch (e: any) {
      toast.error("Nie udało się zapisać: " + (e?.message || "błąd"));
    } finally {
      setSavingUserId(null);
    }
  };

  const grantTo = async (userId: string, name: string | null) => {
    setGranting(true);
    await setPlanFor(userId, grantPlan, name || userId.slice(0, 8));
    setGranting(false);
    setGrantSearch("");
    setGrantMatches([]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.display_name ?? "").toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q) ||
        r.plan.includes(q) ||
        r.status.includes(q)
    );
  }, [rows, query]);

  const activeCount = rows.filter((r) => r.status === "active" && r.plan !== "free").length;

  // Podsumowanie płatności: ilu płaci, rozbicie planów, ile opłat w tym miesiącu.
  const summary = useMemo(() => {
    const active = rows.filter((r) => r.status === "active" && r.plan !== "free");
    const pro = active.filter((r) => r.plan === "pro").length;
    const ultimate = active.filter((r) => r.plan === "ultimate").length;
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonth = active.filter((r) => r.updated_at && new Date(r.updated_at).getTime() >= mStart).length;
    return { total: active.length, pro, ultimate, thisMonth };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Nagłówek + statystyki */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-accent" />
          <h3 className="font-display font-semibold text-lg">Subskrypcje</h3>
          <Badge variant="secondary">{activeCount} aktywnych płatnych</Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Odśwież
        </Button>
      </div>

      {/* Podsumowanie płatności */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: "Płacący (aktywni)", value: summary.total, sub: "wszyscy z aktywnym planem" },
          { label: "PRO", value: summary.pro, sub: "aktywnych" },
          { label: "ULTIMATE", value: summary.ultimate, sub: "aktywnych" },
          { label: "Opłaty w tym mies.", value: summary.thisMonth, sub: "nowi / odnowieni" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className="font-display text-2xl font-extrabold tabular-nums">{loading ? "…" : t.value}</div>
            <div className="text-[10px] text-muted-foreground/70">{t.sub}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Źródło: tabela <b>user_subscriptions</b> (lustro Paddle, aktualizowane triggerem na żywo). Pełna prawda o pieniądzach: panel <b>Paddle</b> oraz dashboard Paddle (Transactions).
      </p>

      {/* Przyznaj plan ręcznie */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserPlus className="h-4 w-4 text-primary" />
          Przyznaj / popraw plan użytkownikowi
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={grantSearch}
              onChange={(e) => setGrantSearch(e.target.value)}
              placeholder="Szukaj po nazwie użytkownika (np. DaWi)…"
              className="pl-9"
            />
            {grantMatches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                {grantMatches.map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => void grantTo(m.user_id, m.display_name)}
                    disabled={granting}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    <span>{m.display_name || "(bez nazwy)"}</span>
                    <span className="text-[10px] text-muted-foreground">{m.user_id.slice(0, 8)}…</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Select value={grantPlan} onValueChange={(v) => setGrantPlan(v as PlanValue)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="ultimate">Ultimate</SelectItem>
              <SelectItem value="free">Free (odbierz)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Kliknięcie użytkownika z listy od razu zapisuje wybrany plan. Klient zobaczy zmianę
          w „Zarządzaj subskrypcją" po odświeżeniu (max 1 min).
        </p>
      </div>

      {/* Filtr listy */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtruj listę…"
          className="pl-9"
        />
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground bg-secondary/40">
          <span>Użytkownik</span>
          <span>Plan</span>
          <span className="hidden sm:block">Koniec okresu</span>
          <span>Akcja</span>
        </div>
        {loading && rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline-block" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Brak subskrypcji do wyświetlenia.
          </div>
        ) : (
          filtered.map((r) => {
            const badge = PLAN_BADGE[r.plan] ?? PLAN_BADGE.free;
            const inactive = r.status !== "active";
            return (
              <div
                key={r.user_id}
                className={cn(
                  "grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-4 py-2.5 border-t border-border text-sm",
                  inactive && "opacity-70"
                )}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.display_name || "(bez nazwy)"}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>{r.user_id.slice(0, 8)}…</span>
                    {inactive && (
                      <span className="inline-flex items-center gap-0.5 text-destructive">
                        <XCircle className="h-3 w-3" /> anulowana / nieaktywna
                      </span>
                    )}
                    {r.cancel_at_period_end === true && r.status === "active" && (
                      <span className="inline-flex items-center gap-0.5 text-amber-400">
                        <Calendar className="h-3 w-3" /> anuluje się z końcem okresu
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-extrabold", badge.cls)}>
                  {badge.label}
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground">
                  {r.current_period_end
                    ? new Date(r.current_period_end).toLocaleDateString("pl-PL")
                    : "—"}
                </span>
                <Select
                  value={r.plan}
                  onValueChange={(v) =>
                    void setPlanFor(r.user_id, v as PlanValue, r.display_name || r.user_id.slice(0, 8))
                  }
                  disabled={savingUserId === r.user_id}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    {savingUserId === r.user_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <SelectValue />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="ultimate">Ultimate</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Lista odświeża się automatycznie (na żywo lub co minutę). Anulowanie przez klienta
        w Paddle pojawi się tu jako „anulowana / nieaktywna" po zakończeniu okresu, a jeśli
        baza ma politykę odczytu Paddle dla admina — od razu jako „anuluje się z końcem okresu".
      </p>
    </div>
  );
}
