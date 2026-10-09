import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INTRO_AUDIO_URL } from "@/lib/introAudio";
import heroBg from "@/assets/hero-premium-audio.jpg";

const SESSION_KEY = "grouai-intro-premium-v1";
export const IntroSplash = () => {
  const [show, setShow] = useState(() => { try { return sessionStorage.getItem(SESSION_KEY) !== "1"; } catch { return true; } });
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const close = useCallback(() => {
    audioRef.current?.pause();
    setShow(false);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private browsing */ }
  }, []);
  useEffect(() => {
    if (!show) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(close, speaking ? 18000 : reduced ? 2000 : 5000);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", escape); };
  }, [show, speaking, close]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  const playIntro = () => {
    if (speaking) return;
    const audio = new Audio(INTRO_AUDIO_URL);
    audioRef.current = audio;
    audio.onended = close;
    audio.onerror = () => { setSpeaking(false); setFailed(true); };
    setSpeaking(true);
    audio.play().catch(() => { setSpeaking(false); setFailed(true); });
  };
  if (!show) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Witaj w GrouAI Stream" className="premium-intro fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-background text-foreground">
      <img src={heroBg} alt="" width={1920} height={1024} className="absolute inset-0 h-full w-full object-cover object-right opacity-50" />
      <div className="premium-intro-shade absolute inset-0" />
      <div className="relative flex items-center justify-between gap-4 px-6 py-6 sm:px-10">
        <span className="font-display text-sm font-semibold">GrouAI Stream</span>
        <Button autoFocus variant="ghost" onClick={close} className="hover:bg-foreground/10">Przejdź do strony<ArrowRight /></Button>
      </div>
      <div className="premium-intro-lockup relative m-auto w-full max-w-3xl px-6 text-center">
        <img src="/logo-grouaistream.svg" alt="" className="mx-auto mb-6 h-20 w-20 sm:h-24 sm:w-24" />
        <p className="premium-eyebrow mb-4 text-xs">Niezależni twórcy. Inteligentne radio.</p>
        <h2 className="font-display text-4xl font-bold leading-tight sm:text-6xl">GrouAI Stream</h2>
        <p className="mt-5 text-lg text-muted-foreground sm:text-xl">Muzyka, która zaczyna słuchać Ciebie.</p>
        <Button variant="outline" onClick={playIntro} disabled={speaking} className="mt-8 border-foreground/20 bg-background/60 hover:bg-secondary"><Volume2 />{speaking ? "Intro trwa…" : "Posłuchaj powitania"}</Button>
        {failed && <p role="status" className="mt-3 text-sm text-muted-foreground">Nagranie jest chwilowo niedostępne.</p>}
      </div>
      <div className="relative mx-6 mb-8 flex items-center justify-between gap-4 border-t border-foreground/15 pt-5 text-xs text-muted-foreground sm:mx-10"><span>Muzyka. Technologia. Niezależność.</span><span className="premium-heading-accent">GrouaRock ®</span></div>
    </div>
  );
};
