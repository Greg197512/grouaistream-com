import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Megaphone, Globe2, Handshake, Check } from "lucide-react";
import { openPaddleCheckout } from "@/lib/paddle";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PACKAGES = [
  {
    id: "aurora_sponsored_blog_one",
    icon: Megaphone,
    name: "Sponsored Blog Post",
    price: "9,99 €",
    badge: "Najpopularniejsze",
    desc: "Twoja marka w jednym z artykułów Aurory na blogu GrouAI Stream.",
    bullets: [
      "Logo + krótki copy + link dofollow",
      "Aurora promuje artykuł w SEO i newsletterze",
      "Średnio 2–4 tys. wyświetleń / miesiąc",
    ],
  },
  {
    id: "aurora_niche_landing_monthly",
    icon: Globe2,
    name: "Niche Landing Sponsorship",
    price: "19,99 €/mies",
    badge: "Subskrypcja",
    desc: "Bądź sponsorem dedykowanej strony niszowej (/n/dj-na-wesele, /n/muzyka-do-medytacji…).",
    bullets: [
      "Sekcja sponsora bezpośrednio na landing page",
      "Twoja oferta widoczna obok hero",
      "Możesz wybrać konkretną niszę",
    ],
  },
  {
    id: "aurora_partnership_boost_one",
    icon: Handshake,
    name: "Partnership Boost",
    price: "49 €",
    badge: "1× akcja",
    desc: "Aurora pisze dla Ciebie newsletter + post na bloga + scenariusz TikTok.",
    bullets: [
      "Dedykowany newsletter do całej bazy",
      "Wpis na blogu z naturalnym przepleceniem oferty",
      "Scenariusz Reela 30s gotowy do nagrania",
    ],
  },
];

export default function SponsorPage() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Sponsoring Aurora — wesprzyj nas, dotrzyj do naszych słuchaczy";
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", "Promuj swoją markę w ekosystemie GrouAI Stream przez sponsoring blogowy, niszowych landingów lub akcję partnerską z Aurorą.");
  }, []);

  const buy = async (priceId: string) => {
    setLoading(true);
    try {
      await openPaddleCheckout({
        priceId,
        quantity: 1,
        customerEmail: user?.email,
        customData: { userId: user?.id || "guest", source: "sponsor_page" },
        successUrl: `${window.location.origin}/sponsor?success=1`,
      });
    } catch (e: any) {
      toast.error(e?.message || "Nie udało się otworzyć checkoutu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-background" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-xs text-primary mb-6">
            <Sparkles className="h-3 w-3" /> Aurora — autonomiczny mózg GrouAI Stream
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
            Wejdź w świat, w którym muzyka słucha ludzi.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Aurora codziennie pisze blogi, landingi i newslettery dla tysięcy słuchaczy GrouAI Stream.
            Wybierz format, w którym chcesz być widziany.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {PACKAGES.map((p) => {
            const Icon = p.icon;
            return (
              <Card key={p.id} className="flex flex-col border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="h-6 w-6 text-primary" />
                    {p.badge && <Badge variant="secondary">{p.badge}</Badge>}
                  </div>
                  <CardTitle className="text-xl mt-2">{p.name}</CardTitle>
                  <div className="text-3xl font-bold">{p.price}</div>
                  <CardDescription>{p.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 text-sm flex-1">
                    {p.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-6" disabled={loading} onClick={() => buy(p.id)}>
                    {loading ? "Ładowanie…" : "Wesprzyj i wybierz format"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground space-y-2">
          <p>Płatności obsługiwane przez Paddle (Merchant of Record). Faktura VAT dostępna automatycznie.</p>
          <p>
            Pytania?{" "}
            <Link to="/legal" className="text-primary hover:underline">Regulamin & polityka zwrotów</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
