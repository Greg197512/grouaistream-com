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
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { Easing } from "framer-motion";

const ease: Easing = [0.25, 0.1, 0.25, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease },
  }),
};

const EarnWithUs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const earningMethods = [
    {
      icon: TrendingUp,
      title: t("earnPage.royalties"),
      percent: "65%",
      color: "from-emerald-500 to-green-600",
      borderColor: "border-emerald-500/30",
      bgGlow: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      details: [t("earnPage.royaltiesD1"), t("earnPage.royaltiesD2"), t("earnPage.royaltiesD3")],
    },
    {
      icon: Heart,
      title: t("earnPage.tips"),
      percent: "90%",
      color: "from-amber-500 to-yellow-500",
      borderColor: "border-amber-500/30",
      bgGlow: "bg-amber-500/10",
      iconColor: "text-amber-400",
      details: [t("earnPage.tipsD1"), t("earnPage.tipsD2"), t("earnPage.tipsD3")],
    },
    {
      icon: Rocket,
      title: t("earnPage.verified"),
      percent: "100%",
      color: "from-primary to-accent",
      borderColor: "border-primary/30",
      bgGlow: "bg-primary/10",
      iconColor: "text-primary",
      details: [t("earnPage.verifiedD1"), t("earnPage.verifiedD2"), t("earnPage.verifiedD3")],
    },
  ];

  const benefits = [
    { icon: CreditCard, text: t("earnPage.b1") },
    { icon: DollarSign, text: t("earnPage.b2") },
    { icon: BarChart3, text: t("earnPage.b3") },
    { icon: ShieldCheck, text: t("earnPage.b4") },
    { icon: Star, text: t("earnPage.b5") },
    { icon: Sparkles, text: t("earnPage.b6") },
  ];

  const faqItems = [
    { q: t("earnPage.faq1q"), a: t("earnPage.faq1a") },
    { q: t("earnPage.faq2q"), a: t("earnPage.faq2a") },
    { q: t("earnPage.faq3q"), a: t("earnPage.faq3a") },
    { q: t("earnPage.faq4q"), a: t("earnPage.faq4a") },
  ];

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
              {t("earnPage.badge")}
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight"
          >
            {t("earnPage.title1")}
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-amber-400 to-primary bg-clip-text text-transparent">
              {t("earnPage.title2")}
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto"
          >
            {t("earnPage.subtitle")}
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
              <span className="text-foreground font-semibold">127+</span> {t("earnPage.creatorsCount")}
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
          <motion.h2 variants={fadeUp} custom={0} className="text-2xl font-bold text-center">
            {t("earnPage.threeWays")}
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {earningMethods.map((method, i) => {
              const Icon = method.icon;
              return (
                <motion.div key={i} variants={fadeUp} custom={i + 1}>
                  <Card className={cn("relative overflow-hidden border bg-card/80 backdrop-blur hover:scale-[1.02] transition-transform", method.borderColor)}>
                    <div className={cn("absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-20", method.bgGlow)} />
                    <CardContent className="relative p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-3 rounded-xl bg-gradient-to-br", method.color)}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-bold text-lg">{method.title}</h3>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={cn("text-4xl font-black", method.iconColor)}>{method.percent}</span>
                        <span className="text-sm text-muted-foreground">{t("earnPage.forYou")}</span>
                      </div>
                      <ul className="space-y-2">
                        {method.details.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
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
          <motion.h2 variants={fadeUp} custom={0} className="text-2xl font-bold text-center">
            {t("earnPage.benefits")}
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
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-amber-500/10" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
            <div className="relative space-y-4">
              <Crown className="h-12 w-12 text-amber-400 mx-auto" />
              <h2 className="text-2xl sm:text-3xl font-extrabold">{t("earnPage.ctaTitle")}</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">{t("earnPage.ctaDesc")}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold px-8 gap-2"
                  onClick={() => user ? navigate("/earnings") : navigate("/auth")}
                >
                  {t("earnPage.ctaButton")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" className="border-white/10 gap-2" onClick={() => navigate("/upload")}>
                  <Zap className="h-4 w-4" />
                  {t("earnPage.ctaUpload")}
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
          <motion.h2 variants={fadeUp} custom={0} className="text-2xl font-bold text-center">
            {t("earnPage.faq")}
          </motion.h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqItems.map((faq, i) => (
              <motion.div key={i} variants={fadeUp} custom={i + 1} className="border border-white/10 rounded-xl overflow-hidden">
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
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Creator Premium Plans */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-6"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-2xl font-bold text-center">
            {t("earnPage.premiumTitle")}
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-center text-muted-foreground text-sm max-w-xl mx-auto">
            {t("earnPage.premiumSubtitle")}
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Creator Pro */}
            <motion.div variants={fadeUp} custom={2}>
              <Card className="relative overflow-hidden border border-primary/30 bg-card/80 backdrop-blur">
                <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-20 bg-primary/10" />
                <CardContent className="relative p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Creator Pro</h3>
                      <Badge className="bg-primary/15 text-primary border-primary/25 text-[10px]">
                        {t("earnPage.mostPopular")}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-primary">4.49</span>
                    <span className="text-sm text-muted-foreground">€/{t("earnPage.month")}</span>
                  </div>
                  <ul className="space-y-2">
                    {["earnPage.creatorPro1", "earnPage.creatorPro2", "earnPage.creatorPro3", "earnPage.creatorPro4"].map((key) => (
                      <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full gap-2" onClick={() => user ? navigate("/earnings") : navigate("/auth")}>
                    <Zap className="h-4 w-4" />
                    {t("earnPage.choosePlan")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Creator Ultimate */}
            <motion.div variants={fadeUp} custom={3}>
              <Card className="relative overflow-hidden border border-amber-500/30 bg-card/80 backdrop-blur">
                <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-20 bg-amber-500/10" />
                <CardContent className="relative p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500">
                      <Crown className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Creator Ultimate</h3>
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px]">
                        {t("earnPage.maxEarnings")}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-amber-400">39</span>
                    <span className="text-sm text-muted-foreground">zł/{t("earnPage.month")}</span>
                  </div>
                  <ul className="space-y-2">
                    {["earnPage.creatorUlt1", "earnPage.creatorUlt2", "earnPage.creatorUlt3", "earnPage.creatorUlt4", "earnPage.creatorUlt5"].map((key) => (
                      <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-600 hover:to-yellow-600" onClick={() => user ? navigate("/earnings") : navigate("/auth")}>
                    <Crown className="h-4 w-4" />
                    {t("earnPage.choosePlan")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.section>

        {/* Suno monetization info */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            className="max-w-2xl mx-auto flex items-start gap-3 p-5 rounded-xl border border-purple-500/20 bg-purple-500/5"
          >
            <Sparkles className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("earnPage.sunoMonetize")}</p>
            </div>
          </motion.div>
        </motion.section>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground">
          💎 {t("earnPage.footer")}
          <br />
          <span className="text-[10px]">
            Program monetyzacji podlega{" "}
            <span className="underline cursor-pointer hover:text-foreground" onClick={() => navigate("/legal")}>
              {t("earnPage.terms")}
            </span>
            .
          </span>
        </p>
      </div>
    </MainLayout>
  );
};

export default EarnWithUs;
