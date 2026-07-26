import { useEffect, useRef, useState } from "react";
import { usePlayer, type Track } from "@/contexts/PlayerContext";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, X, Sparkles, ShieldCheck } from "lucide-react";

/**
 * DJ NASTROJU — kamera czyta TYLKO emocję (nie tożsamość) w Twojej przeglądarce
 * i od razu układa oraz gra playlistę pod ten nastrój. Twarzy nie zapisujemy,
 * kamerę wyłączamy zaraz po odczycie. Zgodne z wyborem „bez tożsamości".
 */
const TRACK_SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

const EMOTION_MAP: Record<string, { label: string; emoji: string; genres: string[]; moods: string[] }> = {
  happy:     { label: "Radosny",      emoji: "😊", genres: ["Pop", "Dance", "Disco", "EDM"],       moods: ["happy", "energetic", "uplifting"] },
  sad:       { label: "Melancholijny", emoji: "😢", genres: ["Rock", "Folk", "R&B"],               moods: ["sad", "melancholic", "calm"] },
  angry:     { label: "Mocny",        emoji: "🔥", genres: ["Rock", "Hip-Hop", "EDM"],             moods: ["energetic", "intense", "dark"] },
  fearful:   { label: "Niespokojny",  emoji: "🌫️", genres: ["Electronic", "Ambient"],             moods: ["calm", "dreamy"] },
  disgusted: { label: "Buntowniczy",  emoji: "😤", genres: ["Rock", "Hip-Hop", "Punk"],           moods: ["intense", "dark"] },
  surprised: { label: "Pobudzony",    emoji: "✨", genres: ["Pop", "EDM", "Dance"],               moods: ["energetic", "happy"] },
  neutral:   { label: "Wyluzowany",   emoji: "😌", genres: ["Pop", "Chill", "Lo-Fi", "R&B"],       moods: ["chill", "calm", "relaxed"] },
};

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export function MoodDJ({ onClose }: { onClose?: () => void }) {
  const { playPlaylist } = usePlayer();
  const { loadModels, detectWithSampling } = useFaceDetection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<"idle" | "working" | "done" | "error">("idle");
  const [mood, setMood] = useState<{ label: string; emoji: string; confidence: number } | null>(null);
  const [msg, setMsg] = useState("");

  const stopCam = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => () => stopCam(), []);

  const run = async () => {
    setPhase("working"); setMood(null); setMsg("Włączam kamerę…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setMsg("Ładuję model nastroju…");
      const ok = await loadModels();
      if (!ok) throw new Error("Nie udało się załadować modelu nastroju");
      setMsg("Czytam nastrój — patrz w kamerę 🙂");
      const res = await detectWithSampling(videoRef.current!, 5, 700);
      stopCam(); // PRYWATNOŚĆ: kamera off zaraz po odczycie; twarzy nie zapisujemy.
      const map = EMOTION_MAP[res?.dominantEmotion || "neutral"] || EMOTION_MAP.neutral;
      setMood({ label: map.label, emoji: map.emoji, confidence: res?.confidence || 0 });
      setPhase("done"); setMsg(`Nastrój: ${map.label} — układam playlistę…`);
      await buildAndPlay(map);
    } catch (e: any) {
      stopCam(); setPhase("error");
      setMsg(e?.name === "NotAllowedError" ? "Brak zgody na kamerę — włącz dostęp w przeglądarce." : (e?.message || "Coś poszło nie tak"));
    }
  };

  const buildAndPlay = async (map: { label: string; genres: string[]; moods: string[] }) => {
    let rows: Track[] = [];
    const byGenre = await supabase.from("tracks").select(TRACK_SELECT)
      .or("audio_url.not.is.null,video_url.not.is.null")
      .in("genre", map.genres).limit(60);
    rows = (byGenre.data as Track[]) || [];
    if (rows.length < 8) {
      const orMood = map.moods.map((m) => `mood.ilike.%${m}%`).join(",");
      const byMood = await supabase.from("tracks").select(TRACK_SELECT)
        .or("audio_url.not.is.null,video_url.not.is.null").or(orMood).limit(60);
      const seen = new Set(rows.map((r) => r.id));
      rows = [...rows, ...(((byMood.data as Track[]) || []).filter((r) => !seen.has(r.id)))];
    }
    rows = rows.filter((r) => r.audio_url || r.video_url);
    if (rows.length === 0) { setMsg("Brak utworów pod ten nastrój — spróbuj później."); toast.error("Brak utworów pod ten nastrój"); return; }
    const list = shuffle(rows).slice(0, 40);
    playPlaylist(list, 0, "mood-dj");
    toast.success(`🎧 ${list.length} utworów pod nastrój: ${map.label}`);
    setMsg(`Gramy ${list.length} utworów pod nastrój: ${map.label}. Miłego słuchania!`);
  };

  const busy = phase === "working";

  return (
    <div className="relative rounded-3xl border border-[#FF7A1A]/40 p-5 sm:p-6 overflow-hidden"
      style={{ background: "linear-gradient(150deg,#1a0f27,#160d20)" }}>
      {onClose && (
        <button onClick={() => { stopCam(); onClose(); }} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/60 hover:text-white" aria-label="Zamknij">
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-[#FFB020]" />
        <h3 className="font-display text-lg font-extrabold text-white">DJ nastroju</h3>
      </div>
      <p className="text-sm text-white/60 mb-4">Kamera odczyta Twój nastrój i od razu ułoży playlistę.</p>

      <div className="grid sm:grid-cols-[180px_1fr] gap-4 items-center">
        {/* podgląd kamery (lustrzany), tylko podczas pracy */}
        <div className="relative aspect-square w-full max-w-[180px] mx-auto rounded-2xl overflow-hidden bg-black/50 border border-white/10 grid place-items-center">
          <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)", opacity: busy ? 1 : 0 }} />
          {!busy && (
            mood ? <div className="text-6xl">{mood.emoji}</div> : <Camera className="h-10 w-10 text-white/30" />
          )}
          {busy && <div className="absolute inset-0 grid place-items-center bg-black/30"><Loader2 className="h-7 w-7 animate-spin text-white" /></div>}
        </div>

        <div className="min-w-0">
          {mood && phase === "done" && (
            <div className="mb-2">
              <div className="text-2xl font-display font-extrabold text-white">{mood.emoji} {mood.label}</div>
              {mood.confidence > 0 && <div className="text-xs text-white/50">pewność {mood.confidence}%</div>}
            </div>
          )}
          {msg && <p className={`text-sm mb-3 ${phase === "error" ? "text-rose-300" : "text-white/70"}`}>{msg}</p>}

          <button onClick={run} disabled={busy}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-black transition hover:brightness-110 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#FF7A1A,#FFB020)" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {phase === "done" ? "Wykryj ponownie" : "Włącz kamerę i graj pod nastrój"}
          </button>

          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-white/45">
            <ShieldCheck className="h-3.5 w-3.5 flex-none mt-0.5 text-emerald-400/80" />
            <span>Analiza dzieje się w Twojej przeglądarce. Rozpoznajemy tylko <b>nastrój</b> — nie tożsamość. Twarzy nie zapisujemy, kamerę wyłączamy zaraz po odczycie.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
