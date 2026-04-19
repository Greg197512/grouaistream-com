import { useEffect, useState } from "react";
import { Crown, ExternalLink, Loader2, X, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { getPaddleEnvironment } from "@/lib/paddle";

interface PaddleSubRow {
  status: string;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
}

export function SubscriptionManager() {
  const { plan, isPro, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [sub, setSub] = useState<PaddleSubRow | null>(null);

  const env = getPaddleEnvironment();

  // Fetch the live row to surface cancel-date and past-due status
  useEffect(() => {
    if (!user || !isPro) {
      setSub(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, cancel_at_period_end, current_period_end")
        .eq("user_id", user.id)
        .eq("environment", env)
        .maybeSingle();
      if (!cancelled) setSub(data ?? null);
    })();
    return () => { cancelled = true; };
  }, [user, isPro, env, plan]);

  const handleOpenPortal = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { action: "portal", environment: env },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Brak adresu portalu");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      const msg = e?.message?.includes("no_subscription")
        ? "Nie masz aktywnej subskrypcji do zarządzania."
        : "Nie udało się otworzyć portalu: " + (e?.message || "spróbuj ponownie");
      toast.error(msg);
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleCancel = async () => {
    setLoadingCancel(true);
    try {
      const { error } = await supabase.functions.invoke("customer-portal", {
        body: { action: "cancel", environment: env },
      });
      if (error) throw error;
      toast.success("Subskrypcja zostanie anulowana na koniec okresu rozliczeniowego.");
      setConfirmCancel(false);
      await refreshSubscription();
    } catch (e: any) {
      toast.error("Nie udało się anulować: " + (e?.message || "spróbuj ponownie"));
    } finally {
      setLoadingCancel(false);
    }
  };

  if (!isPro) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <p className="text-sm text-muted-foreground">
          Korzystasz z planu <strong className="text-foreground">Free</strong>. Wybierz Pro lub Ultimate, aby odblokować pełnię GrouAI Stream.
        </p>
      </div>
    );
  }

  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const isCanceling = sub?.cancel_at_period_end === true;
  const isPastDue = sub?.status === "past_due";

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-accent" />
        <span className="font-display font-semibold capitalize">Plan {plan}</span>
      </div>

      {/* Past-due banner — payment failed */}
      {isPastDue && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-destructive">Ostatnia płatność nie powiodła się</div>
            <div className="text-muted-foreground mt-0.5">
              Zaktualizuj metodę płatności, aby zachować dostęp do funkcji premium.
            </div>
          </div>
        </div>
      )}

      {/* Cancel-scheduled banner */}
      {isCanceling && periodEnd && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <Calendar className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-amber-300">Subskrypcja zostanie anulowana</div>
            <div className="text-muted-foreground mt-0.5">
              Zachowasz dostęp do {periodEnd.toLocaleDateString("pl-PL", { dateStyle: "long" })}. Możesz wznowić w portalu klienta.
            </div>
          </div>
        </div>
      )}

      {/* Active period info */}
      {periodEnd && !isCanceling && !isPastDue && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Następna płatność: {periodEnd.toLocaleDateString("pl-PL", { dateStyle: "long" })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Zarządzaj metodą płatności, fakturami lub anuluj subskrypcję. Płatności obsługuje Paddle (Merchant of Record).
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleOpenPortal}
          disabled={loadingPortal}
          variant="outline"
          className="gap-2"
        >
          {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {isPastDue ? "Zaktualizuj płatność" : "Zarządzaj subskrypcją"}
        </Button>
        {!isCanceling && (
          <Button
            onClick={() => setConfirmCancel(true)}
            variant="ghost"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
            Anuluj subskrypcję
          </Button>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulować subskrypcję?</AlertDialogTitle>
            <AlertDialogDescription>
              Zachowasz dostęp do funkcji premium do końca bieżącego okresu rozliczeniowego
              {periodEnd ? ` (${periodEnd.toLocaleDateString("pl-PL", { dateStyle: "long" })})` : ""}.
              Wyślemy Ci e-mail z potwierdzeniem oraz przypomnienie 24h przed wygaśnięciem.
              Możesz wznowić w dowolnym momencie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingCancel}>Wróć</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={loadingCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loadingCancel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tak, anuluj"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
