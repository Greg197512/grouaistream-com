import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Rocket, TrendingUp, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { notifyN8nNewSubscriber } from "@/lib/newsletterNotify";

// 🧲 Artist Magnet — legalny lejek pozyskiwania artystów.
// Artysta SAM zostawia maila (opt-in), w sekundę dostaje pitch GrouAI
// (muzyka + zarabianie + szybkie wejście na Spotify) przez istniejący
// welcome-flow w n8n. Po zapisie: haczyk wirusowy "poleć 2 znajomych".
// Zero scrapowania, zero spamu — domena bezpieczna, a maile chcą z Tobą gadać.

interface ArtistMagnetProps {
  source?: string;
}

export function ArtistMagnet({ source = "artist_magnet" }: ArtistMagnetProps) {
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

    // Best-effort: odpal welcome-flow (pitch artystyczny) w n8n.
    notifyN8nNewSubscriber(trimmed, source);

    setDone(true);
    setLoading(false);
    toast.success("Jesteś na liście! 🎧 Sprawdź skrzynkę — pierwszy krok już leci.");
  };

  if (done) {
    return (
      <div className="my-12 p-8 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card/40 to-accent/10 text-center">
        <div className="flex items-center justify-center gap-2 text-primary mb-3">
          <Check className="w-6 h-6" />
          <span className="text-xl font-black">Witamy na pokładzie GrouAI 🚀</span>
        </div>
        <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
          Mail z pierwszym krokiem właśnie leci do Twojej skrzynki. Chcesz szybciej?
          Podziel się GrouAI z 2 znajomymi artystami — obaj dostajecie priorytet w kolejce.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            const shareUrl = "https://grouaistream.com";
            const shareText =
              "Wbijam się na Spotify przez GrouAI Stream — muzyka, zarabianie i szybkie wejście. Sprawdź:";
            if (navigator.share) {
              navigator.share({ title: "GrouAI Stream", text: shareText, url: shareUrl }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(`${shareText} ${shareUrl}`);
              toast.success("Link skopiowany — wyślij go znajomym artystom!");
            }
          }}
        >
          <Share2 className="w-4 h-4 mr-2" /> Poleć 2 znajomych = priorytet
        </Button>
      </div>
    );
  }

  return (
    <div className="my-12 p-6 sm:p-10 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/40 to-accent/10 text-center shadow-[0_0_50px_hsl(var(--primary)/0.15)]">
      <Music className="w-12 h-12 text-primary mx-auto mb-4" />
      <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
        Wbij się na Spotify — szybciej, z GrouAI
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-lg mx-auto">
        Jesteś artystą? Zostaw maila, a pokażemy Ci jak puścić swoją muzykę w obieg,
        zacząć na niej zarabiać i skrócić drogę na Spotify. Bez ściemy. Zero spamu —
        wypiszesz się jednym kliknięciem.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-7 text-xs sm:text-sm">
        <span className="inline-flex items-center gap-1.5 text-foreground/80">
          <Music className="w-4 h-4 text-primary" /> Twoja muzyka w obiegu
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground/80">
          <TrendingUp className="w-4 h-4 text-primary" /> Realne zarabianie
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground/80">
          <Rocket className="w-4 h-4 text-primary" /> Szybka droga na Spotify
        </span>
      </div>

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
          {loading ? "Zapisuję…" : "Chcę wejść na Spotify"}
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground/70 mt-3">
        Zapisując się akceptujesz kontakt mailowy od GrouAI Stream. Wypisanie zawsze jednym kliknięciem.
      </p>
    </div>
  );
}
