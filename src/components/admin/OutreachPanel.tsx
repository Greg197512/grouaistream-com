// Tracker outreachu — LEGALNY, ręczny. Nie scrapuje i nie wysyła nic z automatu.
// Ty wpisujesz kontakty znalezione na oficjalnych stronach (Kontakt/Redakcja),
// panel podsuwa kilka dziennie z gotowym, spersonalizowanym mailem (mailto → Twój
// klient pocztowy), loguje wysyłki i prowadzi listę opt-out.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Plus, Loader2, Send, Check, Reply, Ban, Users } from "lucide-react";

type Category = "school" | "music_shop" | "media" | "venue" | "other";
interface Contact {
  id: string;
  org_name: string;
  contact_email: string;
  category: Category;
  source_url: string | null;
  status: "new" | "contacted" | "replied" | "opt_out";
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

const CAT_LABEL: Record<Category, string> = {
  school: "Szkoła / uczelnia",
  music_shop: "Sklep muzyczny",
  media: "Media / redakcja",
  venue: "Klub / program / festiwal",
  other: "Inne",
};

const SITE = "https://grouaistream.com";
const BLOG = "https://grouaistream.com/blog";

// Spersonalizowane szablony (temat + treść) wg kategorii. {org} = nazwa adresata.
function template(cat: Category, org: string): { subject: string; body: string } {
  const stop = "\n\nJeśli nie chcą Państwo kolejnych wiadomości, proszę odpisać STOP — natychmiast usunę kontakt.";
  const sig = `\n\nPozdrawiam,\nZespół GrouAI Stream\n${SITE}`;
  switch (cat) {
    case "school":
      return {
        subject: "Darmowy materiał dla uczniów: jak AI naprawdę słyszy muzykę",
        body:
`Dzień dobry,

piszę do ${org} jako twórca GrouAI Stream — polskiej platformy muzycznej. Prowadzimy blog z pogłębionymi, przystępnymi tekstami o dźwięku i technologii, które sprawdzają się jako materiał uzupełniający na zajęciach (akustyka, produkcja, historia muzyki). Przykłady:

• „Jak sztuczna inteligencja słyszy muzykę: od spektrogramu do embeddingu"
• „Neurologia rytmu: dlaczego mózg synchronizuje się z bitem"
• „Wojna głośności: dlaczego muzyka brzmi coraz głośniej"

Wszystko bezpłatnie: ${BLOG}

Jeśli uznają Państwo, że to wartościowe dla uczniów, chętnie przygotuję zestaw tematów pod profil klasy.` + stop + sig,
      };
    case "music_shop":
      return {
        subject: "Współpraca: materiały o muzyce i technologii dla Waszych klientów",
        body:
`Dzień dobry,

jesteśmy GrouAI Stream — platforma muzyczna z live radiem i AI-DJ. Widzę, że ${org} działa blisko muzyków i pasjonatów sprzętu. Prowadzimy blog o dźwięku i technologii (mastering, akustyka, audio przestrzenne), który moglibyśmy udostępnić Waszym klientom, a w zamian wspomnieć o Waszym sklepie u nas.

Blog: ${BLOG} · Platforma: ${SITE}

Dać znać, czy temat Was interesuje?` + stop + sig,
      };
    case "media":
      return {
        subject: "Temat na tekst: uczciwy streaming bez botów (dane + kąt)",
        body:
`Dzień dobry,

śledzę ${org}. Prowadzę GrouAI Stream — platformę, która weryfikuje ludzkie odsłuchania i dzieli się z twórcami udziałem z realnego przychodu (bez sztucznych stawek za odsłuch). To może być ciekawy kąt na tekst o tym, jak streaming radzi sobie z botami i uczciwością wypłat.

Chętnie podeślę konkrety oraz nasze materiały: ${BLOG}` + stop + sig,
      };
    case "venue":
      return {
        subject: "Współpraca: promocja Waszych wydarzeń + materiały dla społeczności",
        body:
`Cześć,

jesteśmy GrouAI Stream — platforma muzyczna z live radiem 24/7 i AI-DJ. ${org} robi świetną robotę dla sceny — moglibyśmy się wesprzeć: materiały edukacyjne z bloga dla Waszej społeczności, a w zamian promocja Waszych wydarzeń u nas.

${SITE} · ${BLOG}` + stop + sig,
      };
    default:
      return {
        subject: "GrouAI Stream — muzyka bez botów + materiały edukacyjne",
        body:
`Dzień dobry,

jesteśmy GrouAI Stream — uczciwa platforma muzyczna. Prowadzimy blog o muzyce i technologii: ${BLOG}. Chętnie nawiążemy współpracę z ${org}.` + stop + sig,
      };
  }
}

const mailtoHref = (c: Contact) => {
  const t = template(c.category, c.org_name);
  return `mailto:${encodeURIComponent(c.contact_email)}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
};

const DAILY = 5;

export function OutreachPanel() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ org_name: "", contact_email: "", category: "school" as Category, source_url: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("outreach_contacts")
      .select("id, org_name, contact_email, category, source_url, status, notes, last_contacted_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!form.org_name.trim() || !form.contact_email.trim()) { toast.error("Podaj nazwę i e-mail"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contact_email.trim())) { toast.error("Nieprawidłowy e-mail"); return; }
    setSaving(true);
    const { error } = await supabase.from("outreach_contacts").insert({
      org_name: form.org_name.trim(),
      contact_email: form.contact_email.trim().toLowerCase(),
      category: form.category,
      source_url: form.source_url.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Ten e-mail już jest na liście" : error.message); return; }
    toast.success("Dodano kontakt");
    setForm({ org_name: "", contact_email: "", category: form.category, source_url: "" });
    void load();
  };

  const setStatus = async (c: Contact, status: Contact["status"]) => {
    const patch: any = { status };
    if (status === "contacted") patch.last_contacted_at = new Date().toISOString();
    await supabase.from("outreach_contacts").update(patch).eq("id", c.id);
    setContacts((list) => list.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
  };

  const today = contacts.filter((c) => c.status === "new").slice(0, DAILY);
  const counts = {
    new: contacts.filter((c) => c.status === "new").length,
    contacted: contacts.filter((c) => c.status === "contacted").length,
    replied: contacts.filter((c) => c.status === "replied").length,
    opt_out: contacts.filter((c) => c.status === "opt_out").length,
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Outreach — szkoły, sklepy muzyczne, media
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Wpisujesz kontakty z <b>oficjalnych stron</b> (zakładka „Kontakt"). Panel podsuwa {DAILY} dziennie
          z gotowym, spersonalizowanym mailem — wysyłasz świadomie ze swojego klienta pocztowego (opt-out
          respektujemy). Zero scrapowania i zero wysyłki z automatu — to chroni domenę przed blacklistą.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dodawanie kontaktu */}
        <div className="grid gap-2 sm:grid-cols-[1.2fr_1.2fr_1fr_auto] items-end rounded-xl border border-border/50 bg-background/40 p-3">
          <Input placeholder="Nazwa (np. PSM I st. w …)" value={form.org_name}
                 onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} />
          <Input placeholder="oficjalny@email" value={form.contact_email}
                 onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CAT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Dodaj
          </Button>
          <Input className="sm:col-span-4" placeholder="Źródło (URL oficjalnej strony kontaktu) — opcjonalnie, ale zalecane"
                 value={form.source_url} onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))} />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Nowe: {counts.new}</Badge>
          <Badge variant="secondary">Wysłane: {counts.contacted}</Badge>
          <Badge variant="secondary">Odpowiedzi: {counts.replied}</Badge>
          <Badge variant="secondary">Opt-out: {counts.opt_out}</Badge>
        </div>

        {/* Dziś do wysłania */}
        <div>
          <div className="text-[11px] uppercase tracking-widest text-primary font-bold mb-2">
            Dziś do wysłania ({today.length})
          </div>
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : today.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Brak nowych kontaktów. Dodaj kilka z oficjalnych stron powyżej.
            </p>
          ) : (
            <div className="space-y-2">
              {today.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-background/40 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{c.org_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.contact_email}</div>
                  </div>
                  <Badge className="text-[10px]" variant="secondary">{CAT_LABEL[c.category]}</Badge>
                  <Button size="sm" asChild className="gap-1.5">
                    <a href={mailtoHref(c)} onClick={() => setStatus(c, "contacted")}>
                      <Send className="h-3.5 w-3.5" /> Otwórz mail
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => setStatus(c, "replied")}>
                    <Reply className="h-3.5 w-3.5" /> Odpowiedź
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => setStatus(c, "opt_out")}>
                    <Ban className="h-3.5 w-3.5" /> Opt-out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
