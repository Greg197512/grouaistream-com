import { useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingUp, Heart, Rocket, CheckCircle,
  BarChart3, CreditCard, ShieldCheck, Star, ChevronDown, ChevronUp,
  Zap, Crown, ArrowRight, Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" },
  }),
};

const earningMethods = [
  {
    icon: TrendingUp,
    title: "Royalties ze streamów",
    percent: "65%",
    color: "from-emerald-500 to-green-600",
    borderColor: "border-emerald-500/30",
    bgGlow: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    details: [
      "Dostajesz 65% z każdego odsłuchania swojego utworu",
      "Im więcej słuchają → tym więcej zarabiasz",
      "Automatyczne naliczanie co miesiąc",
    ],
  },
  {
    icon: Heart,
    title: "Tipy od słuchaczy",
    percent: "90%",
    color: "from-amber-500 to-yellow-500",
    borderColor: "border-amber-500/30",
    bgGlow: "bg-amber-500/10",
    iconColor: "text-amber-400",
    details: [
      "Dostajesz 90% z każdej dobrowolnej wpłaty",
      'Przycisk „Wesprzyj artystę" przy każdym utworze',
      "Słuchacze mogą dać 5 zł, 10 zł, 20 zł lub dowolną kwotę",
    ],
  },
  {
    icon: Rocket,
    title: "Pakiety Verified Streams",
    percent: "100%",
    color: "from-primary to-accent",
    borderColor: "border-primary/30",
    bgGlow: "bg-primary/10",
    iconColor: "text-primary",
    details: [
      "Kupujesz promocję swojego utworu",
      "Dostajesz 100% zysku z pakietu",
      "Przyspieszasz wzrost odsłuchań i widoczności",
    ],
  },
];

const benefits = [
  { icon: CreditCard, text: "Wypłaty co miesiąc bezpośrednio na konto bankowe (Stripe)" },
  { icon: DollarSign, text: "Minimalna wypłata tylko 50 zł" },
  { icon: BarChart3, text: "Szczegółowe statystyki zarobków i streamów" },
  { icon: ShieldCheck, text: "Badge „Monetyzowany" przy Twoich utworach" },
  { icon: Star, text: "Priorytet w playlistach i rekomendacjach" },
  { icon: Sparkles, text: "Wsparcie AI w promocji Twojej muzyki" },
];

const faqItems = [
  {
    q: "Ile naprawdę mogę zarobić?",
    a: "To zależy od liczby streamów i tipów. Przy 10 000 odsłuchań miesięcznie zarobisz ok. 19,50 zł z royalties. Dodaj do tego tipy od fanów i promocję — realne zarobki rosną szybko. Najaktywniejsi twórcy zarabiają kilkaset złotych miesięcznie.",
  },
  {
    q: "Kiedy dostaję pieniądze?",
    a: "Wypłaty realizujemy co miesiąc przez Stripe. Minimalna kwota do wypłaty to 50 zł. Po przekroczeniu progu możesz zlecić wypłatę w dowolnym momencie z panelu zarobków.",
  },
  {
    q: "Czy mogę wyłączyć monetyzację w każdej chwili?",
    a: "Tak! W panelu zarobków (/earnings) możesz włączyć lub wyłączyć monetyzację dla każdego utworu osobno. Nie ma żadnych zobowiązań ani umów.",
  },
  {
    q: "Czy muzyka z Suno też może zarabiać?",
    a: "Tak — utwory wygenerowane z Suno AI, które przejdą naszą moderację jakości, mogą być monetyzowane na równi z oryginalnymi nagraniami. Warunek: musisz mieć prawa do dystrybucji.",
  },
];

const EarnWithUs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-16 pb-32">
        {/* Hero */}
        <motion.section
          initial="hidden"
          animate="visible"
          className="text-center pt-8 space-y-6"
        >
          <motion.div variants={fadeUp} custom={0}>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-sm px-4 py-1 mb-4">
              <DollarSign className="h-4 w-4 mr-1" />
              Program monetyzacji
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight"
          >
            Zarabiaj na swojej muzyce
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-amber-400 to-primary bg-clip-text text-transparent">
              — naprawdę i regularnie
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto"
          >
            Dołącz do twórców, którzy już zarabiają na GrouAI Stream.
            Dostawaj pieniądze za każdy odsłuch, tipy i promocję swoich utworów.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex items-center justify-center gap-3 pt-2">
            <div className="flex -space-x-2">
              {["🎤", "🎸", "🎹", "🎧"].map((e, i) => (
                <div
                  key={i}
                  className="h-10 w-10 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-lg"
                >
                  {e}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">127+</span> twórców już zarabia
            </p>
          </motion.div>
        </motion.section>

        {/* Earning Methods */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-8"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-2xl font-bold text-center"
          >
            Trzy sposoby na zarobek
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {earningMethods.map((method, i) => {
              const Icon = method.icon;
              return (
                <motion.div key={i} variants={fadeUp} custom={i + 1}>
                  <Card
                    className={cn(
                      "relative overflow-hidden border bg-card/80 backdrop-blur hover:scale-[1.02] transition-transform",
                      method.borderColor
                    )}
                  >
                    {/* Glow */}
                    <div
                      className={cn(
                        "absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-20",
                        method.bgGlow
                      )}
                    />

                    <CardContent className="relative p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-xl bg-gradient-to-br",
                            method.color
                          )}
                        >
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{method.title}</h3>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span
                          className={cn(
                            "text-4xl font-black",
                            method.iconColor
                          )}
                        >
                          {method.percent}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          dla Ciebie
                        </span>
                      </div>

                      <ul className="space-y-2">
                        {method.details.map((d, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Benefits */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-6"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-2xl font-bold text-center"
          >
            Dodatkowe korzyści
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 1}
                  className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <Icon className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <span className="text-sm">{b.text}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="relative"
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            className="relative overflow-hidden rounded-2xl border border-emerald-500/20 p-8 sm:p-12 text-center space-y-6"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-amber-500/10" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

            <div className="relative space-y-4">
              <Crown className="h-12 w-12 text-amber-400 mx-auto" />
              <h2 className="text-2xl sm:text-3xl font-extrabold">
                Gotowy, żeby zarabiać?
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Włącz monetyzację swoich utworów i zacznij otrzymywać pieniądze za każdy stream i tip od słuchaczy.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold px-8 gap-2"
                  onClick={() =>
                    user ? navigate("/earnings") : navigate("/auth")
                  }
                >
                  Włącz monetyzację teraz
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/10 gap-2"
                  onClick={() => navigate("/upload")}
                >
                  <Zap className="h-4 w-4" />
                  Wrzuć swój utwór
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* FAQ */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-6"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-2xl font-bold text-center"
          >
            Najczęściej zadawane pytania
          </motion.h2>

          <div className="max-w-2xl mx-auto space-y-3">
            {faqItems.map((faq, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i + 1}
                className="border border-white/10 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <span className="font-medium text-sm">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-4 pb-4"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground">
          💎 GrouAI Stream — platforma, która naprawdę płaci artystom.
          <br />
          <span className="text-[10px]">
            Program monetyzacji podlega{" "}
            <span
              className="underline cursor-pointer hover:text-foreground"
              onClick={() => navigate("/legal")}
            >
              regulaminowi platformy
            </span>
            .
          </span>
        </p>
      </div>
    </MainLayout>
  );
};

export default EarnWithUs;
