import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Loader2, X, Plus, Music2, Upload,
  Library, Blend, Mic, Wand2, Brain, Zap, ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrackMixer } from "./TrackMixer";
import { VoiceRecorder } from "./VoiceRecorder";
import { uploadToR2 } from "@/lib/r2Upload";

type AIEngine = "our_ai" | "suno" | "elevenlabs";

const ENGINES: { id: AIEngine; label: string; backend: "auto" | "suno" | "elevenlabs" }[] = [
  { id: "our_ai", label: "Nasz AI", backend: "auto" },
  { id: "suno", label: "Suno", backend: "suno" },
  { id: "elevenlabs", label: "ElevenLabs", backend: "elevenlabs" },
];
type Msg = { role: "user" | "assistant"; content: string; meta?: any };

interface LibTrack {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string | null;
  cover_url: string | null;
}

const QUICK_ACTIONS = [
  { id: "fingerprint", label: "Brzmiej jak moje top 10", icon: Brain,
    prompt: "Wygeneruj utwór brzmiący jak moje ostatnie 10 ulubionych — weź mój ulubiony BPM, key i mood." },
  { id: "mood", label: "Co teraz pasuje?", icon: Wand2,
    prompt: "Sprawdź mój bieżący mood i zaproponuj 3 utwory które wygenerujemy teraz." },
  { id: "banger", label: "Zrób mi banger", icon: Zap,
    prompt: "Zrób mi banger — pełna struktura (intro, verse, chorus, bridge, drop, outro), 30s, najmocniejszy gatunek z mojej historii." },
];

const DOCK_W = 720;
const DOCK_H = 480;

export const StudioGrokDock = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Cześć 🎧 Jestem **GrouAI Studio**. Opisz utwór, wgraj sample lub wybierz utwory z biblioteki — zmiksuję, zremiksuję albo stworzę coś nowego." },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [engine, setEngine] = useState<AIEngine>("our_ai");

  // Add-ons UI
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libTracks, setLibTracks] = useState<LibTrack[]>([]);
  const [libLoading, setLibLoading] = useState(false);

  // Attachments staged for next message
  const [attachments, setAttachments] = useState<Array<{ kind: "sample" | "track" | "voice"; label: string; url?: string; trackId?: string }>>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Hover open/close with delay
  const handleEnter = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const handleLeave = () => {
    if (pinned) return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 350);
  };

  const loadLibrary = useCallback(async () => {
    if (!user) { toast.error("Zaloguj się"); return; }
    setLibLoading(true);
    const { data } = await supabase
      .from("tracks")
      .select("id,title,artist,audio_url,cover_url")
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .order("created_at", { ascending: false })
      .limit(40);
    setLibTracks((data || []) as LibTrack[]);
    setLibLoading(false);
  }, [user]);

  const handleSampleUpload = async (file: File) => {
    if (!user) { toast.error("Zaloguj się"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Max 25MB"); return; }
    const t = toast.loading("Wgrywam sample...");
    try {
      const res = await uploadToR2({ file, folder: "studio-samples" });
      setAttachments((p) => [...p, { kind: "sample", label: file.name, url: res.publicUrl }]);
      toast.success("Sample dodany do promptu", { id: t });
    } catch (e) {
      toast.error("Błąd uploadu", { id: t });
    }
  };

  const pickTrack = (tr: LibTrack) => {
    setAttachments((p) => [...p, { kind: "track", label: `${tr.title}${tr.artist ? " — " + tr.artist : ""}`, url: tr.audio_url || undefined, trackId: tr.id }]);
    setShowLibrary(false);
    toast.success("Utwór dołączony");
  };

  const removeAttachment = (i: number) => setAttachments((p) => p.filter((_, idx) => idx !== i));

  const send = useCallback(async (text: string) => {
    if (!text.trim() && attachments.length === 0) return;
    if (streaming) return;
    if (!user) { toast.error("Zaloguj się"); return; }

    // Compose user message with attachment hints
    const attachLines = attachments.map((a) =>
      a.kind === "sample" ? `🎚️ [Sample: ${a.label}](${a.url})`
      : a.kind === "track" ? `🎵 [Utwór z biblioteki: ${a.label}](${a.url ?? "#"})`
      : `🎤 [Voice clone: ${a.label}]`
    ).join("\n");
    const fullText = [text.trim(), attachLines].filter(Boolean).join("\n\n");

    // === ROUTING: jeśli prompt brzmi jak "wygeneruj" → studio-generate, inaczej chat
    const lower = text.toLowerCase();
    const isGenerate =
      text.includes("moich ostatnich 10") || text.includes("moje top 10") || text.includes("ulubionych — weź mój") ||
      /\b(wygenerz|wygeneruj|stwórz|zr[oó]b|skomponuj|nagraj|generate|create|make)\b/.test(lower) ||
      /\b(banger|utw[oó]r|piosenk|track|song|beat|melodi)/.test(lower);

    if (isGenerate) {
      setMessages((p) => [...p, { role: "user", content: fullText }]);
      setInput(""); setAttachments([]); setStreaming(true);
      try {
        const useFingerprint = text.includes("moich ostatnich 10") || text.includes("moje top 10") || text.includes("ulubionych — weź mój");
        const backend = ENGINES.find((e) => e.id === engine)?.backend || "auto";
        const { data: s } = await supabase.auth.getSession();
        const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({
            prompt: text,
            use_fingerprint: useFingerprint,
            engine: backend,
            quality: backend === "auto" ? "standard" : "premium",
            duration_seconds: 30,
            instrumental: backend === "auto",
          }),
        });
        const d = await r.json();
        if (!r.ok) {
          setMessages((p) => [...p, { role: "assistant", content: `❌ ${d.message || d.error || "Błąd"}` }]);
        } else {
          const fp = d.fingerprint;
          const sum = fp ? [
            fp.dominant_genre && `**Gatunek:** ${fp.dominant_genre}`,
            fp.dominant_mood && `**Mood:** ${fp.dominant_mood}`,
            fp.avg_bpm && `**BPM:** ${fp.avg_bpm}`,
          ].filter(Boolean).join(" · ") : "";
          const audio = d.audio_url ? `\n\n🎵 [Posłuchaj](${d.audio_url})` : "\n\n_Pojawi się w historii za 30-60s._";
          setMessages((p) => [...p, { role: "assistant", content: `🎧 **Generuję** (silnik: \`${d.engine}\`)${sum ? "\n\n" + sum : ""}${audio}` }]);
          toast.success(`Silnik: ${d.engine}`);
        }
      } catch (e: any) {
        toast.error(e?.message || "Błąd");
      } finally { setStreaming(false); }
      return;
    }

    const userMsg: Msg = { role: "user", content: fullText, meta: { attachments } };
    setMessages((p) => [...p, userMsg]);
    setInput(""); setAttachments([]); setStreaming(true);

    try {
      const { data: s } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          messages: [...messages, userMsg].slice(-12).map((m) => ({ role: m.role, content: m.content })),
          ai_engine: engine,
          attachments: userMsg.meta?.attachments || [],
        }),
      });
      if (!r.ok) {
        if (r.status === 429) toast.error("Za dużo zapytań");
        else if (r.status === 402) toast.error("Brak kredytów AI");
        else toast.error("Błąd AI");
        setMessages((p) => p.slice(0, -1));
        return;
      }
      if (!r.body) throw new Error("brak strumienia");

      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "", soFar = "", started = false, done = false;
      const upsert = (chunk: string) => {
        soFar += chunk;
        setMessages((p) => {
          if (!started) { started = true; return [...p, { role: "assistant", content: soFar }]; }
          return p.map((m, i) => i === p.length - 1 && m.role === "assistant" ? { ...m, content: soFar } : m);
        });
      };
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(j);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
      if (soFar) {
        await supabase.from("studio_chat_messages").insert({
          user_id: user.id, role: "assistant", content: soFar.substring(0, 4000), ai_model: engine,
        });
      }
    } catch (e: any) {
      toast.error(e?.message || "Błąd połączenia");
      setMessages((p) => p.slice(0, -1));
    } finally { setStreaming(false); }
  }, [messages, streaming, user, engine, attachments]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <>
      {/* Right-edge hover zone with vertical "GrAIstudio" tab */}
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center"
      >
        <button
          type="button"
          onClick={() => { setOpen(true); setPinned(true); }}
          className="group relative flex h-44 w-9 items-center justify-center rounded-l-xl border border-r-0 border-primary/40 bg-gradient-to-b from-primary/30 via-purple-500/20 to-primary/30 backdrop-blur-xl shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.7)] transition-all"
          aria-label="Otwórz GrAIstudio"
        >
          <span
            className="text-[11px] font-bold tracking-[0.25em] text-primary-foreground select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            GrAIstudio
          </span>
          <Sparkles className="absolute top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 text-primary animate-pulse" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: DOCK_W }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: DOCK_W }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            style={{ width: DOCK_W, height: DOCK_H }}
            className="fixed right-9 top-1/2 -translate-y-1/2 z-50 flex flex-col rounded-2xl rounded-r-none border border-r-0 border-primary/30 bg-background/95 backdrop-blur-2xl shadow-2xl shadow-primary/20 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/15 via-purple-500/10 to-transparent px-3 py-1.5 select-none">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold tracking-tight">GrouAI Studio</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Engine segmented control + close */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full border border-primary/30 bg-background/50 p-0.5">
                  {ENGINES.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEngine(e.id)}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full transition-all ${
                        engine === e.id
                          ? "bg-gradient-to-r from-primary to-purple-500 text-primary-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => { setPinned(false); setOpen(false); }}
                  aria-label="Zamknij"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Horizontal body: messages | right-rail (quick + input) */}
            <div className="flex flex-1 min-h-0">
              {/* Left: Messages (takes most width) */}
              <ScrollArea className="flex-1 px-3 py-2 border-r border-border/30" ref={scrollRef as any}>
                <div className="space-y-2">
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
                      }`}>
                        {m.role === "assistant" ? (
                          <div className="prose prose-xs prose-invert max-w-none [&_p]:my-0.5 [&_p]:leading-relaxed [&_a]:text-primary">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {streaming && (
                    <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{engine === "our_ai" ? "Nasz AI" : "ElevenLabs"} myśli…</span>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Right rail: quick actions + add-ons + input */}
              <div className="flex w-[340px] shrink-0 flex-col bg-card/20">
                {/* Quick actions */}
                <div className="border-b border-border/30 px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {QUICK_ACTIONS.map((a) => (
                      <Badge
                        key={a.id}
                        variant="secondary"
                        onClick={() => !streaming && send(a.prompt)}
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition text-[9px] gap-0.5 py-0.5 px-1.5"
                      >
                        <a.icon className="h-2.5 w-2.5" />
                        {a.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Add-ons (collapsible) */}
                <AnimatePresence initial={false}>
                  {addonsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-b border-border/30 bg-card/40 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-1.5 p-2">
                        <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-[10px] hover:border-primary/60 hover:bg-primary/5"
                          onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4 text-primary" />
                          Wgraj sample
                        </Button>
                        <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-[10px] hover:border-primary/60 hover:bg-primary/5"
                          onClick={() => { setShowLibrary(true); loadLibrary(); }}>
                          <Library className="h-4 w-4 text-primary" />
                          Z biblioteki
                        </Button>
                        <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-[10px] hover:border-primary/60 hover:bg-primary/5"
                          onClick={() => setShowMixer(true)}>
                          <Blend className="h-4 w-4 text-primary" />
                          Mix A + B
                        </Button>
                        <Button variant="outline" size="sm" className="h-auto flex-col gap-1 py-2 text-[10px] hover:border-primary/60 hover:bg-primary/5"
                          onClick={() => setShowVoice(true)}>
                          <Mic className="h-4 w-4 text-primary" />
                          Voice clone
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Attachments preview */}
                {attachments.length > 0 && (
                  <div className="border-b border-border/30 px-2 py-1.5 bg-primary/5">
                    <div className="flex flex-wrap gap-1">
                      {attachments.map((a, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] gap-1 pr-1 py-0.5">
                          {a.kind === "sample" ? "🎚️" : a.kind === "track" ? "🎵" : "🎤"}
                          <span className="max-w-[120px] truncate">{a.label}</span>
                          <button onClick={() => removeAttachment(i)} className="hover:text-destructive">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <form onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="mt-auto border-t border-border/50 p-2 bg-background/95">
                  <div className="flex items-end gap-1.5 rounded-xl border border-border bg-card/50 px-2 py-1.5 focus-within:border-primary/60 transition">
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => setAddonsOpen((v) => !v)}
                      className={`h-7 w-7 shrink-0 rounded-full ${addonsOpen ? "bg-primary/20 text-primary" : ""}`}
                      aria-label="Dodatki"
                    >
                      {addonsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKey}
                      placeholder="Opisz utwór, miks lub remix…"
                      rows={2}
                      disabled={streaming}
                      className="min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button type="submit" size="icon" disabled={(!input.trim() && attachments.length === 0) || streaming}
                      className="h-7 w-7 shrink-0 rounded-full">
                      {streaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                  </div>
                  <p className="mt-1 text-center text-[8px] text-muted-foreground">
                    Przeciągnij nagłówek · Shift+Enter = nowa linia
                  </p>
                </form>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSampleUpload(f);
                e.target.value = "";
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library picker dialog */}
      <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-4 w-4" /> Wybierz utwór z biblioteki
            </DialogTitle>
          </DialogHeader>
          {libLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="grid grid-cols-2 gap-2">
                {libTracks.map((t) => (
                  <button key={t.id} onClick={() => pickTrack(t)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card/50 p-2 text-left hover:bg-primary/10 hover:border-primary/40 transition">
                    {t.cover_url ? (
                      <img src={t.cover_url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Music2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{t.title}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{t.artist || "—"}</div>
                    </div>
                  </button>
                ))}
                {libTracks.length === 0 && (
                  <p className="col-span-2 text-center text-xs text-muted-foreground py-8">Brak utworów</p>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Mixer dialog */}
      <Dialog open={showMixer} onOpenChange={setShowMixer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Blend className="h-4 w-4" /> Mix A + B
            </DialogTitle>
          </DialogHeader>
          <TrackMixer />
        </DialogContent>
      </Dialog>

      {/* Voice clone dialog */}
      <Dialog open={showVoice} onOpenChange={setShowVoice}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-4 w-4" /> Voice Clone
            </DialogTitle>
          </DialogHeader>
          <VoiceRecorder
            clonedVoiceId={null}
            clonedVoiceLabel={null}
            onCleared={() => {}}
            onVoiceCloned={(voiceId, name) => {
              setAttachments((p) => [...p, { kind: "voice", label: name || "Mój głos", url: voiceId }]);
              setShowVoice(false);
              toast.success("Voice clone dodany do promptu");
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
