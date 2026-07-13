import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, CheckCircle2, XCircle, Send, Users, Inbox, FileText, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface CrmClient {
  id: string; email: string | null; phone: string | null; full_name: string | null;
  company: string | null; preferred_language: string | null;
  total_orders: number; total_revenue_eur: number; ltv_score: number;
  last_contact_at: string | null; first_contact_at: string;
  tags: string[]; notes: string | null;
}
interface Conversation {
  id: string; client_id: string | null; channel: string; channel_thread_id: string | null;
  status: string; intent: string | null; summary: string | null;
  last_message_at: string; unread_count: number;
}
interface Message {
  id: string; conversation_id: string; role: string; content: string; tool_call: any; created_at: string;
}
interface Draft {
  id: string; conversation_id: string | null; client_id: string | null;
  service_type: string | null; brief: string | null; budget_eur: number | null;
  deadline: string | null; ai_proposal: any; confidence: number | null;
  status: string; created_at: string; resulting_order_id: string | null;
  rejection_reason: string | null;
}

export const AuroraAssistantDesk = () => {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [adminReply, setAdminReply] = useState("");
  const [sending, setSending] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  const ingestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aurora-assistant-ingest`;
  const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aurora-assistant-chat`;

  const load = useCallback(async () => {
    setLoading(true);
    const [clientsRes, convsRes, draftsRes] = await Promise.all([
      supabase.from("aurora_crm_clients").select("*").order("last_contact_at", { ascending: false, nullsFirst: false }).limit(200),
      supabase.from("aurora_conversations").select("*").order("last_message_at", { ascending: false }).limit(200),
      supabase.from("aurora_intake_drafts").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setClients((clientsRes.data ?? []) as any);
    setConversations((convsRes.data ?? []) as any);
    setDrafts((draftsRes.data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openConv = useCallback(async (c: Conversation) => {
    setActiveConv(c);
    const { data } = await supabase.from("aurora_messages").select("*").eq("conversation_id", c.id).order("created_at");
    setMessages((data ?? []) as any);
    if (c.unread_count > 0) {
      await supabase.from("aurora_conversations").update({ unread_count: 0 }).eq("id", c.id);
      load();
    }
  }, [load]);

  const sendAsAurora = async () => {
    if (!activeConv || !testMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: testMessage,
          conversation_id: activeConv.id,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "fail");
      setTestMessage("");
      toast.success("Aurora odpowiedziała");
      openConv(activeConv);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const sendAdminReply = async () => {
    if (!activeConv || !adminReply.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("aurora_messages").insert({
        conversation_id: activeConv.id,
        role: "assistant",
        content: adminReply,
        metadata: { sent_by: "admin" },
      });
      if (error) throw error;
      setAdminReply("");
      openConv(activeConv);
      toast.success("Wiadomość wysłana");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const approveDraft = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("aurora_approve_intake_draft", { _draft_id: id });
      if (error) throw error;
      toast.success(`✅ Zlecenie utworzone: ${data}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const rejectDraft = async (id: string) => {
    const reason = prompt("Powód odrzucenia:");
    if (!reason) return;
    try {
      const { error } = await supabase.rpc("aurora_reject_intake_draft", { _draft_id: id, _reason: reason });
      if (error) throw error;
      toast.success("Draft odrzucony");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const closeConv = async (id: string) => {
    await supabase.from("aurora_conversations").update({ status: "closed" }).eq("id", id);
    setActiveConv(null);
    load();
  };

  const copyIngestUrl = () => {
    navigator.clipboard.writeText(ingestUrl);
    toast.success("URL skopiowany");
  };

  const pendingDrafts = drafts.filter(d => d.status === "ready_for_approval" || d.status === "collecting");
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{clients.length}</div><div className="text-xs text-muted-foreground">klientów CRM</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{conversations.filter(c => c.status === "active").length}</div><div className="text-xs text-muted-foreground">aktywne rozmowy</div></CardContent></Card>
        <Card className={totalUnread > 0 ? "border-primary" : ""}><CardContent className="pt-6"><div className="text-2xl font-bold">{totalUnread}</div><div className="text-xs text-muted-foreground">nieprzeczytane</div></CardContent></Card>
        <Card className={pendingDrafts.length > 0 ? "border-amber-500/50" : ""}><CardContent className="pt-6"><div className="text-2xl font-bold">{pendingDrafts.length}</div><div className="text-xs text-muted-foreground">drafty czekają</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2"><Inbox className="w-4 h-4" />Webhook ingest URL (n8n / kanały)</span>
            <Button size="sm" variant="ghost" onClick={copyIngestUrl}><Copy className="w-3 h-3 mr-1" />Kopiuj</Button>
          </CardTitle>
          <CardDescription className="font-mono text-xs break-all">{ingestUrl}</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          POST JSON: <code>{`{ message, channel, thread_id, sender:{email,phone,full_name,company,external_id:{key,value}} }`}</code>
        </CardContent>
      </Card>

      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts"><FileText className="w-3 h-3 mr-1" />Drafty <Badge className="ml-2" variant="secondary">{pendingDrafts.length}</Badge></TabsTrigger>
          <TabsTrigger value="conversations"><MessageSquare className="w-3 h-3 mr-1" />Rozmowy</TabsTrigger>
          <TabsTrigger value="clients"><Users className="w-3 h-3 mr-1" />Klienci CRM</TabsTrigger>
        </TabsList>

        {/* DRAFTS */}
        <TabsContent value="drafts" className="mt-4 space-y-2">
          {drafts.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground text-sm">Brak draftów. Aurora utworzy je gdy zacznie rozmawiać z klientami.</CardContent></Card>}
          {drafts.map(d => {
            const client = clients.find(c => c.id === d.client_id);
            return (
              <Card key={d.id} className={d.status === "ready_for_approval" ? "border-amber-500/50" : ""}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline">{d.service_type ?? "?"}</Badge>
                        <Badge className={
                          d.status === "approved" ? "bg-emerald-500/20 text-emerald-300" :
                          d.status === "ready_for_approval" ? "bg-amber-500/20 text-amber-300" :
                          d.status === "rejected" ? "bg-red-500/20 text-red-300" :
                          "bg-blue-500/20 text-blue-300"
                        }>{d.status}</Badge>
                        {d.confidence != null && <span className="text-xs text-muted-foreground">conf: {(d.confidence * 100).toFixed(0)}%</span>}
                        {d.budget_eur != null && <span className="text-xs">${d.budget_eur}</span>}
                        {d.deadline && <span className="text-xs">⏰ {d.deadline}</span>}
                      </div>
                      {client && <div className="text-xs text-muted-foreground">{client.full_name ?? client.email ?? "?"} · {client.company ?? ""}</div>}
                      <p className="text-sm mt-2">{d.brief}</p>
                      {d.ai_proposal && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Propozycja Aurory</summary>
                          <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto">{JSON.stringify(d.ai_proposal, null, 2)}</pre>
                        </details>
                      )}
                      {d.rejection_reason && <div className="text-xs text-red-300 mt-1">Odrzucone: {d.rejection_reason}</div>}
                      {d.resulting_order_id && <div className="text-xs text-emerald-300 mt-1">→ order: {d.resulting_order_id.slice(0, 8)}</div>}
                    </div>
                    {(d.status === "collecting" || d.status === "ready_for_approval") && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => approveDraft(d.id)}><CheckCircle2 className="w-3 h-3 mr-1" />Akceptuj</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectDraft(d.id)}><XCircle className="w-3 h-3 mr-1" />Odrzuć</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* CONVERSATIONS */}
        <TabsContent value="conversations" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Rozmowy</CardTitle></CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-1">
                    {conversations.map(c => {
                      const client = clients.find(cl => cl.id === c.client_id);
                      return (
                        <button key={c.id} onClick={() => openConv(c)}
                          className={`w-full text-left p-2 rounded hover:bg-muted transition ${activeConv?.id === c.id ? "bg-muted" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{client?.full_name ?? client?.email ?? c.channel_thread_id ?? "Anon"}</span>
                            {c.unread_count > 0 && <Badge variant="default" className="text-[10px] h-4">{c.unread_count}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] h-4">{c.channel}</Badge>
                            <span>{formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: pl })}</span>
                          </div>
                        </button>
                      );
                    })}
                    {conversations.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">Brak rozmów</div>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{activeConv ? `Konwersacja · ${activeConv.channel}` : "Wybierz rozmowę"}</CardTitle>
                {activeConv && <Button size="sm" variant="outline" onClick={() => closeConv(activeConv.id)}>Zamknij</Button>}
              </CardHeader>
              <CardContent>
                {!activeConv ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">— wybierz rozmowę z listy —</div>
                ) : (
                  <>
                    <ScrollArea className="h-[420px] mb-3 pr-2">
                      <div className="space-y-2">
                        {messages.map(m => (
                          <div key={m.id} className={`p-2 rounded text-sm ${
                            m.role === "user" ? "bg-muted" :
                            m.role === "assistant" ? "bg-primary/10 border border-primary/20" :
                            "bg-amber-500/10 text-xs"
                          }`}>
                            <div className="text-[10px] uppercase text-muted-foreground mb-1">
                              {m.role} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: pl })}
                            </div>
                            <div className="whitespace-pre-wrap">{m.content}</div>
                            {m.tool_call && (
                              <details className="mt-1 text-[10px]">
                                <summary className="cursor-pointer text-muted-foreground">tool_call</summary>
                                <pre className="overflow-x-auto">{JSON.stringify(m.tool_call, null, 2)}</pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">💬 Symuluj wiadomość klienta (Aurora odpowie)</div>
                        <div className="flex gap-2">
                          <Input value={testMessage} onChange={e => setTestMessage(e.target.value)} placeholder="Cześć, potrzebuję landing page..." />
                          <Button size="sm" onClick={sendAsAurora} disabled={sending}>
                            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Aurora</>}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">✏️ Odpowiedz osobiście (jako admin)</div>
                        <div className="flex gap-2">
                          <Textarea value={adminReply} onChange={e => setAdminReply(e.target.value)} placeholder="Twoja odpowiedź..." rows={2} />
                          <Button size="sm" variant="outline" onClick={sendAdminReply} disabled={sending}>
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CLIENTS */}
        <TabsContent value="clients" className="mt-4 space-y-2">
          {clients.length === 0 && <Card><CardContent className="pt-6 text-center text-muted-foreground text-sm">Brak klientów. Pierwszy zostanie utworzony gdy ktoś napisze do Aurory.</CardContent></Card>}
          {clients.map(c => (
            <Card key={c.id}>
              <CardContent className="pt-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.full_name ?? c.email ?? "Bez nazwy"}</span>
                    {c.company && <Badge variant="outline">{c.company}</Badge>}
                    {c.preferred_language && <Badge variant="secondary" className="text-[10px]">{c.preferred_language}</Badge>}
                    {c.tags?.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1 flex-wrap">
                    {c.email && <span>📧 {c.email}</span>}
                    {c.phone && <span>📞 {c.phone}</span>}
                    <span>🛒 {c.total_orders} zleceń</span>
                    <span>💰 ${Number(c.total_revenue_eur).toFixed(0)}</span>
                    {c.last_contact_at && <span>⏱️ {formatDistanceToNow(new Date(c.last_contact_at), { addSuffix: true, locale: pl })}</span>}
                  </div>
                  {c.notes && <div className="text-xs text-muted-foreground mt-1 italic">{c.notes}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
