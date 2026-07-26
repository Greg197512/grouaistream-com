import { useRef, useState } from "react";
import { usePlayer, type Track } from "@/contexts/PlayerContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { whisperFeeling } from "@/lib/hubStudio";
import { Moon, Mic, MicOff, Loader2, X, Send } from "lucide-react";

/**
 * „SZEPT O 4:17" — powiedz/napisz jednym zdaniem, jak się czujesz. AI czyta
 * emocję pod słowami i znajduje TEN jeden utwór, który pasuje do tego stanu.
 * Empatyczny, cichy, nocny — działa też po ciemku, bez kamery.
 */
const TRACK_SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";
const SPEECH_LANG: Record<string, string> = { pl: "pl-PL", en: "en-US", nl: "nl-NL", ua: "uk-UA" };
const PLACEHOLDER: Record<string, string> = {
  pl: "Powiedz jej szeptem, jak się czujesz o 4:17…",
  en: "Whisper how you feel at 4:17 AM…",
  nl: "Fluister hoe je je voelt om 4:17…",
  ua: "Прошепчи, як ти почуваєшся о 4:17…",
};

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export function WhisperDJ({ onClose }: { onClose?: () => void }) {
  const { playTrack } = usePlayer();
  const { language } = useLanguage();
  const lang = ["pl", "en", "nl", "ua"].includes(language) ? language : "pl";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [reply, setReply] = useState<{ emoji: string; mood: string; line: string; track?: Track } | null>(null);
  const [err, setErr] = useState("");
  const recogRef = useRef<any>(null);

  const listen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setErr("Twoja przeglądarka nie obsługuje mowy — po prostu napisz."); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    recogRef.current = r;
    r.lang = SPEECH_LANG[lang] || "pl-PL";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((x: any) => x[0].transcript).join(" ");
      setText(t);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    setErr(""); setListening(true); r.start();
  };

  const pickTrack = async (genres: string[], moods: string[]): Promise<Track | null> => {
    // Najpierw po gatunku, potem po nastroju — pula, z której losujemy TEN jeden.
    let pool: Track[] = [];
    const g = await supabase.from("tracks").select(TRACK_SELECT)
      .or("audio_url.not.is.null,video_url.not.is.null")
      .in("genre", genres).limit(50);
    pool = ((g.data as Track[]) || []).filter((t) => t.audio_url || t.video_url);
    if (pool.length < 4 && moods.length) {
      const orMood = moods.map((m) => `mood.ilike.%${m}%`).join(",");
      const mq = await supabase.from("tracks").select(TRACK_SELECT)
        .or("audio_url.not.is.null,video_url.not.is.null").or(orMood).limit(50);
      const seen = new Set(pool.map((t) => t.id));
      pool = [...pool, ...(((mq.data as Track[]) || []).filter((t) => (t.audio_url || t.video_url) && !seen.has(t.id)))];
    }
    if (pool.length === 0) return null;
    return shuffle(pool)[0];
  };

  const submit = async () => {
    const t = text.trim();
    if (t.length < 2 || busy) return;
    recogRef.current?.stop?.(); setListening(false);
    setBusy(true); setErr(""); setReply(null);
    try {
      const reading = await whisperFeeling(t, lang);
      if (!reading?.ok) throw new Error(reading?.error === "ai_not_configured" ? "AI chwilowo niedostępne" : "Nie udało się odczytać — spróbuj inaczej ująć to w słowa");
      const track = await pickTrack(reading.genres, reading.moods);
      setReply({
        emoji: reading.emoji || "🌙",
        mood: reading.mood_label || "",
        line: reading.reply || "Jest utwór, który to rozumie.",
        track: track || undefined,
      });
      if (track) playTrack(track, "whisper-dj");
    } catch (e: any) {
      setErr(e?.message || "Coś poszło nie tak");
    } finally { setBusy(false); }
  };

  return (
    <div className="relative rounded-3xl border border-[#B026FF]/40 p-5 sm:p-6 overflow-hidden"
      style={{ background: "radial-gradient(120% 100% at 20% 0%, rgba(176,38,255,.18), transparent 60%), linear-gradient(160deg,#0f0a1e,#160d20)" }}>
      {onClose && (
        <button onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/60 hover:text-white" aria-label="Zamknij">
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Moon className="h-5 w-5 text-[#c99bff]" />
        <h3 className="font-display text-lg font-extrabold text-white">Szept o 4:17</h3>
      </div>
      <p className="text-sm text-white/60 mb-4">Nie odtwarzasz piosenek — rozmawiasz z muzyką. Powiedz, co czujesz.</p>

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
          rows={2}
          placeholder={PLACEHOLDER[lang]}
          className="flex-1 resize-none rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#B026FF]/60"
        />
        <button onClick={listen} title="Mów"
          className={`grid h-11 w-11 flex-none place-items-center rounded-2xl border transition ${listening ? "border-rose-400 bg-rose-500/20 text-rose-200 animate-pulse" : "border-white/12 bg-white/5 text-white/70 hover:bg-white/10"}`}>
          {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button onClick={() => void submit()} disabled={busy || text.trim().length < 2}
          className="grid h-11 w-11 flex-none place-items-center rounded-2xl text-black transition hover:brightness-110 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#B026FF,#FF7A1A)" }} title="Znajdź utwór">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}

      {reply && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white">
            <span className="text-2xl">{reply.emoji}</span>
            {reply.mood && <span className="font-display font-bold">{reply.mood}</span>}
          </div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white/85 italic">„{reply.line}"</p>
          {reply.track ? (
            <div className="mt-3 flex items-center gap-3">
              {reply.track.cover_url
                ? <img src={reply.track.cover_url} alt="" className="h-11 w-11 rounded-lg object-cover" />
                : <div className="h-11 w-11 rounded-lg" style={{ background: "linear-gradient(135deg,#B026FF,#FF7A1A)" }} />}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">▶ {reply.track.title}</div>
                <div className="truncate text-xs text-white/50">{reply.track.artist}</div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-white/45">Nie znalazłem jeszcze utworu pod ten stan — dodajemy nowe każdego dnia.</p>
          )}
        </div>
      )}
    </div>
  );
}
