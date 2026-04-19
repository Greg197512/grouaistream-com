import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, Sparkles, Clock, Building2, Home, Newspaper, Wallet, ShieldCheck, ExternalLink } from "lucide-react";

const REVOLUT_IBAN = "LT32 5002 2576 7256 99";
const REVOLUT_BIC = "REVOLT21";
const REVOLUT_NAME = "GrouaRock / GrouAI Stream";
const AMOUNT = "10,00 EUR";

export default function AdSubmission() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ slug: string; deadline: string } | null>(null);
  const [lead, setLead] = useState<{ email?: string; company_name?: string; industry?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    company_name: "",
    contact_email: "",
    ad_title: "",
    ad_description: "",
    ad_url: "",
    ad_image_url: "",
    industry: "",
  });

  useEffect(() => {
    document.title = "Wrzuć reklamę na GrouAI Stream — 10€/miesiąc";
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("ad-lead-lookup", { body: { token } });
        if (data?.lead) {
          setLead(data.lead);
          setForm(f => ({
            ...f,
            company_name: data.lead.company_name || "",
            contact_email: data.lead.email || "",
            industry: data.lead.industry || "",
          }));
        }
      } catch (e) {
        console.warn("Lead lookup failed (token may be test/expired):", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast({ title: "Skopiowano!", description: text });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async () => {
    if (!form.company_name || !form.contact_email || !form.ad_title || !form.ad_description || !form.ad_url) {
      toast({ title: "Uzupełnij wszystkie wymagane pola", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("ad-campaign-submit", {
      body: { token, ...form },
    });
    setSubmitting(false);
    if (error || !data?.ok) {
      toast({ title: "Błąd", description: error?.message || data?.error || "Spróbuj ponownie", variant: "destructive" });
      return;
    }
    setSubmitted({ slug: data.post_slug, deadline: data.payment_deadline });
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Ładowanie…</div>;

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero sukcesu */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/30 via-primary/5 to-background border-b border-primary/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          <div className="max-w-3xl mx-auto px-6 py-12 text-center relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/40 mb-6 animate-pulse">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
              🎉 Reklama opublikowana!
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Jest już widoczna na blogu <span className="text-primary font-semibold">GrouAI Stream</span>.
              Zostań z nami przez ostatni krok — opłatę.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
          {/* BRAMKA PŁATNICZA */}
          <Card className="overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.4)]">
            <div className="bg-primary/10 border-b border-primary/20 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="text-xl font-bold">Bramka płatności · Revolut</h2>
                  <p className="text-xs text-muted-foreground">Bezpieczny przelew SEPA · Bez prowizji</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">10 €</div>
                <div className="text-xs text-muted-foreground">jednorazowo · 30 dni</div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-5">
                <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-amber-500 mb-1">Płatność w ciągu 24 godzin</div>
                  <div className="text-muted-foreground">
                    Termin do <strong className="text-foreground">{new Date(submitted.deadline).toLocaleString("pl-PL", { dateStyle: "full", timeStyle: "short" })}</strong>.
                    Po tym czasie reklama zostanie zdjęta z bloga.
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  { label: "Numer konta (IBAN)", value: REVOLUT_IBAN, key: "iban", highlight: true },
                  { label: "BIC / SWIFT", value: REVOLUT_BIC, key: "bic" },
                  { label: "Odbiorca", value: REVOLUT_NAME, key: "name" },
                  { label: "Kwota", value: AMOUNT, key: "amount", highlight: true },
                  { label: "Tytuł przelewu (BARDZO WAŻNE)", value: `Reklama ${form.company_name}`, key: "title", highlight: true },
                ].map(item => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between gap-3 rounded-xl p-4 border transition-all hover:border-primary/50 ${
                      item.highlight ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{item.label}</div>
                      <div className="font-mono text-base font-semibold truncate">{item.value}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={item.highlight ? "default" : "outline"}
                      onClick={() => copy(item.value, item.key)}
                      className="shrink-0"
                    >
                      {copied === item.key ? (
                        <><CheckCircle2 className="w-4 h-4 mr-1" /> Skopiowane</>
                      ) : (
                        <><Copy className="w-4 h-4 mr-1" /> Kopiuj</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-5 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Płatność weryfikowana ręcznie w ciągu 1h roboczej. Otrzymasz email z potwierdzeniem.
              </div>
            </div>
          </Card>

          {/* LINKI */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Button asChild variant="outline" size="lg" className="h-auto py-4 justify-start group">
              <a href={`/blog/${submitted.slug}`} target="_blank" rel="noopener noreferrer">
                <Newspaper className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <div className="font-semibold">Zobacz swoją reklamę</div>
                  <div className="text-xs text-muted-foreground">Otwórz wpis na blogu</div>
                </div>
                <ExternalLink className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100" />
              </a>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-auto py-4 justify-start group">
              <Link to="/blog">
                <Newspaper className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <div className="font-semibold">Wszystkie reklamy</div>
                  <div className="text-xs text-muted-foreground">Blog GrouAI Stream</div>
                </div>
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-auto py-4 justify-start group sm:col-span-2">
              <Link to="/">
                <Home className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <div className="font-semibold">Wróć na grouaistream.com</div>
                  <div className="text-xs text-muted-foreground">Strona główna platformy</div>
                </div>
              </Link>
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground pt-2">
            <p>📩 Wysłaliśmy potwierdzenie na <strong className="text-foreground">{form.contact_email}</strong></p>
            <p className="mt-1">Dziękujemy za zaufanie — Zespół GrouaRock 🎵</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 px-4 py-1.5 rounded-full text-sm text-primary mb-6">
            <Sparkles className="w-4 h-4" /> Oferta wyłącznie dla {lead?.company_name || "Państwa"}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Reklama na <span className="text-primary">GrouAI Stream</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Dotrzyj do tysięcy słuchaczy, twórców i odbiorców muzyki nowej generacji.
            <br />
            <strong className="text-foreground">10 € jednorazowo · 30 dni publikacji · 24h na opłatę po dodaniu</strong>
          </p>
        </div>
      </div>

      {/* Formularz */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Card className="p-6 md:p-8 border-border">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-bold">Dane reklamy</h2>
          </div>

          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company">Nazwa firmy *</Label>
                <Input id="company" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} maxLength={100} />
              </div>
              <div>
                <Label htmlFor="email">Email kontaktowy *</Label>
                <Input id="email" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} maxLength={255} />
              </div>
            </div>

            <div>
              <Label htmlFor="title">Tytuł reklamy *</Label>
              <Input id="title" value={form.ad_title} onChange={e => setForm(f => ({ ...f, ad_title: e.target.value }))} maxLength={120} placeholder="Np. Najlepsza kawa w Rotterdamie" />
              <p className="text-xs text-muted-foreground mt-1">{form.ad_title.length} / 120</p>
            </div>

            <div>
              <Label htmlFor="desc">Opis reklamy *</Label>
              <Textarea id="desc" rows={5} value={form.ad_description} onChange={e => setForm(f => ({ ...f, ad_description: e.target.value }))} maxLength={600} placeholder="Co oferujesz? Dla kogo? Co Cię wyróżnia?" />
              <p className="text-xs text-muted-foreground mt-1">{form.ad_description.length} / 600</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="url">Link do strony *</Label>
                <Input id="url" type="url" placeholder="https://…" value={form.ad_url} onChange={e => setForm(f => ({ ...f, ad_url: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="img">Obraz/banner (URL)</Label>
                <Input id="img" type="url" placeholder="https://… (opcjonalnie)" value={form.ad_image_url} onChange={e => setForm(f => ({ ...f, ad_image_url: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label htmlFor="industry">Branża</Label>
              <Input id="industry" placeholder="Kawiarnia, Klub, Sklep muzyczny…" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} maxLength={60} />
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
              <strong className="text-primary">Jak to działa:</strong>
              <ol className="list-decimal pl-5 mt-2 space-y-1 text-muted-foreground">
                <li>Wysyłasz formularz — reklama publikuje się natychmiast na blogu</li>
                <li>W kolejnym kroku otrzymasz dane do przelewu Revolut (10 €)</li>
                <li>Masz 24h na opłatę — w przeciwnym razie reklama zostanie usunięta</li>
                <li>Po opłacie reklama jest aktywna przez 30 dni</li>
              </ol>
            </div>

            <Button onClick={handleSubmit} disabled={submitting} size="lg" className="w-full">
              {submitting ? "Publikuję…" : "▶ Opublikuj reklamę i przejdź do płatności"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
