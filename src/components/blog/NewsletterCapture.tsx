import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

interface NewsletterCaptureProps {
  variant?: "inline" | "card";
  source?: string;
}

export function NewsletterCapture({ variant = "card", source = "blog_inline" }: NewsletterCaptureProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Wpisz poprawny adres e-mail");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("blog_newsletter_subscribers")
      .insert({ email: trimmed, source });

    if (error && !error.message.includes("duplicate")) {
      toast.error("Nie udało się zapisać. Spróbuj ponownie.");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    toast.success("Jesteś w klubie! 🎉 Świeży AI/muzyka — codziennie w skrzynce.");
  };

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 rounded-2xl border border-primary/40 bg-primary/10 text-primary">
        <Check className="w-5 h-5" />
        <span className="font-bold">Witaj w klubie. Pierwszy newsletter już leci.</span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 my-8 p-5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 text-primary font-bold text-sm">
            <Sparkles className="w-4 h-4" /> Nie przegap kolejnego newsa AI
          </div>
          <p className="text-xs text-muted-foreground">Codziennie świeże artykuły o AI, muzyce i monetyzacji. Zero spamu.</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="twój@email.pl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background/60 border-border min-w-[200px]"
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Zapisz"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="my-12 p-6 sm:p-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/40 to-accent/10 text-center shadow-[0_0_40px_hsl(var(--primary)/0.15)]">
      <Mail className="w-10 h-10 text-primary mx-auto mb-3" />
      <h3 className="text-2xl font-black text-foreground mb-2">Codziennie nowe newsy AI w Twojej skrzynce</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
        Najświeższe trendy, narzędzia i analizy ze świata AI i muzyki. Pisane bez ściemy. Zero spamu, możesz wypisać się jednym kliknięciem.
      </p>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
        <Input
          type="email"
          placeholder="twój@email.pl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-background/60 border-border"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Zapisuję…" : "Dołącz"}
        </Button>
      </form>
    </div>
  );
}
