// Aurora Negocjator — okno czatu, klient pisze co zmienić, Aurora analizuje + research z sieci + proponuje kompromis
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Search, ThumbsUp, ThumbsDown, Handshake, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import auroraAvatar from "@/assets/aurora-avatar.jpg";

interface ChangeReq {
  id: string; client_message: string; status: string;
  aurora_proposal: string | null; proposal_pros: string[] | null; proposal_cons: string[] | null;
  proposal_eta_minutes: number | null; proposal_extra_cost_eur: number | null;
  web_research: any; aurora_analysis: any;
  client_response: string | null; created_at: string;
}

export const AuroraNegotiatorPanel = ({ orderId }: { orderId: string }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ChangeReq[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("aurora_change_requests")
      .select("*").eq("order_id", orderId).order("created_at", { ascending: false });
    setRequests((data ?? []) as ChangeReq[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  useEffect(() => {
    const ch = supabase.channel(`changes-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aurora_change_requests", filter: `order_id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  const send = async () => {
    if (!message.trim() || !user) return;
    setSending(true);
    const { data: cr, error } = await supabase.from("aurora_change_requests").insert({
      order_id: orderId, user_id: user.id, client_message: message, status: "pending",
    } as any).select().single();
    if (error || !cr) { toast.error(error?.message ?? "Błąd"); setSending(false); return; }
    setMessage("");
    // Trigger Aurora negotiation
    supabase.functions.invoke("aurora-change-negotiate", { body: { change_request_id: cr.id } })
      .then(({ data, error }) => {
        if (error || !(data as any)?.ok) toast.error("Aurora nie mogła przeanalizować");
        else toast.success("Aurora odpowiedziała");
      });
    setSending(false);
    load();
  };

  const respond = async (id: string, resp: "accepted" | "rejected" | "compromise") => {
    const { error } = await supabase.from("aurora_change_requests")
      .update({ status: resp, client_response: resp, applied_at: resp === "accepted" ? new Date().toISOString() : null } as any)
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(resp === "accepted" ? "Zgoda — Aurora wdraża" : resp === "rejected" ? "Odrzucone" : "Idziemy na kompromis");
    load();
  };

  return (
    <div className="space-y-4">
      {/* Aurora intro */}
      <Card className="border-orange-500/30 bg-gradient-to-r from-orange-950/10 to-transparent">
        <CardContent className="p-4 flex items-start gap-3">
          <img src={auroraAvatar} alt="Aurora" width={56} height={56}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-orange-500/40" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Aurora</span>
              <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-[10px] gap-1">
                <Sparkles className="w-3 h-3" />AI Negocjator
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Napisz co chcesz zmienić w zleceniu. Sprawdzę w sieci czy da się zrobić lepiej, zważę plusy i minusy, i zaproponuję najlepsze rozwiązanie. Jeśli się nie zgadzamy — szukamy kompromisu.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Co chcesz zmienić?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="np. Zmień tone of voice na bardziej formalny / Dodaj sekcję case study / Skróć landing do 3 sekcji…"
            rows={3}
          />
          <Button onClick={send} disabled={sending || !message.trim()} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Wyślij Aurorze
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : requests.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Brak zmian — wszystko leci według planu 🚀</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-3">
                {/* Klient */}
                <div className="flex items-start gap-2">
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px]">Ty</Badge>
                  <p className="text-sm flex-1">{r.client_message}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: pl })}
                  </span>
                </div>

                {/* Aurora analyzing */}
                {r.status === "pending" || r.status === "analyzing" ? (
                  <div className="flex items-center gap-2 text-sm text-orange-300 bg-orange-500/5 border border-orange-500/20 rounded p-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aurora sprawdza w sieci czy da się zrobić lepiej…
                  </div>
                ) : r.status === "failed" ? (
                  <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded p-3">
                    Aurora miała problem z analizą. Spróbuj sformułować inaczej.
                  </div>
                ) : r.aurora_proposal && (
                  <div className="space-y-3 border-l-2 border-orange-500/40 pl-3">
                    <div className="flex items-start gap-2">
                      <img src={auroraAvatar} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">Aurora</span>
                          {r.web_research?.found_better && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 text-emerald-300">
                              <Search className="w-3 h-3" />Znalazłam lepszą opcję
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">{r.aurora_proposal}</p>
                      </div>
                    </div>

                    {(r.proposal_pros?.length || r.proposal_cons?.length) ? (
                      <div className="grid md:grid-cols-2 gap-2 text-xs">
                        {r.proposal_pros && r.proposal_pros.length > 0 && (
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                            <div className="font-semibold text-emerald-300 mb-1">✓ Plusy</div>
                            <ul className="space-y-0.5">{r.proposal_pros.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                          </div>
                        )}
                        {r.proposal_cons && r.proposal_cons.length > 0 && (
                          <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                            <div className="font-semibold text-red-300 mb-1">✗ Minusy</div>
                            <ul className="space-y-0.5">{r.proposal_cons.map((p, i) => <li key={i}>• {p}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {r.proposal_eta_minutes ? <span>⏱ ~{r.proposal_eta_minutes} min</span> : null}
                      {r.proposal_extra_cost_eur ? <span>💰 +{r.proposal_extra_cost_eur} $</span> : <span>💰 bez dopłat</span>}
                    </div>

                    {r.status === "proposed" && (
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" onClick={() => respond(r.id, "accepted")} className="gap-1">
                          <ThumbsUp className="w-3 h-3" />Zgadzam się
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => respond(r.id, "compromise")} className="gap-1">
                          <Handshake className="w-3 h-3" />Kompromis
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => respond(r.id, "rejected")} className="gap-1 text-red-400">
                          <ThumbsDown className="w-3 h-3" />Nie
                        </Button>
                      </div>
                    )}
                    {r.status === "accepted" && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Zaakceptowano — Aurora wdraża</Badge>}
                    {r.status === "rejected" && <Badge variant="outline">Odrzucone</Badge>}
                    {r.status === "compromise" && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Negocjacja kompromisu</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
