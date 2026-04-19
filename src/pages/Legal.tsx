import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileText, Scale, Cookie, Copyright, Globe, RefreshCw, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Legal = () => {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Scale className="h-8 w-8 text-primary" />
          <h1 className="font-display text-3xl font-bold">{t("legal.title")}</h1>
        </div>
        <p className="text-muted-foreground mb-8">{t("legal.subtitle")}</p>

        <Tabs defaultValue="terms" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 mb-6 h-auto">
            <TabsTrigger value="terms" className="gap-1 text-xs"><FileText className="h-3 w-3" />{t("legal.terms")}</TabsTrigger>
            <TabsTrigger value="privacy" className="gap-1 text-xs"><Shield className="h-3 w-3" />{t("legal.privacy")}</TabsTrigger>
            <TabsTrigger value="refunds" className="gap-1 text-xs"><RefreshCw className="h-3 w-3" />Refunds</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1 text-xs"><CreditCard className="h-3 w-3" />Payments</TabsTrigger>
            <TabsTrigger value="copyright" className="gap-1 text-xs"><Copyright className="h-3 w-3" />{t("legal.copyright")}</TabsTrigger>
            <TabsTrigger value="cookies" className="gap-1 text-xs"><Cookie className="h-3 w-3" />{t("legal.cookies")}</TabsTrigger>
            <TabsTrigger value="gdpr" className="gap-1 text-xs"><Globe className="h-3 w-3" />{t("legal.gdpr")}</TabsTrigger>
          </TabsList>

          {/* TERMS */}
          <TabsContent value="terms">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">{t("legal.terms.heading")}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{t("legal.lastUpdate")}</p>

              <Section title={t("legal.terms.s1.title")}>
                <p>{t("legal.terms.s1.p1")}</p>
                <p>{t("legal.terms.s1.p2")}</p>
                <p>{t("legal.terms.s1.p3")}</p>
              </Section>

              <Section title={t("legal.terms.s2.title")}>
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-3">
                  <p className="font-semibold text-accent text-sm">{t("legal.terms.s2.badge")}</p>
                  <p className="text-xs text-muted-foreground mt-2">{t("legal.terms.s2.badgeDesc")}</p>
                </div>
                <p>{t("legal.terms.s2.p1")}</p>
                <p>{t("legal.terms.s2.p2")}</p>
                <p>{t("legal.terms.s2.p3")}</p>
                <p>{t("legal.terms.s2.p4")}</p>
              </Section>

              <Section title={t("legal.terms.s3.title")}>
                <p>{t("legal.terms.s3.p1")}</p>
                <p>{t("legal.terms.s3.p2")}</p>
                <p>{t("legal.terms.s3.p3")}</p>
              </Section>

              <Section title={t("legal.terms.s4.title")}>
                <p>{t("legal.terms.s4.p1")}</p>
                <p>{t("legal.terms.s4.p2")}</p>
                <p>{t("legal.terms.s4.p3")}</p>
              </Section>

              <Section title={t("legal.terms.s5.title")}>
                <p>{t("legal.terms.s5.p1")}</p>
                <p>{t("legal.terms.s5.p2")}</p>
                <p className="pl-4">{t("legal.terms.s5.p2a")}</p>
                <p className="pl-4">{t("legal.terms.s5.p2b")}</p>
                <p className="pl-4">{t("legal.terms.s5.p2c")}</p>
                <p className="pl-4">{t("legal.terms.s5.p2d")}</p>
                <p>{t("legal.terms.s5.p3")}</p>
                <p>{t("legal.terms.s5.p4")}</p>
                <p>{t("legal.terms.s5.p5")}</p>
              </Section>

              <Section title={t("legal.terms.s6.title")}>
                <p>{t("legal.terms.s6.p1")}</p>
                <p>{t("legal.terms.s6.p2")}</p>
                <p>{t("legal.terms.s6.p3")}</p>
              </Section>

              <Section title={t("legal.terms.s7.title")}>
                <p>{t("legal.terms.s7.p1")}</p>
                <p>{t("legal.terms.s7.p2")}</p>
              </Section>

              <Section title={t("legal.terms.s8.title")}>
                <p>{t("legal.terms.s8.p1")}</p>
                <p>{t("legal.terms.s8.p2")}</p>
              </Section>

              {/* Paddle MoR & Payment Terms — required for Paddle approval */}
              <Section title="9. Payments, Subscriptions & Merchant of Record / Płatności i Sprzedawca">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-3">
                  <p className="font-semibold text-primary text-sm">Merchant of Record</p>
                  <p className="text-xs mt-2 text-foreground">
                    <strong>EN:</strong> Our order process is conducted by our online reseller Paddle.com.
                    Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer
                    service inquiries and handles returns, refunds, billing, invoicing and tax compliance.
                  </p>
                  <p className="text-xs mt-2 text-foreground">
                    <strong>PL:</strong> Proces zamówienia jest realizowany przez naszego internetowego
                    sprzedawcę Paddle.com. Paddle.com jest Sprzedawcą Rejestrowym (Merchant of Record)
                    dla wszystkich zamówień, obsługuje zwroty, fakturowanie, podatki oraz zapytania
                    klientów dotyczące płatności.
                  </p>
                </div>
                <p>
                  <strong>Subscriptions / Subskrypcje:</strong> Paid plans (Pro, Ultimate) are billed
                  monthly in advance and renew automatically until cancelled. You may cancel any time
                  via paddle.net or your account settings — access continues until the end of the
                  current billing period. Subskrypcje są pobierane miesięcznie z góry i odnawiają
                  się automatycznie do momentu anulowania.
                </p>
                <p>
                  <strong>One-time purchases / Zakupy jednorazowe:</strong> Coffee tips and donations
                  are non-recurring single charges processed by Paddle. Napiwki kawowe to płatności
                  jednorazowe.
                </p>
                <p>
                  <strong>Pricing & Taxes / Ceny i podatki:</strong> Prices are shown on the pricing
                  and donation pages. Applicable taxes (VAT/sales tax) are calculated and collected
                  by Paddle based on your billing location. Ceny zawierają lub doliczają podatek VAT
                  zgodnie z lokalizacją kupującego.
                </p>
                <p>
                  Detailed payment terms are governed by the{" "}
                  <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Paddle Checkout Buyer Terms
                  </a>
                  . Szczegółowe warunki płatności reguluje regulamin kupującego Paddle.
                </p>
              </Section>
            </div>
          </TabsContent>

          {/* PRIVACY */}
          <TabsContent value="privacy">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">{t("legal.priv.heading")}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{t("legal.lastUpdate")}</p>

              <Section title={t("legal.priv.s1.title")}><p>{t("legal.priv.s1.p1")}</p></Section>
              <Section title={t("legal.priv.s2.title")}><p>{t("legal.priv.s2.p1")}</p></Section>
              <Section title={t("legal.priv.s3.title")}><p>{t("legal.priv.s3.p1")}</p></Section>
              <Section title={t("legal.priv.s4.title")}><p>{t("legal.priv.s4.p1")}</p></Section>
              <Section title={t("legal.priv.s5.title")}><p>{t("legal.priv.s5.p1")}</p></Section>
              <Section title={t("legal.priv.s6.title")}><p>{t("legal.priv.s6.p1")}</p></Section>
              <Section title={t("legal.priv.s7.title")}><p>{t("legal.priv.s7.p1")}</p></Section>
              <Section title={t("legal.priv.s8.title")}><p>{t("legal.priv.s8.p1")}</p></Section>

              {/* Paddle as data processor — required for Paddle approval */}
              <Section title="Payment data & Paddle / Dane płatnicze i Paddle">
                <p>
                  <strong>EN:</strong> When you make a purchase or donation, payment information
                  (card details, billing address, email, IP address, transaction metadata) is
                  collected and processed by <strong>Paddle.com Market Limited</strong> acting as
                  our Merchant of Record and independent data controller for payment, fraud-
                  prevention, tax-compliance and invoicing purposes. GrouaRock receives only
                  limited transaction metadata (transaction ID, amount, plan, customer ID, country)
                  to provision your subscription and credits — we never see or store your full
                  card number.
                </p>
                <p>
                  <strong>PL:</strong> Przy dokonywaniu płatności lub darowizny dane płatnicze
                  (numer karty, adres rozliczeniowy, e-mail, adres IP, metadane transakcji) są
                  zbierane i przetwarzane przez <strong>Paddle.com Market Limited</strong>, działającą
                  jako Sprzedawca Rejestrowy i niezależny administrator danych w celach płatności,
                  zapobiegania oszustwom, rozliczeń podatkowych i fakturowania. GrouaRock otrzymuje
                  jedynie ograniczone metadane (ID transakcji, kwota, plan, ID klienta, kraj),
                  niezbędne do aktywacji subskrypcji — nigdy nie widzimy ani nie przechowujemy
                  pełnego numeru karty.
                </p>
                <p>
                  Paddle's privacy notice / Polityka prywatności Paddle:{" "}
                  <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    paddle.com/legal/privacy
                  </a>
                </p>
              </Section>
            </div>
          </TabsContent>

          {/* REFUNDS — required by Paddle */}
          <TabsContent value="refunds">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Refund Policy / Polityka zwrotów</h2>
              </div>
              <p className="text-xs text-muted-foreground">{t("legal.lastUpdate")}</p>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="font-semibold text-primary text-sm">30-day money-back guarantee</p>
                <p className="text-xs mt-2">
                  We offer a <strong>30-day money-back guarantee</strong> on all paid plans (Pro,
                  Ultimate) and one-time purchases (coffee tips). If you are not satisfied with
                  your purchase, you may request a full refund within 30 days of the order date —
                  no questions asked.
                </p>
                <p className="text-xs mt-2">
                  Oferujemy <strong>30-dniową gwarancję zwrotu pieniędzy</strong> na wszystkie
                  plany płatne i zakupy jednorazowe. W ciągu 30 dni od zakupu możesz zażądać
                  pełnego zwrotu bez podawania przyczyny.
                </p>
              </div>

              <Section title="How to request a refund / Jak zażądać zwrotu">
                <p>
                  <strong>EN:</strong> All payments are processed by Paddle (our Merchant of
                  Record). To request a refund, simply visit{" "}
                  <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    paddle.net
                  </a>
                  , locate your transaction (use the email address you used at checkout), and
                  click "Request a refund". Alternatively, contact us at{" "}
                  <a href="mailto:support@grouaistream.com" className="text-primary underline">
                    support@grouaistream.com
                  </a>{" "}
                  and we will forward your request to Paddle.
                </p>
                <p>
                  <strong>PL:</strong> Wszystkie płatności obsługuje Paddle (nasz Merchant of
                  Record). Aby zażądać zwrotu, odwiedź{" "}
                  <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    paddle.net
                  </a>
                  , odszukaj swoją transakcję (używając e-maila z zakupu) i kliknij „Request a
                  refund". Możesz też napisać na{" "}
                  <a href="mailto:support@grouaistream.com" className="text-primary underline">
                    support@grouaistream.com
                  </a>{" "}
                  — przekażemy Twoją prośbę do Paddle.
                </p>
              </Section>

              <Section title="Processing time / Czas realizacji">
                <p>
                  Approved refunds are issued back to your original payment method, typically
                  within 5–10 business days depending on your bank or card issuer.
                </p>
                <p>
                  Zatwierdzone zwroty trafiają z powrotem na Twoją kartę / konto w ciągu 5–10
                  dni roboczych, w zależności od banku.
                </p>
              </Section>

              <Section title="Subscription cancellations / Anulowanie subskrypcji">
                <p>
                  You may cancel your subscription at any time. After cancellation, you retain
                  access to paid features until the end of the current billing period — no
                  partial refunds are issued for unused time within an active billing period
                  (except under the 30-day guarantee above).
                </p>
                <p>
                  Subskrypcję możesz anulować w dowolnym momencie. Po anulowaniu zachowujesz
                  dostęp do funkcji premium do końca opłaconego okresu rozliczeniowego.
                </p>
              </Section>

              <Section title="Chargebacks / Obciążenia zwrotne">
                <p>
                  Please contact us or Paddle before initiating a chargeback — we will resolve
                  most issues within 48 hours. Skontaktuj się z nami przed rozpoczęciem
                  procedury chargeback w banku — większość spraw rozwiążemy w 48 godzin.
                </p>
              </Section>
            </div>
          </TabsContent>

          {/* PAYMENTS — Paddle MoR disclosure as standalone tab */}
          <TabsContent value="payments">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Payments & Billing / Płatności i rozliczenia</h2>
              </div>
              <p className="text-xs text-muted-foreground">{t("legal.lastUpdate")}</p>

              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <p className="font-semibold text-accent text-sm">Powered by Paddle — Merchant of Record</p>
                <p className="text-xs mt-2">
                  Our order process is conducted by our online reseller{" "}
                  <strong>Paddle.com Market Limited</strong> (a company registered in England &
                  Wales, company no. 08172165). Paddle.com is the Merchant of Record for all our
                  orders. Paddle provides all customer service inquiries and handles returns,
                  refunds, billing, invoicing, tax compliance and chargebacks.
                </p>
                <p className="text-xs mt-2">
                  Proces zamówień obsługuje nasz internetowy sprzedawca{" "}
                  <strong>Paddle.com Market Limited</strong>. Paddle jest Sprzedawcą Rejestrowym
                  dla wszystkich naszych zamówień — odpowiada za zwroty, fakturowanie, podatki
                  i obsługę klienta w sprawach płatności.
                </p>
              </div>

              <Section title="Available plans / Dostępne plany">
                <p><strong>Free</strong> — €0 — basic playback, limited generations.</p>
                <p><strong>Pro</strong> — €9.99 / month — unlimited generations, AI DJ, mood radio.</p>
                <p><strong>Ultimate</strong> — €19.99 / month — everything in Pro + commercial license, priority support.</p>
                <p><strong>Coffee tips</strong> — €1 / €3 / €5 — one-time donations supporting the project and creators.</p>
              </Section>

              <Section title="Billing cycle / Cykl rozliczeniowy">
                <p>
                  Subscription plans are billed monthly in advance and renew automatically on the
                  same day each month until cancelled. You will receive an email invoice from
                  Paddle for every successful charge.
                </p>
                <p>
                  Plany subskrypcyjne są pobierane miesięcznie z góry i odnawiają się
                  automatycznie tego samego dnia każdego miesiąca. Faktura wysyłana jest e-mailem
                  z Paddle po każdej udanej płatności.
                </p>
              </Section>

              <Section title="Accepted payment methods / Akceptowane metody płatności">
                <p>
                  Credit & debit cards (Visa, Mastercard, American Express), Apple Pay, Google
                  Pay, PayPal, and local methods supported by Paddle in your country (iDEAL,
                  Bancontact, SEPA, etc.).
                </p>
              </Section>

              <Section title="Taxes / Podatki">
                <p>
                  Applicable VAT, GST or sales tax is calculated by Paddle based on your billing
                  address and shown on the checkout and invoice. Paddle remits taxes on our behalf.
                </p>
                <p>
                  Podatek VAT/GST obliczany jest automatycznie przez Paddle na podstawie adresu
                  rozliczeniowego i widoczny na fakturze.
                </p>
              </Section>

              <Section title="Manage your subscription / Zarządzaj subskrypcją">
                <p>
                  Visit{" "}
                  <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    paddle.net
                  </a>{" "}
                  to view invoices, update your payment method, change plans or cancel. Use the
                  email address you used during checkout.
                </p>
              </Section>

              <Section title="Contact / Kontakt">
                <p>
                  For payment questions: <a href="mailto:support@grouaistream.com" className="text-primary underline">support@grouaistream.com</a>
                </p>
                <p>
                  Operator: <strong>GrouaRock</strong> (sole proprietorship, Netherlands)
                </p>
              </Section>
            </div>
          </TabsContent>

          {/* COPYRIGHT */}
          <TabsContent value="copyright">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Copyright className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">{t("legal.copy.heading")}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{t("legal.lastUpdate")}</p>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                <p className="font-semibold text-primary flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t("legal.copy.legalBadge")}
                </p>
                <p className="text-sm mt-2">{t("legal.copy.legalBadgeDesc")}</p>
              </div>

              <Section title={t("legal.copy.sources.title")}>
                <p><strong>{t("legal.copy.sources.cc")}</strong></p>
                <p><strong>{t("legal.copy.sources.youtube")}</strong></p>
                <p><strong>{t("legal.copy.sources.user")}</strong></p>
                <p><strong>{t("legal.copy.sources.spotify")}</strong></p>
                <p><strong>{t("legal.copy.sources.ai")}</strong></p>
              </Section>

              <Section title={t("legal.copy.dmca.title")}>
                <p>{t("legal.copy.dmca.p1")}</p>
                <p>{t("legal.copy.dmca.p2")}</p>
                <p>{t("legal.copy.dmca.p3")}</p>
              </Section>

              <Section title={t("legal.copy.bases.title")}>
                <p>{t("legal.copy.bases.infosoc")}</p>
                <p>{t("legal.copy.bases.dsm")}</p>
                <p>{t("legal.copy.bases.dmca")}</p>
                <p>{t("legal.copy.bases.auteurswet")}</p>
                <p>{t("legal.copy.bases.youtube")}</p>
                <p>{t("legal.copy.bases.spotify")}</p>
                <p>{t("legal.copy.bases.suno")}</p>
                <p>{t("legal.copy.bases.euipo")}</p>
              </Section>
            </div>
          </TabsContent>

          {/* COOKIES */}
          <TabsContent value="cookies">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Cookie className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">{t("legal.cook.heading")}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{t("legal.lastUpdate")}</p>

              <Section title={t("legal.cook.s1.title")}><p>{t("legal.cook.s1.p1")}</p></Section>
              <Section title={t("legal.cook.s2.title")}>
                <p><strong>{t("legal.cook.s2.essential")}</strong></p>
                <p><strong>{t("legal.cook.s2.functional")}</strong></p>
                <p><strong>{t("legal.cook.s2.analytical")}</strong></p>
              </Section>
              <Section title={t("legal.cook.s3.title")}><p>{t("legal.cook.s3.p1")}</p></Section>
              <Section title={t("legal.cook.s4.title")}><p>{t("legal.cook.s4.p1")}</p></Section>
            </div>
          </TabsContent>

          {/* GDPR */}
          <TabsContent value="gdpr">
            <div className="groove-card p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">{t("legal.gdpr.heading")}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{t("legal.gdpr.subheading")}</p>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                <p className="font-semibold text-primary">{t("legal.gdpr.badge")}</p>
                <p className="text-sm mt-2">{t("legal.gdpr.badgeDesc")}</p>
              </div>

              <Section title={t("legal.gdpr.rights.title")}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { right: t("legal.gdpr.rights.access"), art: "art. 15", desc: t("legal.gdpr.rights.accessDesc") },
                    { right: t("legal.gdpr.rights.rectification"), art: "art. 16", desc: t("legal.gdpr.rights.rectificationDesc") },
                    { right: t("legal.gdpr.rights.erasure"), art: "art. 17", desc: t("legal.gdpr.rights.erasureDesc") },
                    { right: t("legal.gdpr.rights.restriction"), art: "art. 18", desc: t("legal.gdpr.rights.restrictionDesc") },
                    { right: t("legal.gdpr.rights.portability"), art: "art. 20", desc: t("legal.gdpr.rights.portabilityDesc") },
                    { right: t("legal.gdpr.rights.objection"), art: "art. 21", desc: t("legal.gdpr.rights.objectionDesc") },
                  ].map(item => (
                    <div key={item.art} className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="font-medium text-sm">{item.right} <span className="text-muted-foreground">({item.art})</span></p>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title={t("legal.gdpr.biometric.title")}>
                <p>{t("legal.gdpr.biometric.p1")}</p>
              </Section>

              <Section title={t("legal.gdpr.authority.title")}>
                <p>{t("legal.gdpr.authority.p1")}</p>
                <p>{t("legal.gdpr.authority.p2")}</p>
                <p>{t("legal.gdpr.authority.p3")}</p>
              </Section>

              <Section title={t("legal.gdpr.dpo.title")}>
                <p>{t("legal.gdpr.dpo.p1")}</p>
                <p>{t("legal.gdpr.dpo.p2")}</p>
              </Section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="font-semibold text-base mb-2">{title}</h3>
    <div className="text-sm text-muted-foreground space-y-2">{children}</div>
  </div>
);

export default Legal;
