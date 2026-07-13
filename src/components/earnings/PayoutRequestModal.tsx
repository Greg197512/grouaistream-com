import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Wallet, Clock } from "lucide-react";

interface PayoutRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableAmount: number;
  onSuccess: () => void;
}

export const PayoutRequestModal = ({ open, onOpenChange, availableAmount, onSuccess }: PayoutRequestModalProps) => {
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) return toast.error("Wpisz imię i nazwisko");
    if (city.trim().length < 2) return toast.error("Wpisz miejscowość");
    if (bankAccount.replace(/\s/g, "").length < 10) return toast.error("Numer konta jest za krótki");

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_payout_request", {
        _full_name: fullName,
        _city: city,
        _bank_account: bankAccount,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        if (result?.error === "insufficient_balance") {
          toast.error(`Niewystarczające saldo (${Number(result.available || 0).toFixed(2)} $)`);
        } else if (result?.error === "invalid_data") {
          toast.error("Nieprawidłowe dane");
        } else {
          toast.error("Błąd wypłaty");
        }
        return;
      }
      toast.success(`Wniosek o wypłatę ${Number(result.amount).toFixed(2)} $ został wysłany ✅`);
      setFullName(""); setCity(""); setBankAccount("");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Błąd");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Wypłata środków
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-2">
            <Clock className="h-4 w-4 text-primary" />
            Pieniądze zostaną przesłane w ciągu <strong>24 godzin</strong> po zatwierdzeniu.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase">Do wypłaty</p>
          <p className="text-3xl font-bold text-primary">{availableAmount.toFixed(2)} $</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Imię i nazwisko *</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jan Kowalski" maxLength={100} required />
          </div>
          <div>
            <Label htmlFor="city">Miejscowość *</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Warszawa" maxLength={80} required />
          </div>
          <div>
            <Label htmlFor="bankAccount">Numer konta (IBAN) *</Label>
            <Input id="bankAccount" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="PL00 0000 0000 0000 0000 0000 0000" maxLength={40} required />
          </div>
          <p className="text-xs text-muted-foreground">
            Twoje dane zostaną przekazane administratorowi tylko w celu realizacji wypłaty.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Anuluj</Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zatwierdź wypłatę"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
