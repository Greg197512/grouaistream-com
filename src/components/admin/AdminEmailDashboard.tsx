import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Mail, Send, Sparkles, Eye, Loader2, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Clock, Inbox,
  UserPlus, Trophy, Newspaper, Bell, Gift, Zap, Webhook, Users,
} from "lucide-react";

interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  suppressed: number;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  preview: string;
  heroImageUrl?: string | null;
  type: string;
  generatedAt: string;
}

interface AdminEmailDashboardProps {
  stats?: {
    totalTracks: number;
    totalUsers: number;
  };
  genreStats: { genre: string; count: number }[];
}

export function AdminEmailDashboard({ stats, genreStats }: AdminEmailDashboardProps) {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats>({ total: 0, sent: 0, failed: 0, pending: 0, suppressed: 0 });
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");

  type EmailTypeOpt = "invitation" | "challenge" | "newsletter" | "weekly_digest" | "easter" | "feature_announcement" | "tip_of_the_week" | "blog_post" | "milestone" | "comeback" | "thank_you" | "ai_studio_promo" | "live_radio_promo" | "party_mode_promo" | "custom";
  type LangOpt = "auto" | "pl" | "en" | "nl" | "uk";
  const [emailType, setEmailType] = useState<EmailTypeOpt>("invitation");
  const [language, setLanguage] = useState<LangOpt>("auto");
  const [customSubject, setCustomSubject] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [newEmailCount, setNewEmailCount] = useState(0);

  // n8n mass dispatch state
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [audience, setAudience] = useState<"all_users" | "blog_subscribers">("all_users");
  const [dispatchMode, setDispatchMode] = useState<"direct" | "n8n">("direct");
  const [lastDispatch, setLastDispatch] = useState<{ recipientCount: number; heroImageUrl: string | null; subject: string; queued?: number; errors?: number; mode?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_settings").select("n8n_webhook_url").eq("id", 1).maybeSingle();
      if (data?.n8n_webhook_url) setN8nWebhookUrl(data.n8n_webhook_url);
    })();
  }, []);

  const saveWebhookUrl = async () => {
    setSavingWebhook(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ id: 1, n8n_webhook_url: n8nWebhookUrl.trim() || null, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("URL webhooka zapisany");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSavingWebhook(false);
    }
  };

  const massDispatch = async () => {
    const audienceLabel = audience === "all_users" ? "wszystkich użytkowników" : "subskrybentów bloga";
    const modeLabel = dispatchMode === "direct" ? "BEZPOŚREDNIO (przez naszą kolejkę)" : "przez n8n";
    if (!confirm(`Wysłać "${emailType}" do ${audienceLabel} ${modeLabel}?`)) return;
    setDispatching(true);
    setLastDispatch(null);
    try {
      const { data, error } = await supabase.functions.invoke("mass-email-dispatch", {
        body: {
          emailType,
          language,
          customSubject: customSubject || undefined,
          customMessage: customMessage || undefined,
          audience,
          mode: dispatchMode,
          webhookOverride: dispatchMode === "n8n" ? (n8nWebhookUrl.trim() || undefined) : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || `Status: ${data?.n8nStatus || "unknown"}`);
      setLastDispatch({
        recipientCount: data.recipientCount,
        heroImageUrl: data.heroImageUrl,
        subject: data.subject,
        queued: data.queued,
        errors: data.errors,
        mode: data.mode,
      });
      const queuedMsg = data.mode === "direct" ? ` (zakolejkowano: ${data.queued}, błędy: ${data.errors})` : "";
      toast.success(`🚀 ${data.recipientCount} odbiorców${queuedMsg}`);
      fetchEmailLogs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd masowej wysyłki");
    } finally {
      setDispatching(false);
    }
  };

  const fetchEmailLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case "24h": startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
        case "7d": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case "30d": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      }

      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const deduped = new Map<string, EmailLog>();
      for (const log of (data || []) as unknown as EmailLog[]) {
        const key = log.message_id || log.id;
        if (!deduped.has(key) || new Date(log.created_at) > new Date(deduped.get(key)!.created_at)) {
          deduped.set(key, log);
        }
      }
      const logs = Array.from(deduped.values()).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEmailLogs(logs);

      const statsCalc: EmailStats = { total: logs.length, sent: 0, failed: 0, pending: 0, suppressed: 0 };
      for (const log of logs) {
        if (log.status === "sent") statsCalc.sent++;
        else if (log.status === "dlq" || log.status === "failed") statsCalc.failed++;
        else if (log.status === "pending") statsCalc.pending++;
        else if (log.status === "suppressed") statsCalc.suppressed++;
      }
      setEmailStats(statsCalc);
    } catch (err) {
      console.error("Error fetching email logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchEmailLogs();
  }, [fetchEmailLogs]);

  useEffect(() => {
    const channel = supabase
      .channel("email-log-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "email_send_log" }, (payload) => {
        setNewEmailCount(prev => prev + 1);
        const newLog = payload.new as unknown as EmailLog;
        
        // Powiadomienie dla admina
        toast.info(`🔔 Nowa aktywność poczty: ${newLog.recipient_email}`, { duration: 5000 });
        
        if (newLog.status === "sent") {
          toast.success(`✉️ E-mail wysłany do ${newLog.recipient_email}`, { duration: 5000 });
        } else if (newLog.status === "failed" || newLog.status === "dlq") {
          toast.error(`❌ Błąd wysyłki do ${newLog.recipient_email}`, { duration: 5000 });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const generateEmail = async () => {
    setGeneratingEmail(true);
    try {
      const topGenres = genreStats.slice(0, 5).map(g => g.genre);
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: {
          type: emailType,
          recipientName: recipientName || undefined,
          customMessage: customMessage || undefined,
          stats: { totalTracks: stats?.totalTracks || 0, totalUsers: stats?.totalUsers || 0, topGenres },
        },
      });
      if (error) throw error;
      if (data?.email) {
        setGeneratedEmail(data.email);
        toast.success("E-mail wygenerowany przez AI!");
      }
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error("Błąd generowania e-maila");
    } finally {
      setGeneratingEmail(false);
    }
  };

  const sendEmail = async () => {
    if (!generatedEmail || !recipientEmail.trim()) {
      toast.error("Podaj adres e-mail odbiorcy!");
      return;
    }
    setSendingEmail(true);
    try {
      const id = crypto.randomUUID();
      // Treść maila w plain-text (z HTML AI)
      let messagePlain = generatedEmail.body.replace(/<[^>]*>/g, "").replace(/\n{3,}/g, "\n\n").trim();

      // BEZPIECZNIK: jeśli admin podał kontekst, a AI go zignorował → doklej go ręcznie do treści
      const ctx = customMessage.trim();
      if (ctx) {
        const ctxStart = ctx.slice(0, Math.min(30, ctx.length)).toLowerCase();
        const bodyLower = messagePlain.toLowerCase();
        if (!bodyLower.includes(ctxStart)) {
          messagePlain = `${messagePlain}\n\n— Od redakcji GrouAI —\n${ctx}`;
        }
      }

      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "admin-notification",
          recipientEmail: recipientEmail.trim(),
          idempotencyKey: `admin-email-${id}`,
          templateData: {
            title: generatedEmail.subject,
            message: messagePlain,
            recipientName: recipientName || undefined,
            heroImageUrl: generatedEmail.heroImageUrl || undefined,
            emailType: emailType === "invitation" ? "Zaproszenie" : emailType === "challenge" ? "Wyzwanie" : emailType === "newsletter" ? "Newsletter" : emailType === "easter" ? "Życzenia wielkanocne" : "Podsumowanie",
          },
        },
      });
      if (error) throw error;
      toast.success(`✉️ E-mail wysłany do ${recipientEmail}!`);
      fetchEmailLogs();
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Błąd wysyłania e-maila");
    } finally {
      setSendingEmail(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Wysłano</Badge>;
      case "pending": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Oczekuje</Badge>;
      case "failed": case "dlq": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Błąd</Badge>;
      case "suppressed": return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Zablokowany</Badge>;
      case "bounced": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Odrzucony</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Łącznie</p>
                <p className="text-2xl font-bold">{emailStats.total}</p>
              </div>
              <Inbox className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Wysłane</p>
                <p className="text-2xl font-bold text-emerald-400">{emailStats.sent}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Oczekujące</p>
                <p className="text-2xl font-bold text-yellow-400">{emailStats.pending}</p>
              </div>
              <Clock className="h-5 w-5 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Błędy</p>
                <p className="text-2xl font-bold text-red-400">{emailStats.failed}</p>
              </div>
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Zablokowane</p>
                <p className="text-2xl font-bold text-orange-400">{emailStats.suppressed}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generator E-maili AI
            </CardTitle>
            <CardDescription>
              Generuj i wysyłaj e-maile do użytkowników GrouAI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Typ e-maila</Label>
              <Select value={emailType} onValueChange={(v: EmailTypeOpt) => setEmailType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invitation"><div className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Zaproszenie</div></SelectItem>
                  <SelectItem value="challenge"><div className="flex items-center gap-2"><Trophy className="h-4 w-4" />Wyzwanie muzyczne</div></SelectItem>
                  <SelectItem value="newsletter"><div className="flex items-center gap-2"><Newspaper className="h-4 w-4" />Newsletter</div></SelectItem>
                  <SelectItem value="weekly_digest"><div className="flex items-center gap-2"><Mail className="h-4 w-4" />Podsumowanie tygodnia</div></SelectItem>
                  <SelectItem value="feature_announcement"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Nowa funkcja</div></SelectItem>
                  <SelectItem value="tip_of_the_week"><div className="flex items-center gap-2"><Zap className="h-4 w-4" />Trik tygodnia</div></SelectItem>
                  <SelectItem value="blog_post"><div className="flex items-center gap-2"><Newspaper className="h-4 w-4" />Wpis blogowy</div></SelectItem>
                  <SelectItem value="milestone"><div className="flex items-center gap-2"><Trophy className="h-4 w-4" />Kamień milowy</div></SelectItem>
                  <SelectItem value="comeback"><div className="flex items-center gap-2"><Bell className="h-4 w-4" />Tęsknimy (comeback)</div></SelectItem>
                  <SelectItem value="thank_you"><div className="flex items-center gap-2"><Gift className="h-4 w-4" />Podziękowanie</div></SelectItem>
                  <SelectItem value="ai_studio_promo"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Promo AI Studio</div></SelectItem>
                  <SelectItem value="live_radio_promo"><div className="flex items-center gap-2"><Bell className="h-4 w-4" />Promo Live Radio</div></SelectItem>
                  <SelectItem value="party_mode_promo"><div className="flex items-center gap-2"><Trophy className="h-4 w-4" />Promo Party Mode</div></SelectItem>
                  <SelectItem value="easter"><div className="flex items-center gap-2"><Gift className="h-4 w-4" />Życzenia świąteczne</div></SelectItem>
                  <SelectItem value="custom"><div className="flex items-center gap-2"><Mail className="h-4 w-4" />Własna wiadomość</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Język AI</Label>
                <Select value={language} onValueChange={(v: LangOpt) => setLanguage(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🌍 Auto (po e-mailu odbiorcy)</SelectItem>
                    <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="nl">🇳🇱 Nederlands</SelectItem>
                    <SelectItem value="uk">🇺🇦 Українська</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Własny temat (opcj.)</Label>
                <Input placeholder="AI poprawi jeśli trzeba" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>E-mail odbiorcy</Label>
              <Input placeholder="np. jan@example.com" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Imię odbiorcy (opcjonalne)</Label>
              <Input placeholder="np. Jan" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Dodatkowy kontekst (zostanie wpleciony w treść maila)</Label>
              <Textarea
                placeholder="np. Promuj nowy gatunek K-pop, nową funkcję AI Studio 2.0, wpis blogowy o Mood Detection..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                AI dostanie ten tekst jako twardy kontekst. Jeśli go zignoruje, dopiszemy go automatycznie na końcu maila.
              </p>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={generateEmail} disabled={generatingEmail}>
                {generatingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingEmail ? "Generuję..." : "Generuj AI"}
              </Button>
              <Button variant="default" className="flex-1 gap-2" onClick={sendEmail} disabled={sendingEmail || !generatedEmail || !recipientEmail.trim()}>
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingEmail ? "Wysyłam..." : "Wyślij"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Podgląd e-maila
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generatedEmail ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-background border">
                  <div className="text-sm text-muted-foreground mb-1">Temat:</div>
                  <div className="font-semibold">{generatedEmail.subject}</div>
                </div>
                {generatedEmail.heroImageUrl && (
                  <div className="rounded-lg overflow-hidden border border-primary/30 shadow-lg shadow-primary/10">
                    <img
                      src={generatedEmail.heroImageUrl}
                      alt="Hero AI"
                      className="w-full block"
                    />
                    <div className="px-3 py-2 bg-background/80 backdrop-blur text-xs text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Grafika hero wygenerowana przez AI dla tego maila
                    </div>
                  </div>
                )}
                <div className="p-4 rounded-lg bg-background border max-h-[300px] overflow-y-auto">
                  <div className="text-sm text-muted-foreground mb-2">Treść:</div>
                  <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: generatedEmail.body }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mb-4 opacity-30" />
                <p>Wygeneruj e-mail aby zobaczyć podgląd</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === Mass dispatch === */}
      <Card className="border-primary/30 bg-gradient-to-br from-card/80 to-primary/5 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Wyślij do wszystkich
          </CardTitle>
          <CardDescription>
            <strong>Bezpośrednio</strong> = nasza kolejka (działa od razu, używa szablonów React Email).
            <strong> n8n</strong> = wypycha payload do Twojego workflowa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Send className="h-4 w-4" />Tryb wysyłki</Label>
            <Select value={dispatchMode} onValueChange={(v: typeof dispatchMode) => setDispatchMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Bezpośrednio (zalecane) — nasza kolejka emaili</SelectItem>
                <SelectItem value="n8n">Przez n8n (wymaga webhooka)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dispatchMode === "n8n" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Webhook className="h-4 w-4" />URL webhooka n8n (override)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://twoj-n8n.app/webhook/abc123"
                  value={n8nWebhookUrl}
                  onChange={(e) => setN8nWebhookUrl(e.target.value)}
                />
                <Button variant="outline" onClick={saveWebhookUrl} disabled={savingWebhook}>
                  {savingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zapisz"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Pozostaw puste, aby użyć domyślnego sekretu N8N_WEBHOOK_URL.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Users className="h-4 w-4" />Audiencja</Label>
            <Select value={audience} onValueChange={(v: typeof audience) => setAudience(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_users">Wszyscy zarejestrowani użytkownicy</SelectItem>
                <SelectItem value="blog_subscribers">Subskrybenci bloga (z opt-in)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={massDispatch}
            disabled={dispatching}
            className="w-full gap-2 bg-gradient-to-r from-primary to-amber-500 hover:opacity-90 text-primary-foreground"
            size="lg"
          >
            {dispatching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {dispatching
              ? (dispatchMode === "direct" ? "Kolejkuję wysyłkę..." : "Generuję i wysyłam do n8n...")
              : `Wyślij do wszystkich (${dispatchMode === "direct" ? "bezpośrednio" : "n8n"})`}
          </Button>

          {lastDispatch && (
            <div className="rounded-lg border border-primary/30 bg-background/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                {lastDispatch.mode === "direct"
                  ? <>Zakolejkowano <strong>{lastDispatch.queued}</strong> / {lastDispatch.recipientCount} (błędy: {lastDispatch.errors ?? 0})</>
                  : <>Wysłano do n8n: <strong>{lastDispatch.recipientCount}</strong> odbiorców</>}
              </div>
              <div className="text-sm"><span className="text-muted-foreground">Temat: </span>{lastDispatch.subject}</div>
              {lastDispatch.heroImageUrl && (
                <img src={lastDispatch.heroImageUrl} alt="Hero" className="w-full max-w-md rounded-lg border border-border/50" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Historia wysyłek
                {newEmailCount > 0 && (
                  <Badge variant="destructive" className="animate-pulse">{newEmailCount} nowe</Badge>
                )}
              </CardTitle>
              <CardDescription>Log wszystkich e-maili wysłanych z systemu</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={(v: typeof timeRange) => setTimeRange(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Ostatnie 24h</SelectItem>
                  <SelectItem value="7d">Ostatnie 7 dni</SelectItem>
                  <SelectItem value="30d">Ostatnie 30 dni</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => { setNewEmailCount(0); fetchEmailLogs(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : emailLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Brak e-maili w wybranym okresie</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Szablon</TableHead>
                    <TableHead>Odbiorca</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Błąd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.template_name}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{log.recipient_email}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pl-PL", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[150px] truncate">
                        {log.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
