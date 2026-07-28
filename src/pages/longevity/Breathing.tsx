/**
 * Moduł ODDYCHANIE — ćwiczenia z animacją prowadzącą.
 *
 * Animacja chodzi na `requestAnimationFrame` i steruje wyłącznie transformem
 * okręgu (skala + opacity), więc utrzymuje 60 FPS także na słabszych
 * telefonach. Stan fazy wyliczamy z czasu, który upłynął, a nie z licznika
 * klatek — dzięki temu przejście w tło lub zgubiona klatka nie rozjeżdżają
 * rytmu ćwiczenia.
 *
 * Ukończona sesja trafia do dziennika (`breathworkMin`), więc od razu
 * wpływa na Epigenetic Score i na postęp misji.
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
  BREATHING_PROTOCOLS,
  cycleSeconds,
  getProtocol,
  phaseAt,
  playCue,
  scaleForPhase,
  startSoundscape,
  type BreathingProtocol,
  type SoundscapeHandle,
} from "@/lib/longevity";
import { cn } from "@/lib/utils";

const SESSION_LENGTHS = [2, 3, 5, 10, 15, 20];

const PHASE_COLOR = {
  inhale: "#2DD4BF",
  hold: "#E3C27E",
  exhale: "#7FE7DA",
  holdEmpty: "#8894A6",
} as const;

const Breathing = () => {
  const [params, setParams] = useSearchParams();
  const { updateRecord, today } = useLongevity();

  const requested = params.get("protokol");
  const [protocol, setProtocol] = useState<BreathingProtocol>(
    () => getProtocol(requested ?? "") ?? BREATHING_PROTOCOLS[0],
  );
  const [minutes, setMinutes] = useState(protocol.defaultMinutes);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  const startedAt = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const lastPhaseIndex = useRef<number>(-1);
  const soundRef = useRef<SoundscapeHandle | null>(null);

  const totalSeconds = minutes * 60;

  // Pętla animacji: jedno źródło prawdy — czas od startu.
  useEffect(() => {
    if (!running) return;

    const tick = (timestamp: number) => {
      if (startedAt.current === null) startedAt.current = timestamp;
      const seconds = (timestamp - startedAt.current) / 1000;

      if (seconds >= totalSeconds) {
        setElapsed(totalSeconds);
        setRunning(false);
        return;
      }

      setElapsed(seconds);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, totalSeconds]);

  const state = useMemo(() => phaseAt(protocol, elapsed), [protocol, elapsed]);
  const scale = scaleForPhase(state.phase.kind, state.phaseProgress);
  const remaining = Math.max(0, totalSeconds - elapsed);

  // Sygnał dźwiękowy na zmianie fazy — bez niego trzeba patrzeć na ekran.
  useEffect(() => {
    if (!running || !soundOn) return;
    if (state.phaseIndex === lastPhaseIndex.current) return;
    lastPhaseIndex.current = state.phaseIndex;
    playCue(state.phase.kind === "inhale" ? 528 : state.phase.kind === "exhale" ? 396 : 440, 160);
  }, [running, soundOn, state.phase.kind, state.phaseIndex]);

  const stopSound = useCallback(() => {
    soundRef.current?.stop(1);
    soundRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (protocol.requiresConsent && !consentGiven) return;
    setCompletedMessage(null);
    setElapsed(0);
    startedAt.current = null;
    lastPhaseIndex.current = -1;
    setRunning(true);
    if (soundOn && !soundRef.current) {
      soundRef.current = startSoundscape(protocol.id === "energizing" ? "forest" : "drone-warm", 0.35);
    }
  }, [consentGiven, protocol.id, protocol.requiresConsent, soundOn]);

  const stop = useCallback(() => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    startedAt.current = null;
    stopSound();
  }, [stopSound]);

  // Zapis ukończonej sesji do dziennika.
  useEffect(() => {
    if (running || elapsed < totalSeconds || totalSeconds === 0) return;
    stopSound();
    const current = today.lifestyle?.breathworkMin ?? 0;
    updateRecord({ lifestyle: { ...today.lifestyle, breathworkMin: current + minutes } });
    setCompletedMessage(`Zapisano ${minutes} min ćwiczenia oddechowego w dzienniku dnia.`);
    setElapsed(0);
    // `today` celowo poza zależnościami — interesuje nas moment ukończenia sesji,
    // a nie każda kolejna zmiana rekordu dnia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, elapsed, totalSeconds, minutes]);

  useEffect(() => () => stopSound(), [stopSound]);

  const selectProtocol = (next: BreathingProtocol) => {
    stop();
    setProtocol(next);
    setMinutes(next.defaultMinutes);
    setConsentGiven(false);
    setElapsed(0);
    setCompletedMessage(null);
    setParams({ protokol: next.id }, { replace: true });
  };

  const todayBreathwork = today.lifestyle?.breathworkMin ?? 0;

  return (
    <LongevityShell
      title="Oddychanie"
      subtitle="Najszybsza dźwignia regulacji układu nerwowego — działa w ciągu minut, nie tygodni."
      action={<Pill tone="teal">Dziś: {todayBreathwork} min</Pill>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          {/* ── Animacja ──────────────────────────────────────────────────── */}
          <GlassCard accent="teal" className="lg:col-span-3">
            <div className="relative flex min-h-[440px] flex-col items-center justify-center p-6">
              <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                {/* Poświata — skaluje się razem z okręgiem, z opóźnieniem. */}
                <div
                  className="absolute inset-0 rounded-full blur-3xl will-change-transform"
                  style={{
                    background: `radial-gradient(circle, ${PHASE_COLOR[state.phase.kind]}55 0%, transparent 70%)`,
                    transform: `scale(${scale * 1.1})`,
                    transition: "transform 120ms linear",
                  }}
                />

                {/* Pierścienie referencyjne */}
                <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
                <div className="absolute inset-[14%] rounded-full border border-white/[0.04]" />

                {/* Okrąg oddechu */}
                <div
                  className="absolute inset-[10%] rounded-full will-change-transform"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${PHASE_COLOR[state.phase.kind]}, ${PHASE_COLOR[state.phase.kind]}22)`,
                    transform: `scale(${scale})`,
                    transition: "transform 120ms linear, background 600ms ease",
                    boxShadow: `0 0 80px -20px ${PHASE_COLOR[state.phase.kind]}`,
                  }}
                />

                <div className="relative z-10 text-center">
                  <p className="font-display text-2xl font-semibold text-black/80 mix-blend-plus-lighter">
                    {running ? state.phase.cue : protocol.name}
                  </p>
                  {running && (
                    <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-longevity-ink">
                      {Math.ceil(state.phase.seconds * (1 - state.phaseProgress))}
                    </p>
                  )}
                  {!running && <p className="mt-1 text-sm text-longevity-ink/70">{protocol.subtitle}</p>}
                </div>
              </div>

              <div className="mt-8 w-full max-w-sm">
                <div className="mb-2 flex items-center justify-between text-xs text-longevity-muted">
                  <span>
                    {running ? `Cykl ${state.cycleIndex + 1}` : `${Math.round(cycleSeconds(protocol))} s na cykl`}
                  </span>
                  <span className="tabular-nums">
                    {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                    {String(Math.floor(remaining % 60)).padStart(2, "0")}
                  </span>
                </div>
                <ProgressBar value={totalSeconds === 0 ? 0 : elapsed / totalSeconds} tone="teal" />

                <div className="mt-5 flex items-center justify-center gap-3">
                  {!running ? (
                    <LongevityButton
                      variant="teal"
                      size="lg"
                      onClick={start}
                      disabled={protocol.requiresConsent && !consentGiven}
                    >
                      <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
                        play_arrow
                      </span>
                      Rozpocznij
                    </LongevityButton>
                  ) : (
                    <LongevityButton variant="ghost" size="lg" onClick={stop}>
                      <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
                        stop
                      </span>
                      Zakończ
                    </LongevityButton>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundOn;
                      setSoundOn(next);
                      if (!next) stopSound();
                      else if (running) soundRef.current = startSoundscape("drone-warm", 0.35);
                    }}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
                      soundOn
                        ? "border-longevity-teal/40 bg-longevity-teal/10 text-longevity-teal"
                        : "border-longevity-line bg-white/[0.04] text-longevity-muted",
                    )}
                    aria-label={soundOn ? "Wyłącz dźwięk" : "Włącz dźwięk"}
                  >
                    <span className="material-icons-outlined text-[18px] leading-none" aria-hidden>
                      {soundOn ? "volume_up" : "volume_off"}
                    </span>
                  </button>
                </div>

                {completedMessage && (
                  <p className="mt-4 text-center text-sm text-longevity-good">{completedMessage}</p>
                )}
              </div>
            </div>
          </GlassCard>

          {/* ── Ustawienia i opis ─────────────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-2">
            <GlassCard className="p-5">
              <SectionTitle eyebrow={protocol.subtitle} title={protocol.name} />
              <p className="mt-2 text-sm leading-relaxed text-longevity-muted">{protocol.description}</p>

              <div className="mt-4 rounded-xl border border-longevity-line bg-white/[0.02] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-longevity-teal">Efekt fizjologiczny</p>
                <p className="mt-1 text-sm leading-relaxed text-longevity-ink">{protocol.effect}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {protocol.bestFor.map((item) => (
                  <Pill key={item} tone="neutral">
                    {item}
                  </Pill>
                ))}
              </div>

              {protocol.cautions.length > 0 && (
                <div className="mt-4 rounded-xl border border-longevity-danger/25 bg-longevity-danger/[0.06] p-3.5">
                  <p className="text-[11px] uppercase tracking-wider text-longevity-danger">Ostrzeżenia</p>
                  <ul className="mt-1.5 space-y-1">
                    {protocol.cautions.map((caution) => (
                      <li key={caution} className="text-xs leading-relaxed text-longevity-ink/90">
                        • {caution}
                      </li>
                    ))}
                  </ul>

                  {protocol.requiresConsent && (
                    <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-longevity-ink">
                      <input
                        type="checkbox"
                        checked={consentGiven}
                        onChange={(e) => setConsentGiven(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-longevity-gold"
                      />
                      <span>
                        Przeczytałem ostrzeżenia, wykonuję ćwiczenie na siedząco lub leżąco i nie mam
                        wymienionych przeciwwskazań.
                      </span>
                    </label>
                  )}
                </div>
              )}

              <p className="mt-5 text-[11px] uppercase tracking-wider text-longevity-muted">Długość sesji</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SESSION_LENGTHS.map((length) => (
                  <button
                    key={length}
                    type="button"
                    onClick={() => {
                      stop();
                      setMinutes(length);
                      setElapsed(0);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      minutes === length
                        ? "border-longevity-teal/40 bg-longevity-teal/10 text-longevity-teal"
                        : "border-longevity-line bg-white/[0.03] text-longevity-muted hover:text-longevity-ink",
                    )}
                  >
                    {length} min
                  </button>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle eyebrow="Biblioteka" title="Protokoły" />
              <div className="mt-3 space-y-2">
                {BREATHING_PROTOCOLS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProtocol(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                      item.id === protocol.id
                        ? "border-longevity-teal/35 bg-longevity-teal/[0.07]"
                        : "border-longevity-line bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-longevity-ink">{item.name}</p>
                      <p className="truncate text-xs text-longevity-muted">
                        {item.subtitle} · {item.level}
                      </p>
                    </div>
                    {item.requiresConsent && (
                      <span className="material-icons-outlined text-[16px] leading-none text-longevity-warn" aria-hidden>
                        warning_amber
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        <Disclaimer text="Ćwiczenia oddechowe są techniką relaksacyjną, nie leczeniem. Przerwij ćwiczenie przy zawrotach głowy, mrowieniu utrzymującym się po sesji lub dyskomforcie w klatce piersiowej. Przy chorobach serca, padaczce, jaskrze, w ciąży oraz przy zaburzeniach lękowych z napadami paniki skonsultuj protokoły z lekarzem przed rozpoczęciem." />
      </div>
    </LongevityShell>
  );
};

export default Breathing;
