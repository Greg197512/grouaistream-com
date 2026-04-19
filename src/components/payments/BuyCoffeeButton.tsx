import { useState } from "react";
import { Coffee, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { openPaddleCheckout } from "@/lib/paddle";
import { cn } from "@/lib/utils";

interface BuyCoffeeButtonProps {
  recipientUserId?: string;
  recipientTrackId?: string;
  recipientName?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

const COFFEE_OPTIONS = [
  { id: "grouai_coffee_black", amount: 1, label: "Czarna kawa", emoji: "☕", desc: "Mały gest, wielka moc" },
  { id: "grouai_coffee_latte", amount: 3, label: "Latte", emoji: "☕🥛", desc: "Aksamitne wsparcie" },
  { id: "grouai_coffee_irish", amount: 5, label: "Kawa irlandzka", emoji: "☕🥃", desc: "Z nutą whisky 🔥" },
];

export function BuyCoffeeButton({
  recipientUserId,
  recipientTrackId,
  recipientName,
  variant = "outline",
  size = "sm",
  className,
  label,
}: BuyCoffeeButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();

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
      setOpen(false);
    } catch (e: any) {
      toast.error("Nie udało się otworzyć płatności: " + (e?.message || "spróbuj ponownie"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={cn("gap-1.5", className)}
      >
        <Coffee className="h-4 w-4" />
        <span>{label || "Kup nam kawę"}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-primary" />
              Postaw kawę {recipientName ? `dla ${recipientName}` : "GrouAI"}
            </DialogTitle>
            <DialogDescription>
              Każda kawa pomaga nam budować coś większego. Płatność jednorazowa, bez subskrypcji.
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
        </DialogContent>
      </Dialog>
    </>
  );
}
