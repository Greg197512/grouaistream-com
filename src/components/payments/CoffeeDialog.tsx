import { useState } from "react";
import { Coffee, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { openPaddleCheckout } from "@/lib/paddle";

export const COFFEE_OPTIONS = [
  { id: "grouai_coffee_black", amount: 1, label: "Czarna kawa", emoji: "☕", desc: "Mały gest, wielka moc" },
  { id: "grouai_coffee_latte", amount: 3, label: "Latte", emoji: "☕🥛", desc: "Aksamitne wsparcie" },
  { id: "grouai_coffee_irish", amount: 5, label: "Kawa irlandzka", emoji: "☕🥃", desc: "Z nutą whisky 🔥" },
];

interface CoffeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Twórca utworu (uzyskuje 90% kawy do wypłaty) */
  recipientUserId?: string;
  /** Konkretny utwór, do którego przypisana jest kawa */
  recipientTrackId?: string;
  /** Wyświetlana nazwa odbiorcy ("Postaw kawę dla {recipientName}") */
  recipientName?: string;
  /** Opcjonalny callback po udanym otwarciu checkoutu */
  onCheckoutOpened?: () => void;
}

/**
 * Reużywalny dialog "Postaw kawę" — uruchamia Paddle one-time checkout
 * z opcjami 1€/3€/5€. Kontrolowany przez parent (open / onOpenChange).
 *
 * Webhook (payments-webhook) zapisuje kawę do `one_time_purchases` oraz
 * nabija `creator_earnings` typu `tip` (90% kwoty) na `recipientUserId`.
 */
export function CoffeeDialog({
  open,
  onOpenChange,
  recipientUserId,
  recipientTrackId,
  recipientName,
  onCheckoutOpened,
}: CoffeeDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (priceId: string) => {
    if (!user) {
      toast.error("Zaloguj się, aby postawić kawę");
      return;
    }
    setLoading(priceId);
    try {
      const customData: Record<string, string> = { userId: user.id };
      if (recipientUserId) customData.recipientUserId = recipientUserId;
      if (recipientTrackId) customData.recipientTrackId = recipientTrackId;

      await openPaddleCheckout({
        priceId,
        customerEmail: user.email,
        customData,
        successUrl: `${window.location.origin}/?coffee=success`,
      });
      onCheckoutOpened?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Nie udało się otworzyć płatności: " + (e?.message || "spróbuj ponownie"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            Postaw kawę {recipientName ? `dla ${recipientName}` : "GrouAI"}
          </DialogTitle>
          <DialogDescription>
            Płatność jednorazowa, bez subskrypcji.{" "}
            {recipientUserId
              ? "90% trafia prosto do twórcy utworu."
              : "Każda kawa pomaga nam budować coś większego."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 py-2">
          {COFFEE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleBuy(opt.id)}
              disabled={loading !== null}
              className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 hover:bg-secondary hover:border-primary/50 transition-colors p-4 text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{opt.emoji}</span>
                <div>
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </div>
              {loading === opt.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <span className="text-lg font-bold text-primary">{opt.amount}€</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-secondary/40 rounded-lg p-2.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>
            Bezpieczne płatności obsługiwane przez Paddle · VAT, faktura i zwrot 30 dni wliczone
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
