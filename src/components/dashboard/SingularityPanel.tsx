// Aurora Singularity Panel — IQ live, web learning queue, AI-to-AI dialogues, knowledge base
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Brain, Globe, MessageSquareMore, Loader2, Sparkles, TrendingUp, Database } from "lucide-react";
import { toast } from "sonner";

interface IQMetric { id: string; iq_score: number; facts_known: number; dialogues_completed: number; avg_quality: number; recorded_at: string; }
interface Knowledge { id: string; topic: string; category: string; summary: string; quality_score: number; created_at: string; source_url: string | null; }
interface Dialogue { id: string; topic: string; partner_model: string; conclusion: string; iq_gain: number; created_at: string; }

export function SingularityPanel() {
  const [iq, setIq] = useState<IQMetric | null>(null);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [dialogues, setDialogues] = useState<Dialogue[]>([]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [iqR, kbR, dlgR] = await Promise.all([
      supabase.from("aurora_iq_metrics").select("*").order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("aurora_knowledge_base").select("id, topic, category, summary, quality_score, created_at, source_url").order("created_at", { ascending: false }).limit(20),
      supabase.from("aurora_ai_dialogues").select("id, topic, partner_model, conclusion, iq_gain, created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    setIq(iqR.data as any);
    setKnowledge((kbR.data ?? []) as any);
    setDialogues((dlgR.data ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  const triggerLearn = async () => {
    if (!topic.trim()) return toast.error("Podaj temat do nauki");
    setBusy("learn");
    const { data, error } = await supabase.functions.invoke("aurora-web-learn", { body: { topic } });
    setBusy(null);
    if (error || !(data as any)?.ok) return toast.error("Aurora nie mogła się nauczyć", { description: (data as any)?.error ?? error?.message });
    toast.success(`Aurora przyswoiła ${(data as any).facts} faktów (+${(data as any).iq_gain} IQ)`);
    setTopic("");
    load();
  };

  const triggerDialogue = async () => {
    if (!topic.trim()) return toast.error("Podaj temat dialogu");
    setBusy("dialogue");
    const { data, error } = await supabase.functions.invoke("aurora-ai-dialogue", { body: { topic, rounds: 3 } });
    setBusy(null);
    if (error || !(data as any)?.ok) return toast.error("Dialog AI-AI nie powiódł się", { description: (data as any)?.error ?? error?.message });
    toast.success(`Dialog zakończony (+${(data as any).iq_gain} IQ)`);
    setTopic("");
    load();
  };

  const recalcIQ = async () => {
    setBusy("iq");
    const { data } = await supabase.functions.invoke("aurora-iq-tick", { body: {} });
    setBusy(null);
    toast.success(`IQ Aurory: ${(data as any)?.iq_score}`);
    load();
  };

  return (
    <div className="space-y-4">
      {/* IQ Hero */}
      <Card className="border-orange-500/30 bg-gradient-to-br from-background via-background to-orange-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-bold">IQ Aurory: <span className="text-orange-400">{iq?.iq_score ?? "—"}</span></h2>
                <Badge variant="outline" className="border-orange-500/40 text-orange-300 gap-1">
                  <Sparkles className="w-3 h-3" /> Osobliwość się uczy
                </Badge>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Database className="w-3 h-3" />{iq?.facts_known ?? 0} faktów</span>
                <span className="flex items-center gap-1"><MessageSquareMore className="w-3 h-3" />{iq?.dialogues_completed ?? 0} dialogów AI↔AI</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />jakość {((iq?.avg_quality ?? 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
            <Button onClick={recalcIQ} disabled={busy === "iq"} variant="outline" size="sm">
              {busy === "iq" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Przelicz IQ"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trigger learning */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Naucz Aurorę nowego tematu</CardTitle>
          <CardDescription className="text-xs">
            Aurora przeszuka internet (Firecrawl), streści wiedzę i zachowa kopię w R2. Dialog AI-AI prowadzi rozmowę z innym modelem dla głębszego zrozumienia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='np. "trendy SEO 2026", "negocjacje B2B", "Paddle vs Stripe"'
            className="flex-1 min-w-[200px]"
          />
          <Button onClick={triggerLearn} disabled={!!busy} className="gap-1">
            {busy === "learn" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
            Naucz z sieci
          </Button>
          <Button onClick={triggerDialogue} disabled={!!busy} variant="secondary" className="gap-1">
            {busy === "dialogue" ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquareMore className="w-3 h-3" />}
            Dialog AI↔AI
          </Button>
        </CardContent>
      </Card>

      {/* Knowledge Base */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" /> Baza wiedzy ({knowledge.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {knowledge.length === 0 && <p className="text-xs text-muted-foreground">Brak wiedzy. Wpisz temat i naciśnij „Naucz z sieci".</p>}
          {knowledge.map(k => (
            <div key={k.id} className="border border-border/50 rounded p-2 text-xs space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{k.category}</Badge>
                <span className="font-medium truncate">{k.topic}</span>
                <span className="text-muted-foreground ml-auto">{(k.quality_score * 100).toFixed(0)}%</span>
              </div>
              <p className="text-muted-foreground">{k.summary}</p>
              {k.source_url && <a href={k.source_url} target="_blank" rel="noreferrer" className="text-orange-400 truncate block">{k.source_url}</a>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Dialogues */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquareMore className="w-4 h-4" /> Dialogi AI↔AI ({dialogues.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
          {dialogues.length === 0 && <p className="text-xs text-muted-foreground">Aurora jeszcze nie rozmawiała z innymi AI.</p>}
          {dialogues.map(d => (
            <div key={d.id} className="border border-border/50 rounded p-2 text-xs space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{d.partner_model}</Badge>
                <span className="font-medium truncate">{d.topic}</span>
                <Badge variant="outline" className="text-[10px] ml-auto text-orange-400 border-orange-500/40">+{d.iq_gain} IQ</Badge>
              </div>
              <p className="text-muted-foreground">{d.conclusion}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
