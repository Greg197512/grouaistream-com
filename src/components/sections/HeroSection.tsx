import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Radio, Sparkles, Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { INTRO_AUDIO_URL } from "@/lib/introAudio";
import { weeklyArtwork } from "@/lib/weeklyArtwork";
import { HomeMusicVisualizer } from "@/components/effects/HomeMusicVisualizer";

const COPY: Record<string, { eyebrow: string; title: string; text: string; studio: string; radio: string; intro: string; stop: string; footer: string }> = {
  pl: { eyebrow: "Radio na żywo. Muzyka, która słucha.", title: "Twój dźwiękowy dom.", text: "Oryginalne utwory niezależnych artystów. Muzyka dobrana do Twojego nastroju przez AI. Radio na żywo gra teraz — dołącz, zanim skończy się ten utwór.", studio: "GrouAI Studio", radio: "Radio na żywo", intro: "Posłuchaj intro", stop: "Zatrzymaj intro", footer: "Muzyka · Technologia · Niezależność" },
  en: { eyebrow: "Live radio. Music that listens.", title: "Your sound home.", text: "Original tracks from independent artists. Music chosen for your mood by AI. Live radio is on now — join before this song ends.", studio: "GrouAI Studio", radio: "Live radio", intro: "Listen to intro", stop: "Stop intro", footer: "Music · Technology · Independence" },
  nl: { eyebrow: "Live radio. Muziek die luistert.", title: "Jouw muzikale thuis.", text: "Originele muziek van onafhankelijke artiesten. Muziek die AI afstemt op jouw stemming. Live radio staat nu aan — schuif aan voordat dit nummer eindigt.", studio: "GrouAI Studio", radio: "Live radio", intro: "Luister naar intro", stop: "Stop intro", footer: "Muziek · Technologie · Onafhankelijkheid" },
  ua: { eyebrow: "Радіо наживо. Музика, що слухає.", title: "Твій музичний дім.", text: "Оригінальні треки незалежних артистів. Музика, підібрана ШІ під твій настрій. Радіо наживо вже грає — приєднуйся, поки ця пісня не закінчилась.", studio: "GrouAI Studio", radio: "Радіо наживо", intro: "Послухати інтро", stop: "Зупинити інтро", footer: "Музика · Технології · Незалежність" },
};

export const HeroSection = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const copy = COPY[String(language).slice(0, 2)] || COPY.pl;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [heroBg, setHeroBg] = useState(() => weeklyArtwork());
  useEffect(() => {
    const timer = window.setInterval(() => setHeroBg(weeklyArtwork()), 3600000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  const toggleIntro = () => {
    if (speaking) { audioRef.current?.pause(); setSpeaking(false); return; }
    const audio = audioRef.current || new Audio(INTRO_AUDIO_URL);
    audioRef.current = audio;
    audio.currentTime = 0;
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => { setSpeaking(false); setFailed(true); };
    setFailed(false);
    setSpeaking(true);
    audio.play().catch(() => { setSpeaking(false); setFailed(true); });
  };
  return (
    <section className="premium-home relative isolate overflow-hidden border-b border-border">
      <img src={heroBg} alt="" width={1920} height={1024} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-right" />
      <div className="premium-home-shade absolute inset-0" />
      <div className="relative px-6 py-12 md:px-10 md:py-16">
        <p className="premium-eyebrow mb-7 text-xs font-medium">{copy.eyebrow}</p>
        <div className="relative mb-5 h-20 max-w-md overflow-hidden" data-testid="home-equalizer"><HomeMusicVisualizer /></div>
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">GrouAI Stream<span className="premium-heading-accent mt-2 block text-3xl sm:text-4xl lg:text-5xl">{copy.title}</span></h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">{copy.text}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" className="premium-primary" onClick={() => navigate("/radio-live")}><Radio />{copy.radio}<ArrowUpRight /></Button>
          <Button size="lg" variant="outline" className="border-foreground/20 bg-background/60 hover:bg-secondary" onClick={() => navigate("/studio")}><Sparkles />{copy.studio}</Button>
        </div>
        <Button variant="ghost" onClick={toggleIntro} aria-pressed={speaking} className="mt-4 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground">{speaking ? <Square /> : <Volume2 />}{speaking ? copy.stop : copy.intro}<span className="text-xs opacity-60">PL</span></Button>
        {failed && <p role="status" className="text-sm text-muted-foreground">{String(language).startsWith("pl") ? "Nagranie jest chwilowo niedostępne." : "The recording is temporarily unavailable."}</p>}
        <div className="mt-8 flex items-center gap-3 border-t border-foreground/10 pt-5 text-xs text-muted-foreground"><span className="premium-status h-1.5 w-1.5 rounded-full" />{copy.footer}</div>
      </div>
    </section>
  );
};
