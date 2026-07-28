/**
 * Moduł MEDYTACJE — biblioteka sesji z odtwarzaczem.
 *
 * Sesja składa się ze scenariusza (kroki z instrukcjami) i tła dźwiękowego
 * generowanego lokalnie w Web Audio. Nie ma tu plików do pobrania ani pustych
 * kart „wkrótce” — każda pozycja działa od razu, także offline.
 *
 * Nagrania lektorskie i utwory z platformy Grouaistream dochodzą jako warstwa
 * premium (pole `grouaistreamTag`), nie zastępując tej podstawowej.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import {
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  ProgressBar,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  MEDITATION_SESSIONS,
  SESSION_CATEGORY_LABEL,
  SOUNDSCAPE_LABEL,
  getSession,
  recommendSessions,
  scriptSeconds,
  startSoundscape,
  type MeditationSession,
  type SessionCategory,
  type SoundscapeHandle,
} from "@/lib/longevity";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<SessionCategory, string> = {
  sleep: "bedtime",
  focus: "center_focus_strong",
  relax: "spa",
  anxiety: "healing",
  stress: "waves",
  music: "graphic_eq",
  nature: "forest",
};

const formatClock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const Meditations = () => {
  const [params, setParams] = useSearchParams();
  const { analysis, today, updateRecord } = useLongevity();

  const [category, setCategory] = useState<SessionCategory | "all">("all");
  const [active, setActive] = useState<MeditationSession | null>(() => getSession(params.get("sesja") ?? "") ?? null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const soundRef = useRef<SoundscapeHandle | null>(null);
  const timerRef = useRef<number | null>(null);

  const recommended = useMemo(
    () => recommendSessions(analysis.panel.nervousSystem.state, 3),
    [analysis.panel.nervousSystem.state],
  );

  const visible = useMemo(
    () => (category === "all" ? MEDITATION_SESSIONS : MEDITATION_SESSIONS.filter((s) => s.category === category)),
    [category],
  );

  const totalSeconds = active ? scriptSeconds(active) : 0;

  /** Krok scenariusza odpowiadający bieżącemu czasowi sesji. */
  const currentStep = useMemo(() => {
    if (!active) return null;
    let acc = 0;
    for (let i = 0; i < active.script.length; i += 1) {
      acc += active.script[i].seconds;
      if (elapsed < acc) return { step: active.script[i], index: i };
    }
    return { step: active.script[active.script.length - 1], index: active.script.length - 1 };
  }, [active, elapsed]);

  const stopAudio = useCallback(() => {
    soundRef.current?.stop(1.2);
    soundRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const logSession = useCallback(
    (minutes: number) => {
      if (minutes < 1) return;
      const current = today.lifestyle?.meditationMin ?? 0;
      updateRecord({ lifestyle: { ...today.lifestyle, meditationMin: current + Math.round(minutes) } });
      setSavedMessage(`Zapisano ${Math.round(minutes)} min medytacji w dzienniku dnia.`);
    },
    [today.lifestyle, updateRecord],
  );

  const play = useCallback(
    (session: MeditationSession) => {
      stopAudio();
      setActive(session);
      setElapsed(0);
      setPlaying(true);
      setSavedMessage(null);
      setParams({ sesja: session.id }, { replace: true });
      if (session.soundscape !== "silence") {
        soundRef.current = startSoundscape(session.soundscape, volume);
      }
      timerRef.current = window.setInterval(() => {
        setElapsed((current) => current + 1);
      }, 1000);
    },
    [setParams, stopAudio, volume],
  );

  const pause = useCallback(() => {
    setPlaying(false);
    stopAudio();
  }, [stopAudio]);

  const finish = useCallback(() => {
    if (active) logSession(elapsed / 60);
    setPlaying(false);
    stopAudio();
    setElapsed(0);
  }, [active, elapsed, logSession, stopAudio]);

  // Automatyczne zakończenie po przejściu całego scenariusza.
  useEffect(() => {
    if (!playing || !active || totalSeconds === 0) return;
    if (elapsed >= totalSeconds) {
      logSession(totalSeconds / 60);
      setPlaying(false);
      stopAudio();
      setElapsed(0);
    }
  }, [active, elapsed, logSession, playing, stopAudio, totalSeconds]);

  useEffect(() => {
    soundRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const todayMinutes = today.lifestyle?.meditationMin ?? 0;

  return (
    <LongevityShell
      title="Medytacje i dźwięk"
      subtitle="Sesje prowadzone, muzyka i dźwięki natury generowane na urządzeniu — działają offline."
      action={<Pill tone="gold">Dziś: {todayMinutes} min</Pill>}
    >
      <div className="space-y-6">
        {/* ── Odtwarzacz ────────────────────────────────────────────────────── */}
        {active && (
          <GlassCard accent="teal" className="overflow-hidden">
            <div className="relative p-6">
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(ellipse at 20% 0%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(227,194,126,0.14), transparent 55%)",
                }}
              />

              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="relative flex h-40 w-40 shrink-0 items-center justify-center self-center lg:self-auto">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full bg-longevity-teal/20 blur-2xl",
                      playing && "animate-glow-pulse",
                    )}
                  />
                  <div className="absolute inset-3 rounded-full border border-white/10" />
                  <span className="material-icons-outlined relative text-4xl text-longevity-teal" aria-hidden>
                    {CATEGORY_ICON[active.category]}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="teal">{SESSION_CATEGORY_LABEL[active.category]}</Pill>
                    <Pill tone="neutral">{SOUNDSCAPE_LABEL[active.soundscape]}</Pill>
                    {active.premium && <Pill tone="gold">Premium</Pill>}
                  </div>

                  <h2 className="mt-2 font-display text-2xl font-semibold text-longevity-ink">{active.title}</h2>
                  <p className="mt-1 text-sm text-longevity-muted">{active.purpose}</p>

                  <div className="mt-5 min-h-[52px] rounded-xl border border-longevity-line bg-black/25 p-3.5">
                    <p className="text-[11px] uppercase tracking-wider text-longevity-teal">
                      {playing ? `Krok ${(currentStep?.index ?? 0) + 1} z ${active.script.length}` : "Scenariusz"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-longevity-ink">
                      {currentStep?.step.text ?? active.script[0].text}
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs tabular-nums text-longevity-muted">
                      <span>{formatClock(elapsed)}</span>
                      <span>{formatClock(totalSeconds)}</span>
                    </div>
                    <ProgressBar value={totalSeconds === 0 ? 0 : elapsed / totalSeconds} tone="teal" />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {playing ? (
                      <LongevityButton variant="ghost" onClick={pause}>
                        <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
                          pause
                        </span>
                        Pauza
                      </LongevityButton>
                    ) : (
                      <LongevityButton variant="teal" onClick={() => play(active)}>
                        <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
                          play_arrow
                        </span>
                        {elapsed > 0 ? "Od nowa" : "Odtwórz"}
                      </LongevityButton>
                    )}

                    <LongevityButton variant="ghost" onClick={finish} disabled={elapsed < 30}>
                      Zakończ i zapisz
                    </LongevityButton>

                    <div className="flex min-w-[160px] flex-1 items-center gap-2">
                      <span className="material-icons-outlined text-[16px] leading-none text-longevity-muted" aria-hidden>
                        volume_down
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(volume * 100)}
                        onChange={(e) => setVolume(Number(e.target.value) / 100)}
                        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-longevity-teal"
                        aria-label="Głośność"
                      />
                    </div>
                  </div>

                  {savedMessage && <p className="mt-3 text-sm text-longevity-good">{savedMessage}</p>}
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* ── Rekomendacje ──────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Dobrane do dzisiejszego stanu"
            title="Zacznij od tego"
            description="Wybór zależy od stanu układu nerwowego, nie od popularności sesji."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {recommended.map((session) => (
              <GlassCard key={session.id} interactive onClick={() => play(session)} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="material-icons-outlined text-[20px] leading-none text-longevity-teal" aria-hidden>
                    {CATEGORY_ICON[session.category]}
                  </span>
                  <Pill tone="neutral">{session.minutes} min</Pill>
                </div>
                <p className="mt-2.5 text-sm font-medium text-longevity-ink">{session.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-longevity-muted">{session.summary}</p>
              </GlassCard>
            ))}
          </div>
        </GlassCard>

        {/* ── Biblioteka ────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                category === "all"
                  ? "border-longevity-gold/40 bg-longevity-gold/10 text-longevity-gold-soft"
                  : "border-longevity-line bg-white/[0.03] text-longevity-muted hover:text-longevity-ink",
              )}
            >
              Wszystkie
            </button>
            {(Object.keys(SESSION_CATEGORY_LABEL) as SessionCategory[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                  category === key
                    ? "border-longevity-gold/40 bg-longevity-gold/10 text-longevity-gold-soft"
                    : "border-longevity-line bg-white/[0.03] text-longevity-muted hover:text-longevity-ink",
                )}
              >
                <span className="material-icons-outlined text-[14px] leading-none" aria-hidden>
                  {CATEGORY_ICON[key]}
                </span>
                {SESSION_CATEGORY_LABEL[key]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((session) => (
              <GlassCard
                key={session.id}
                interactive
                onClick={() => play(session)}
                className={cn("p-4", active?.id === session.id && "border-longevity-teal/40")}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05]">
                    <span className="material-icons-outlined text-[18px] leading-none text-longevity-teal" aria-hidden>
                      {CATEGORY_ICON[session.category]}
                    </span>
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone="neutral">{session.minutes} min</Pill>
                    {session.premium && <Pill tone="gold">Premium</Pill>}
                  </div>
                </div>

                <p className="mt-3 text-sm font-medium text-longevity-ink">{session.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-longevity-muted">{session.summary}</p>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-longevity-muted/70">
                  <span className="material-icons-outlined text-[13px] leading-none" aria-hidden>
                    graphic_eq
                  </span>
                  {SOUNDSCAPE_LABEL[session.soundscape]}
                  {session.grouaistreamTag && (
                    <>
                      <span>·</span>
                      <span>Grouaistream</span>
                    </>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Jak to działa"
            title="Dźwięk generowany, nie odtwarzany z pliku"
            description="Tła są syntezowane w przeglądarce: szum różowy filtrowany do deszczu, lasu i oceanu, drony harmoniczne oraz dudnienia binauralne. Dzięki temu sesja startuje natychmiast, nie zużywa transferu i nigdy nie słychać zapętlenia. Fale binauralne wymagają słuchawek — różnica częstotliwości powstaje między kanałami."
          />
        </GlassCard>

        <Disclaimer text="Medytacja i praca z dźwiękiem to techniki relaksacyjne wspierające samopoczucie. Nie są terapią ani leczeniem zaburzeń lękowych, depresji czy bezsenności. Jeśli objawy się utrzymują, skontaktuj się ze specjalistą." />
      </div>
    </LongevityShell>
  );
};

export default Meditations;
