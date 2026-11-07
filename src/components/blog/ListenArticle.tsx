// „Posłuchaj artykułu” — czytanie zdanie po zdaniu głosem przeglądarki (bez kluczy, bez kosztów).
// Podświetla czytany akapit i przewija do niego; zdania osobno (omija limit długich wypowiedzi w Chrome).
// Wzór: Speakable / Listen (GitHub) — tu wpięte w nasz blog i język użytkownika.
import { useEffect, useRef, useState, type RefObject } from "react";
import { Headphones, Pause, Play, Square } from "lucide-react";

const BCP: Record<string, string> = { pl: "pl-PL", en: "en-US", nl: "nl-NL", ua: "uk-UA" };
const TXT: Record<string, { listen: string; pause: string; resume: string; stop: string; noVoice: string; of: string }> = {
  pl: { listen: "Posłuchaj artykułu", pause: "Pauza", resume: "Wznów", stop: "Zatrzymaj", noVoice: "Ta przeglądarka nie ma głosu w tym języku.", of: "z" },
  en: { listen: "Listen to this article", pause: "Pause", resume: "Resume", stop: "Stop", noVoice: "No voice for this language in this browser.", of: "of" },
  nl: { listen: "Luister naar dit artikel", pause: "Pauze", resume: "Hervat", stop: "Stop", noVoice: "Geen stem voor deze taal in deze browser.", of: "van" },
  ua: { listen: "Прослухати статтю", pause: "Пауза", resume: "Продовжити", stop: "Стоп", noVoice: "У браузері немає голосу цією мовою.", of: "з" },
};
const SPEEDS = [1, 1.25, 1.5];

type Chunk = { el: HTMLElement; text: string };

function chunksFrom(root: HTMLElement): Chunk[] {
  const out: Chunk[] = [];
  root.querySelectorAll<HTMLElement>("h2, h3, p, li, blockquote").forEach((el) => {
    if (el.closest("li") && el.tagName !== "LI") return; // akapit w punkcie listy czytamy raz (jako LI)
    if (el.tagName === "BLOCKQUOTE" && el.querySelector("p")) return;
    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    // zdania (do ~220 znaków) — krótkie wypowiedzi nie urywają się w Chrome
    const parts = text.match(/[^.!?…]+[.!?…]+["”»)]*|[^.!?…]+$/g) ?? [text];
    let buf = "";
    for (const s of parts) {
      if ((buf + s).length > 220 && buf) { out.push({ el, text: buf.trim() }); buf = ""; }
      buf += s;
    }
    if (buf.trim()) out.push({ el, text: buf.trim() });
  });
  return out;
}

export function ListenArticle({ target, lang, title }: { target: RefObject<HTMLElement>; lang: string; title: string }) {
  const t = TXT[lang] ?? TXT.pl;
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  const [pos, setPos] = useState({ i: 0, n: 0 });
  const [voiceOk, setVoiceOk] = useState(true);
  const chunks = useRef<Chunk[]>([]);
  const idx = useRef(0);
  const run = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const voice = () => {
    const vs = synth?.getVoices() ?? [];
    const want = (BCP[lang] ?? "pl-PL").toLowerCase();
    const norm = (l?: string) => (l || "").replace("_", "-").toLowerCase();
    return vs.find((v) => norm(v.lang) === want) ?? vs.find((v) => norm(v.lang).startsWith(want.slice(0, 2))) ?? null;
  };

  useEffect(() => {
    if (!synth) { setVoiceOk(false); return; }
    const check = () => setVoiceOk(!(synth.getVoices().length > 0 && !voice()));
    check();
    synth.addEventListener?.("voiceschanged", check);
    return () => { synth.removeEventListener?.("voiceschanged", check); synth.cancel(); clearMark(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const clearMark = () => document.querySelectorAll(".blog-reading").forEach((e) => e.classList.remove("blog-reading"));

  const speakFrom = (i: number, token: number) => {
    if (!synth || token !== run.current) return;
    const c = chunks.current[i];
    if (!c) { setState("idle"); clearMark(); setPos((p) => ({ ...p, i: p.n })); return; }
    idx.current = i;
    setPos({ i, n: chunks.current.length });
    if (!c.el.classList.contains("blog-reading")) {
      clearMark();
      c.el.classList.add("blog-reading");
      const r = c.el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 120) c.el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const u = new SpeechSynthesisUtterance(c.text);
    const v = voice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = BCP[lang] ?? "pl-PL";
    u.rate = rateRef.current;
    u.onend = () => speakFrom(i + 1, token);
    u.onerror = (e) => { if ((e as SpeechSynthesisErrorEvent).error !== "interrupted" && (e as SpeechSynthesisErrorEvent).error !== "canceled") speakFrom(i + 1, token); };
    synth.speak(u);
  };

  const start = (from = 0) => {
    if (!synth || !target.current) return;
    synth.cancel();
    if (!chunks.current.length || from === 0) chunks.current = [{ el: document.createElement("span"), text: title } as Chunk, ...chunksFrom(target.current)].filter((c) => c.text);
    const token = ++run.current;
    setState("playing");
    speakFrom(from, token);
  };

  const toggle = () => {
    if (!synth) return;
    if (state === "idle") start(0);
    else if (state === "playing") { synth.cancel(); run.current++; setState("paused"); }
    else start(idx.current);
  };
  const stop = () => { synth?.cancel(); run.current++; setState("idle"); clearMark(); setPos({ i: 0, n: 0 }); chunks.current = []; };
  const cycleRate = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next); rateRef.current = next;
    if (state === "playing") start(idx.current); // nowa prędkość od bieżącego zdania
  };

  const pct = pos.n ? Math.round((pos.i / pos.n) * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card/40 to-accent/10 p-3">
      <button type="button" onClick={toggle} disabled={!voiceOk}
        aria-label={state === "playing" ? t.pause : state === "paused" ? t.resume : t.listen}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.45)] transition hover:scale-105 disabled:opacity-40">
        {state === "playing" ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        {state === "playing" && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/30 motion-reduce:hidden" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Headphones className="h-4 w-4 text-primary" />
          <span className="truncate">{state === "idle" ? t.listen : state === "paused" ? t.resume : t.pause}</span>
          {pos.n > 0 && <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{pos.i + 1} {t.of} {pos.n}</span>}
        </div>
        {voiceOk ? (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/60" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        ) : <p className="mt-0.5 text-xs text-muted-foreground">{t.noVoice}</p>}
      </div>
      <button type="button" onClick={cycleRate} disabled={!voiceOk} className="h-8 shrink-0 rounded-full border border-border/60 px-2.5 text-xs font-bold tabular-nums hover:border-primary/50 disabled:opacity-40" aria-label="Speed">
        {rate}×
      </button>
      {state !== "idle" && (
        <button type="button" onClick={stop} aria-label={t.stop} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 hover:border-primary/50">
          <Square className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
