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
      setLoading(false);
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="text-center mb-6">
            <CheckCircle2 className="w-16 h-16 mx-auto text-primary mb-4" />
            <h1 className="text-3xl font-bold mb-2">🎉 Reklama opublikowana!</h1>
            <p className="text-muted-foreground">Jest już widoczna na naszym blogu.</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Ostatni krok: opłata 10 € (24h)
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Aby reklama pozostała aktywna przez 30 dni, prosimy o przelew Revolut do{" "}
              <strong className="text-foreground">{new Date(submitted.deadline).toLocaleString("pl-PL")}</strong>:
            </p>

            <div className="space-y-3">
              {[
                { label: "IBAN Revolut", value: REVOLUT_IBAN, key: "iban" },
                { label: "Odbiorca", value: REVOLUT_NAME, key: "name" },
                { label: "Kwota", value: AMOUNT, key: "amount" },
                { label: "Tytuł przelewu", value: `Reklama ${form.company_name}`, key: "title" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="font-mono text-sm truncate">{item.value}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copy(item.value, item.key)}>
                    {copied === item.key ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>📩 Wysłaliśmy potwierdzenie na <strong>{form.contact_email}</strong></p>
            <p className="mt-2">Dziękujemy za zaufanie! — Zespół GrouaRock</p>
          </div>

          <Button asChild className="w-full mt-6" size="lg">
            <a href={`/blog/${submitted.slug}`}>Zobacz swoją reklamę na blogu →</a>
          </Button>
        </Card>
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
