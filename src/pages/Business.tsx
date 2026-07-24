import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Sparkles, Send, Bot, User, Loader2, ArrowRight, Check,
  Search, FileText, Layout, Share2, Workflow, Target,
  Music, Radio, HardDrive, Megaphone, Mail, MessageSquare, Mic, MicOff, Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { speak, stopSpeaking } from "@/utils/tts";
import businessHeroBg from "@/assets/business-hero-bg.jpg";
import { AuroraBackground } from "@/components/effects/AuroraBackground";
import { BrainVisualization } from "@/components/effects/BrainVisualization";
import { ServicesScroller } from "@/components/business/ServicesScroller";
import { askAuroraB2B } from "@/lib/hubAurora";

type ChatMessage = { role: "user" | "assistant"; content: string; ts: number };
type BriefField = { key: string; label: string; description: string; required: boolean; value: any; status: "collected" | "missing_required" | "missing_optional" };
type BriefState = { collected: Record<string, any>; missing: string[]; table: BriefField[]; next_question: string | null };

const SERVICES = [
  {
    icon: Search, key: "seo_audit",
    name: "SEO Audit",
    price: "od 149 $",
    desc: "Pełen audyt techniczny + content + strategia. Aurora analizuje, zespół wdraża.",
    bullets: ["Core Web Vitals", "Lighthouse + Ahrefs sweep", "Plan działań na 90 dni"],
  },
  {
    icon: FileText, key: "seo_content",
    name: "SEO Content",
    price: "od 49 $/art",
    desc: "Artykuły blogowe pisane przez Aurorę pod konkretne intencje wyszukiwania.",
    bullets: ["1500–3000 słów", "Schema + meta + interlinking", "Publikacja na Twojej domenie"],
  },
  {
    icon: Layout, key: "landing_page",
    name: "Landing Page",
    price: "od 299 $",
    desc: "Premium landing page wygenerowany i deployowany w 48h.",
    bullets: ["Design + copy + form", "A/B test ready", "Hosting w cenie"],
  },
  {
    icon: Share2, key: "social_post",
    name: "Social Posts",
    price: "od 19 $/post",
    desc: "Posty Reels/TikTok/IG ze scenariuszem, hookami i grafiką.",
    bullets: ["Hook + CTA + hashtagi", "9:16 ready-to-record", "Pakiety 5/10/20"],
  },
  {
    icon: Workflow, key: "automation_flow",
    name: "Automatyzacja n8n",
    price: "od 199 $",
    desc: "Workflow n8n / make.com pisany przez Aurorę i podłączany do Twoich systemów.",
    bullets: ["Audyt → projekt → wdrożenie", "Webhook + AI nodes", "Dokumentacja po polsku"],
  },
  {
    icon: Target, key: "lead_research",
    name: "Lead Research",
    price: "od 99 $/100 lead",
    desc: "Aurora znajduje, weryfikuje i klasyfikuje leady B2B w Twojej niszy.",
    bullets: ["LinkedIn + email + phone", "Score 1–10", "CSV + CRM sync"],
  },
];

const STREAM_OFFER = [
  { icon: Music, label: "Muzyka na zamówienie", desc: "Tracki Suno + miks + mastering" },
  { icon: Radio, label: "Radio dla marki", desc: "Własna stacja 24/7 z brandingiem" },
  { icon: HardDrive, label: "Hosting audio R2", desc: "Niezawodny streaming, niskie egress" },
  { icon: Megaphone, label: "Sponsoring blogowy", desc: "Dotrzyj do tysięcy słuchaczy" },
];

export default function BusinessPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Cześć! Jestem **Aurora** — asystentka biznesowa GrouAI Stream 🌌\n\nPowiedz mi czego szukasz: audyt SEO, landing page, automatyzacja, lead research, muzyka na zamówienie? Zbiorę brief i nasz zespół wróci do Ciebie z konkretną wyceną.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const [draftSaved, setDraftSaved] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [briefState, setBriefState] = useState<BriefState | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    document.title = "Usługi B2B Aurora — SEO, automatyzacja, muzyka, hosting | GrouAI Stream";
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", "Premium usługi B2B ze wsparciem Aurory — asystenta GrouAI Stream. SEO, automatyzacja n8n, lead research, hosting audio, sponsoring i muzyka na zamówienie.");
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setMessages((m) => [...m, { role: "user", content: msg, ts: Date.now() }]);
    setInput("");
    setLoading(true);

    try {
      const data = await askAuroraB2B({
        message: msg,
        conversation_id: conversationId,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        client_hint: {
          email: email || user?.email || undefined,
          full_name: user?.user_metadata?.display_name || undefined,
        },
        order_placed: orderPlaced,
      });

      if (!data?.ok) throw new Error(data?.error || "Aurora nie odpowiada");

      if (data.conversation_id && !conversationId) setConversationId(data.conversation_id);
      if (data.brief_state) setBriefState(data.brief_state as BriefState);

      const orderHit = (data.tool_results || []).find((t: any) => t.tool === "place_order" && t.ok);
      const draftHit = (data.tool_results || []).some((t: any) => t.tool === "save_intake_draft");
      if (orderHit) {
        setOrderPlaced(true);
        setDraftSaved(true);
        toast.success(`🚀 Zlecenie #${orderHit.short_id} przekazane do ${orderHit.worker}`, { duration: 6000 });
      } else if (draftHit && !draftSaved) {
        setDraftSaved(true);
        toast.success("✨ Twój brief został zapisany u Aurory");
      }

      const reply = data.reply || "…";
      setMessages((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
      if (voiceEnabled) void speak(reply.replace(/[*_`#]/g, ""), { lang: "pl-PL", mode: "assistant" });
    } catch (e: any) {
      toast.error(e?.message || "Błąd komunikacji z Aurorą");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ Coś poszło nie tak. Spróbuj jeszcze raz za chwilę.", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickStart = (key: string, name: string) => {
    send(`Cześć Aurora, jestem zainteresowany usługą: **${name}**. Opowiedz mi szczegóły i zapytaj o moje potrzeby.`);
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome albo Edge.");
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast.error("Nie mogę odczytać mikrofonu. Sprawdź zgodę w przeglądarce.");
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) void send(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (!next) stopSpeaking();
    else toast.success("Rozmowa głosowa Aurory włączona");
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Subtle office + radio station background */}
      <div className="absolute inset-0 -z-20">
        {/* Office background - very subtle */}
        <div
          className="absolute inset-0 opacity-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='1920' height='1080' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='office' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23333333;stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:%23666666;stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1920' height='1080' fill='url(%23office)'/%3E%3Ccircle cx='200' cy='200' r='150' fill='%23888888' opacity='0.3'/%3E%3Crect x='300' y='150' width='400' height='300' fill='%23555555' opacity='0.2'/%3E%3Ccircle cx='1700' cy='800' r='200' fill='%238800ff' opacity='0.15'/%3E%3C/svg%3E")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Animated Aurora background (global look) */}
        <AuroraBackground showFace />
      </div>

      {/* Premium glassmorphic overlay */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient overlay - subtle */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background/95" />

        {/* Ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(190_100%_50%/0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(210_100%_45%/0.1),transparent_55%)]" />

        {/* Animated light orbs */}
        <motion.div
          className="absolute top-20 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-[hsl(190_100%_50%/0.06)] blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-32 right-1/4 h-[400px] w-[600px] rounded-full bg-[hsl(210_100%_45%/0.05)] blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 12, repeat: Infinity, delay: 1 }}
        />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(190 100% 50% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(190 100% 50% / 0.4) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* HERO */}
      <section className="relative max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 text-xs text-cyan-300 mb-6 backdrop-blur"
        >
          <Sparkles className="h-3 w-3" /> Aurora · Twój asystent działu B2B
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-7xl font-bold leading-tight mb-5 bg-gradient-to-br from-foreground via-cyan-200 to-blue-400 bg-clip-text text-transparent"
        >
          Twój zespół B2B<br />pracuje 24/7 w tle.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
        >
          Aurora pomaga zebrać brief i przygotować wycenę. Każde zapytanie analizuje
          i realizuje nasz zespół — Ty masz jeden, wygodny punkt kontaktu.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Button
            size="lg"
            className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_30px_hsl(210_100%_50%/0.5)] gap-2"
            onClick={() => document.getElementById("aurora-chat")?.scrollIntoView({ behavior: "smooth" })}
          >
            <MessageSquare className="h-4 w-4" /> Pogadaj z Aurorą
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full border-cyan-400/40 hover:bg-cyan-400/10 gap-2"
            onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
          >
            Zobacz usługi <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            asChild
            size="lg"
            className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-[0_0_30px_hsl(160_80%_45%/0.5)] gap-2"
          >
            <Link to="/client-dashboard">
              <Layout className="h-4 w-4" /> Dashboard Zleceniodawcy 🎯
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* SERVICES — LIVE HORIZONTAL SCROLLER */}
      <section id="services" className="relative max-w-7xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground via-cyan-100 to-blue-200 bg-clip-text text-transparent">
            Usługi, które robi Aurora
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Przewiń kółkiem myszy albo palcem — każda karta przesuwna jak rolka usług. Aurora żyje obok Ciebie 24/7.
          </p>
        </motion.div>

        {/* Glassmorphic Services Carousel */}
        <div className="relative group">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
          <div className="relative rounded-2xl backdrop-blur-xl overflow-hidden border border-cyan-400/20">
            <ServicesScroller services={SERVICES} onPick={quickStart} />
          </div>
        </div>
      </section>

      {/* STREAM-NATIVE OFFER */}
      <section className="relative max-w-6xl mx-auto px-4 py-12">
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-purple-500/30 opacity-70 blur-[3px]" />
          <div className="relative rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-card/95 via-card/70 to-background/60 backdrop-blur-xl p-8 md:p-12 shadow-[0_20px_70px_-20px_hsl(210_100%_30%/0.5),inset_0_1px_0_hsl(190_100%_70%/0.1)] overflow-hidden">
            <div className="absolute top-0 right-0 h-64 w-64 bg-cyan-400/10 blur-3xl rounded-full -translate-y-20 translate-x-20" />
            <div className="absolute bottom-0 left-0 h-64 w-64 bg-blue-500/10 blur-3xl rounded-full translate-y-20 -translate-x-20" />
            <div className="relative text-center mb-8">
              <Badge className="mb-3 bg-blue-500/15 text-blue-300 border-blue-400/40 shadow-[0_0_20px_hsl(210_100%_50%/0.3)]">Tylko u nas</Badge>
              <h2 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-foreground via-cyan-100 to-blue-200 bg-clip-text text-transparent">Dla klientów ze świata muzyki</h2>
              <p className="text-muted-foreground text-sm">GrouAI Stream daje to, czego nie ma żadna agencja SEO.</p>
            </div>
            <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STREAM_OFFER.map((o, i) => {
                const Icon = o.icon;
                return (
                  <motion.div
                    key={i}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="group/card flex gap-3 items-start p-4 rounded-xl bg-gradient-to-br from-background/80 to-background/40 border border-cyan-400/15 hover:border-cyan-400/50 backdrop-blur shadow-[0_4px_20px_-8px_hsl(210_100%_30%/0.4)] hover:shadow-[0_8px_30px_-8px_hsl(190_100%_50%/0.5)] transition-all"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-cyan-400/30 blur-md rounded-lg" />
                      <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-cyan-200 drop-shadow-[0_0_6px_hsl(190_100%_50%/0.8)]" />
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{o.label}</div>
                      <div className="text-xs text-muted-foreground">{o.desc}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          <div className="text-center mt-8">
            <Link to="/sponsor">
              <Button variant="ghost" className="text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10">
                Zobacz pakiety sponsorskie <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          </div>
        </div>
      </section>

      {/* CHAT WITH AURORA */}
      <section id="aurora-chat" className="relative max-w-5xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 text-xs text-cyan-300 mb-6 backdrop-blur"
          >
            <Bot className="h-3.5 w-3.5 animate-pulse" /> Live · Aurora odpowiada w ~3s
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground via-cyan-100 to-blue-200 bg-clip-text text-transparent">
            Pogadaj z Aurorą
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Powiedz, co potrzebujesz. Zbierze brief, pomoże, doradzi. Mówisz polszczyzną? Mów! 🎙️
          </p>
        </motion.div>

        {/* Premium Glassmorphic Chat Container */}
        <div className="relative group">
          <div className="absolute -inset-[2px] rounded-3xl bg-gradient-to-br from-cyan-400/40 via-blue-500/30 to-purple-500/40 opacity-50 group-hover:opacity-70 blur-xl transition-opacity" />
          <Card className="relative border-cyan-400/40 bg-gradient-to-br from-card/90 via-card/80 to-background/70 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] overflow-hidden border border-cyan-400/30">
            {!user?.email && (
            <div className="border-b border-border/60 p-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-background/40">
              <Mail className="h-4 w-4 text-cyan-300 flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-shrink-0">Twój email (do kontaktu):</span>
              <Input
                type="email"
                placeholder="ty@firma.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm flex-1"
              />
            </div>
          )}

          <div ref={scrollRef} className="h-[520px] overflow-y-auto p-6 sm:p-8 space-y-5 bg-gradient-to-b from-background/40 via-background/30 to-background/50">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={cn("flex gap-4", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "assistant" && (
                    <motion.div
                      className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_hsl(210_100%_50%/0.6)]"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="h-5 w-5 text-white" />
                    </motion.div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed backdrop-blur-sm transition-all",
                      m.role === "user"
                        ? "bg-gradient-to-br from-cyan-500/90 to-blue-600/90 text-white rounded-br-none shadow-lg hover:shadow-xl border border-cyan-400/50"
                        : "bg-white/10 text-foreground rounded-bl-none border border-cyan-400/30 hover:border-cyan-400/50 hover:bg-white/15"
                    )}
                  >
                    {renderMarkdownLite(m.content)}
                  </div>
                  {m.role === "user" && (
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center w-full py-10"
                >
                  <motion.div
                    className="backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-cyan-400/30"
                  >
                    <BrainVisualization isThinking={true} intensity="high" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-cyan-400/20 p-4 flex gap-3 bg-gradient-to-r from-background/60 via-background/50 to-background/60 backdrop-blur-sm"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant={voiceEnabled ? "default" : "outline"}
                onClick={toggleVoice}
                className={cn(
                  "shrink-0 rounded-lg transition-all",
                  voiceEnabled
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg"
                    : "border-cyan-400/30 hover:bg-cyan-400/10"
                )}
                title={voiceEnabled ? "Wyłącz głos Aurora" : "Włącz głos Aurora"}
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="outline"
                onClick={startVoiceInput}
                disabled={loading || listening}
                className={cn(
                  "shrink-0 rounded-lg border-cyan-400/30 transition-all",
                  listening && "bg-cyan-500/20 text-cyan-200 border-cyan-400/60 shadow-[0_0_15px_hsl(190_100%_50%/0.5)]"
                )}
                title="Mów do Aurory"
              >
                {listening ? (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                    <Loader2 className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </motion.div>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Słucham…" : "Napisz albo mów do Aurora…"}
              disabled={loading}
              className="flex-1 rounded-lg bg-white/10 border-cyan-400/30 focus:border-cyan-400/60 focus:bg-white/15 text-foreground placeholder:text-muted-foreground/60 backdrop-blur-sm transition-all"
            />

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {loading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                    <Loader2 className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          </form>
          </Card>
        </div>

        {/* Brief checklist — co Aurora już wie, czego jej brakuje */}
        {briefState && briefState.table && briefState.table.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="border-cyan-400/30 bg-card/70 backdrop-blur shadow-[0_0_40px_hsl(210_100%_50%/0.08)]">
              <div className="p-4 border-b border-border/60 flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-300" />
                <h3 className="font-semibold text-sm">Co Aurora już wie · czego jeszcze potrzebuje</h3>
                <Badge variant="secondary" className="ml-auto bg-cyan-400/15 text-cyan-200 border border-cyan-400/30 text-xs">
                  {briefState.table.filter((f) => f.status === "collected").length}/{briefState.table.length}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Pole</th>
                      <th className="text-left px-3 py-2 font-medium">Opis</th>
                      <th className="text-left px-3 py-2 font-medium">Wartość / status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {briefState.table.map((f) => (
                      <tr key={f.key} className="border-t border-border/40">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            {f.label}
                            {f.required && <span className="text-rose-400 text-[10px]">*</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">{f.description}</td>
                        <td className="px-3 py-2 align-top text-xs">
                          {f.status === "collected" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300">
                              <Check className="h-3 w-3" />
                              <span className="truncate max-w-[200px] inline-block">{String(f.value)}</span>
                            </span>
                          ) : f.status === "missing_required" ? (
                            <span className="text-rose-300">⚠ brakuje (wymagane)</span>
                          ) : (
                            <span className="text-muted-foreground/70">— opcjonalne</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {briefState.next_question && (
                <div className="p-3 border-t border-border/60 bg-background/40 text-xs text-cyan-200">
                  <span className="font-medium">Aurora pyta dalej:</span> {briefState.next_question}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-4">
          Każde zapytanie trafia do panelu admina i jest akceptowane przez człowieka przed startem prac.
        </p>
      </section>

      {/* FOOTER NOTE */}
      <section className="relative max-w-4xl mx-auto px-4 pb-20 text-center text-xs text-muted-foreground space-y-2">
        <p>Płatności obsługiwane przez Paddle · Faktura VAT automatycznie · GDPR-ready</p>
        <p>
          <Link to="/legal" className="text-cyan-400 hover:underline">Regulamin & polityka prywatności</Link>
          {" · "}
          <Link to="/sponsor" className="text-cyan-400 hover:underline">Sponsoring</Link>
          {" · "}
          <Link to="/earn" className="text-cyan-400 hover:underline">Zarabiaj z nami</Link>
        </p>
      </section>
    </div>
  );
}

// Lightweight markdown — bold + line breaks (avoid pulling in react-markdown for one screen)
function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="text-cyan-200">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
