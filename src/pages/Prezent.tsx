// Strona prezentu muzycznego (/prezent/:id): zamknięta paczka → dotknięcie → okładka + piosenka.
// Lekka i samodzielna (bez głównego układu): jeden <audio>, start dopiero po dotknięciu (zasady autoodtwarzania).
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const TXT = {
  pl: { title: "Masz prezent 🎁", tap: "Dotknij, aby otworzyć", from: "Piosenka dla Ciebie", more: "Posłuchaj w GrouAI Stream", missing: "Ten prezent już nie istnieje", home: "Strona główna", pause: "Pauza", play: "Graj" },
  en: { title: "You've got a gift 🎁", tap: "Tap to open", from: "A song for you", more: "Listen on GrouAI Stream", missing: "This gift no longer exists", home: "Home", pause: "Pause", play: "Play" },
  nl: { title: "Je hebt een cadeau 🎁", tap: "Tik om te openen", from: "Een nummer voor jou", more: "Luister op GrouAI Stream", missing: "Dit cadeau bestaat niet meer", home: "Home", pause: "Pauze", play: "Afspelen" },
  ua: { title: "У тебе подарунок 🎁", tap: "Торкнись, щоб відкрити", from: "Пісня для тебе", more: "Слухати в GrouAI Stream", missing: "Цього подарунка вже немає", home: "Головна", pause: "Пауза", play: "Грати" },
} as const;

type GiftTrack = { id: string; title: string; artist: string; cover_url: string | null; audio_url: string | null };

export default function Prezent() {
  const { id } = useParams();
  const { language } = useLanguage();
  const t = TXT[(language as keyof typeof TXT)] ?? TXT.pl;
  const [track, setTrack] = useState<GiftTrack | null>(null);
  const [state, setState] = useState<"loading" | "closed" | "open" | "missing">("loading");
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    document.title = "🎁 GrouAI Stream";
    if (!id) { setState("missing"); return; }
    supabase.from("tracks").select("id, title, artist, cover_url, audio_url").eq("id", id).maybeSingle()
      .then(({ data }) => {
        if (!data) { setState("missing"); return; }
        setTrack(data as GiftTrack);
        setState("closed");
      }, () => setState("missing"));
  }, [id]);

  const open = () => {
    setState("open");
    const a = audio.current;
    if (a && track?.audio_url) a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  const toggle = () => {
    const a = audio.current; if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {}); else { a.pause(); setPlaying(false); }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#0b0712] px-4 py-10 text-white">
      <style>{`
        @keyframes gift-bob { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-10px) rotate(2deg) } }
        @keyframes gift-pop { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .gift-anim { animation: none !important } }
      `}</style>
      <div className="w-full max-w-sm text-center">
        {state === "loading" && <div className="mx-auto h-40 w-40 animate-pulse rounded-3xl bg-white/10" aria-busy="true" />}

        {state === "missing" && (
          <>
            <p className="text-lg font-semibold">{t.missing}</p>
            <Link to="/" className="mt-4 inline-block rounded-full bg-white px-6 py-3 font-semibold text-black">{t.home}</Link>
          </>
        )}

        {state === "closed" && (
          <>
            <h1 className="mb-6 text-3xl font-black [text-wrap:balance]">{t.title}</h1>
            <button type="button" onClick={open} aria-label={t.tap}
              className="gift-anim mx-auto grid h-48 w-48 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 to-pink-600 text-8xl shadow-2xl shadow-pink-600/30 focus:outline-none focus-visible:ring-4 focus-visible:ring-white"
              style={{ animation: "gift-bob 2.4s ease-in-out infinite" }}>
              🎁
            </button>
            <p className="mt-6 text-white/70">{t.tap}</p>
          </>
        )}

        {track && (
          <div className={state === "open" ? "gift-anim" : "hidden"} style={state === "open" ? { animation: "gift-pop .5s ease-out" } : undefined}>
            <p className="mb-3 text-sm uppercase tracking-widest text-orange-300">{t.from}</p>
            <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-white/10 shadow-2xl">
              {track.cover_url && <img src={track.cover_url} alt={track.title} className="h-full w-full object-cover" />}
              {track.audio_url && (
                <button type="button" onClick={toggle} aria-label={playing ? t.pause : t.play}
                  className="absolute bottom-3 right-3 grid h-16 w-16 place-items-center rounded-full bg-white text-2xl text-black shadow-lg">
                  {playing ? "❚❚" : "▶"}
                </button>
              )}
            </div>
            <h1 className="mt-5 text-2xl font-black [text-wrap:balance]">{track.title}</h1>
            <p className="text-white/70">{track.artist}</p>
            <Link to={`/?play=${encodeURIComponent(track.id)}`}
              className="mt-6 inline-block rounded-full bg-gradient-to-r from-orange-500 to-pink-600 px-6 py-3 font-semibold">
              {t.more}
            </Link>
            {track.audio_url && (
              <audio ref={audio} src={track.audio_url} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
