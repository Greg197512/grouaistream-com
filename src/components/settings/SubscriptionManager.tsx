import { useState } from "react";
import { Crown, ExternalLink, Loader2, X } from "lucide-react";
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
import { getPaddleEnvironment } from "@/lib/paddle";

export function SubscriptionManager() {
  const { plan, isPro, refreshSubscription } = useSubscription();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const env = getPaddleEnvironment();

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

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-accent" />
        <span className="font-display font-semibold capitalize">Plan {plan}</span>
      </div>
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
          Zarządzaj subskrypcją
        </Button>
        <Button
          onClick={() => setConfirmCancel(true)}
          variant="ghost"
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4" />
          Anuluj subskrypcję
        </Button>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulować subskrypcję?</AlertDialogTitle>
            <AlertDialogDescription>
              Zachowasz dostęp do funkcji premium do końca bieżącego okresu rozliczeniowego.
              Nie zostaniesz obciążony ponownie. Możesz wznowić w dowolnym momencie.
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
