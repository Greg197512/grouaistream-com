/**
 * Pulpit — jedyny ekran, który użytkownik musi otworzyć rano.
 *
 * Hierarchia informacji jest celowa: najpierw jedna liczba nadrzędna
 * (wiek biologiczny), potem stan „tu i teraz” (regeneracja, stres, sen,
 * energia), potem decyzja na dziś (misje i porada), a dopiero na końcu
 * szczegóły i prognozy.
 */

import { Link } from "react-router-dom";
import { LongevityShell, LONGEVITY_BASE } from "@/components/longevity/LongevityShell";
import { DriverBars, MetricTile, ScoreRing } from "@/components/longevity/ScoreRing";
import {
  ConfidenceBadge,
  Disclaimer,
  GlassCard,
  LongevityButton,
  Pill,
  ProgressBar,
  SectionTitle,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  NERVOUS_STATE_DESCRIPTION,
  NERVOUS_STATE_LABEL,
  STRESS_LEVEL_LABEL,
  TRAINING_LABEL,
  formatDuration,
  formatMinuteOfDay,
  scoreBand,
} from "@/lib/longevity";

const STRESS_TONE = {
  low: "good",
  moderate: "warn",
  high: "warn",
  critical: "danger",
} as const;

const NERVOUS_TONE = {
  recovery: "good",
  fight: "warn",
  overload: "danger",
  freeze: "warn",
} as const;

const Dashboard = () => {
  const { analysis, profile, today, demoMode, setDemoMode, hasRealData } = useLongevity();
  const { panel, twin, missionProgress, report, garmin, gamification } = analysis;

  const bioDelta = panel.biologicalAge.deltaYears;
  const completedMissions = missionProgress.filter((m) => m.complete).length;
  const topInsight = report.insights[0];

  return (
    <LongevityShell
      title={report.headline}
      subtitle={new Date().toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
      action={
        !hasRealData && !demoMode ? (
          <LongevityButton onClick={() => setDemoMode(true)} variant="ghost" size="sm">
            <span className="material-icons-outlined text-[16px] leading-none" aria-hidden>
              play_circle
            </span>
            Zobacz demo
          </LongevityButton>
        ) : demoMode ? (
          <LongevityButton onClick={() => setDemoMode(false)} variant="ghost" size="sm">
            Wyjdź z demo
          </LongevityButton>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* ── Wiek biologiczny ─────────────────────────────────────────────── */}
        <GlassCard accent="gold" className="p-5 sm:p-7">
          <div className="flex flex-col items-center gap-7 lg:flex-row lg:items-center lg:gap-10">
            <div className="relative shrink-0">
              <ScoreRing
                value={Math.max(0, 100 - Math.abs(bioDelta) * 6)}
                tone={bioDelta <= 0 ? "teal" : "gold"}
                size={208}
                thickness={11}
              >
                <span className="text-[11px] uppercase tracking-[0.2em] text-longevity-muted">Szacowany wiek</span>
                <span className="font-display text-5xl font-semibold tabular-nums leading-none text-longevity-ink">
                  {panel.biologicalAge.estimatedAge}
                </span>
                <span className="mt-1.5 text-xs text-longevity-muted">
                  metrykalnie {panel.biologicalAge.chronologicalAge}
                </span>
              </ScoreRing>
            </div>

            <div className="min-w-0 flex-1 text-center lg:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <Pill tone={bioDelta <= 0 ? "teal" : "warn"}>
                  {bioDelta <= 0
                    ? `${Math.abs(bioDelta).toFixed(1)} roku poniżej wieku metrykalnego`
                    : `${bioDelta.toFixed(1)} roku powyżej wieku metrykalnego`}
                </Pill>
                <ConfidenceBadge confidence={panel.biologicalAge.confidence} />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-longevity-muted">
                Szacunek stylu życia z ostatnich 90 dni. Wiek regeneracyjny — wskaźnik reagujący
                z dnia na dzień — wynosi dziś <strong className="text-longevity-ink">{panel.recoveryAge}</strong> lat.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-longevity-muted">
                    Co najbardziej wpływa na wynik
                  </p>
                  <DriverBars drivers={panel.biologicalAge.drivers} limit={4} />
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-longevity-muted">Longevity Index</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-semibold tabular-nums text-longevity-ink">
                      {panel.longevityIndex.value}
                    </span>
                    <span className="text-sm text-longevity-muted">/ 100 · {scoreBand(panel.longevityIndex.value).label}</span>
                  </div>
                  <ProgressBar value={panel.longevityIndex.value / 100} tone="gold" className="mt-2" />

                  {panel.biologicalAge.missingInputs.length > 0 && (
                    <p className="mt-4 text-xs leading-relaxed text-longevity-muted/80">
                      Precyzję podniosą: {panel.biologicalAge.missingInputs.slice(0, 3).join(", ").toLowerCase()}.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`${LONGEVITY_BASE}/wiek`}>
                      <LongevityButton size="sm" variant="ghost">
                        Rozbicie wyniku
                      </LongevityButton>
                    </Link>
                    <Link to={`${LONGEVITY_BASE}/trendy`}>
                      <LongevityButton size="sm" variant="ghost">
                        Trendy
                      </LongevityButton>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ── Kafelki stanu ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricTile
            label="Regeneracja"
            value={panel.recoveryScore.value}
            ratio={panel.recoveryScore.value / 100}
            tone="teal"
            icon="battery_charging_full"
            hint={scoreBand(panel.recoveryScore.value).label}
            onClick={undefined}
          />
          <MetricTile
            label="Stres"
            value={panel.stressIndex.value}
            ratio={panel.stressIndex.value / 100}
            tone={STRESS_TONE[panel.stressLevel]}
            icon="monitor_heart"
            hint={STRESS_LEVEL_LABEL[panel.stressLevel]}
          />
          <MetricTile
            label="Sen"
            value={panel.sleepScore.value}
            ratio={panel.sleepScore.value / 100}
            tone="teal"
            icon="bedtime"
            hint={today.sleep?.durationMin ? formatDuration(today.sleep.durationMin) : "Brak danych z nocy"}
          />
          <MetricTile
            label="Energia"
            value={panel.energyScore.value}
            ratio={panel.energyScore.value / 100}
            tone="gold"
            icon="bolt"
            hint={scoreBand(panel.energyScore.value).label}
          />
          <MetricTile
            label="Epigenetyka"
            value={panel.epigeneticScore.value}
            unit="/100"
            ratio={panel.epigeneticScore.value / 100}
            tone="gold"
            icon="eco"
            hint={`${panel.epigeneticScore.awards.filter((a) => a.complete).length} z ${panel.epigeneticScore.awards.length} nawyków`}
          />
          <MetricTile
            label="Układ nerwowy"
            value={panel.nervousSystem.balanceScore}
            ratio={panel.nervousSystem.balanceScore / 100}
            tone={NERVOUS_TONE[panel.nervousSystem.state]}
            icon="psychology"
            hint={NERVOUS_STATE_LABEL[panel.nervousSystem.state]}
          />
        </div>

        {/* ── Misja dnia + porada ──────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard className="p-5 lg:col-span-3">
            <SectionTitle
              eyebrow="Misja na dziś"
              title={`${completedMissions} z ${missionProgress.length} ukończonych`}
              action={
                <Link to={`${LONGEVITY_BASE}/misje`}>
                  <LongevityButton size="sm" variant="ghost">
                    Wszystkie
                  </LongevityButton>
                </Link>
              }
            />

            <div className="mt-4 space-y-3">
              {missionProgress.map(({ mission, current, progress, complete }) => (
                <div
                  key={mission.id}
                  className="rounded-xl border border-longevity-line bg-white/[0.02] p-3.5 transition-colors hover:border-white/12"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-longevity-ink">
                        {complete && (
                          <span className="material-icons-outlined text-[16px] leading-none text-longevity-good" aria-hidden>
                            check_circle
                          </span>
                        )}
                        {mission.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-longevity-muted">{mission.reason}</p>
                    </div>
                    <Pill tone={complete ? "good" : "gold"}>+{mission.xp} XP</Pill>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <ProgressBar value={progress} tone={complete ? "good" : "teal"} className="flex-1" />
                    <span className="shrink-0 text-[11px] tabular-nums text-longevity-muted">
                      {mission.metric === "sleepMin"
                        ? `${formatDuration(current)} / ${formatDuration(mission.target)}`
                        : `${current.toLocaleString("pl-PL")} / ${mission.target.toLocaleString("pl-PL")} ${mission.unit}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="space-y-4 lg:col-span-2">
            <GlassCard accent="teal" className="p-5">
              <SectionTitle eyebrow="Rada na dziś" title={topInsight?.title ?? "Utrzymaj rytm"} />
              <p className="mt-3 text-sm leading-relaxed text-longevity-muted">
                {topInsight?.body ?? "Dane z dziś nie wskazują na nic, co wymagałoby korekty. Trzymaj obecne nawyki."}
              </p>
              {topInsight && (
                <ul className="mt-4 space-y-2">
                  {topInsight.actions.map((action) => (
                    <li key={action} className="flex items-start gap-2 text-sm text-longevity-ink">
                      <span className="material-icons-outlined mt-px text-[15px] leading-none text-longevity-teal" aria-hidden>
                        check
                      </span>
                      <span className="leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ul>
              )}
              {topInsight && topInsight.basedOn.length > 0 && (
                <p className="mt-4 text-[11px] text-longevity-muted/70">
                  Na podstawie: {topInsight.basedOn.join(", ").toLowerCase()}
                </p>
              )}
              <Link to={`${LONGEVITY_BASE}/coach`} className="mt-4 block">
                <LongevityButton variant="teal" size="sm" className="w-full">
                  <span className="material-icons-outlined text-[16px] leading-none" aria-hidden>
                    forum
                  </span>
                  Porozmawiaj z AI Coachem
                </LongevityButton>
              </Link>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionTitle eyebrow="Układ nerwowy" title={NERVOUS_STATE_LABEL[panel.nervousSystem.state]} />
              <p className="mt-2 text-sm leading-relaxed text-longevity-muted">
                {NERVOUS_STATE_DESCRIPTION[panel.nervousSystem.state]}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {panel.nervousSystem.suggestedProtocols.map((id) => (
                  <Link key={id} to={`${LONGEVITY_BASE}/oddech?protokol=${id}`}>
                    <Pill tone="teal">Ćwiczenie: {id}</Pill>
                  </Link>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ── Garmin ───────────────────────────────────────────────────────── */}
        {garmin.available && (
          <GlassCard accent="gold" className="p-5">
            <SectionTitle
              eyebrow="Garmin AI · raport poranny"
              title={TRAINING_LABEL[garmin.recommendation]}
              description="Analiza metryk, których nie da się odtworzyć z samego tętna."
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                {garmin.bodyBattery !== undefined && (
                  <MetricTile
                    label="Body Battery"
                    value={garmin.bodyBattery}
                    ratio={garmin.bodyBattery / 100}
                    tone={garmin.bodyBattery >= 50 ? "teal" : "warn"}
                    icon="battery_5_bar"
                  />
                )}
                {garmin.trainingReadiness !== undefined && (
                  <MetricTile
                    label="Training Readiness"
                    value={garmin.trainingReadiness}
                    ratio={garmin.trainingReadiness / 100}
                    tone={garmin.trainingReadiness >= 60 ? "teal" : "warn"}
                    icon="fitness_center"
                  />
                )}
                {garmin.stressScore !== undefined && (
                  <MetricTile
                    label="Stress Score"
                    value={garmin.stressScore}
                    ratio={garmin.stressScore / 100}
                    tone={garmin.stressScore <= 50 ? "good" : "danger"}
                    icon="graphic_eq"
                  />
                )}
                {garmin.hrvDeltaPct !== undefined && (
                  <MetricTile
                    label="HRV vs baza"
                    value={`${garmin.hrvDeltaPct > 0 ? "+" : ""}${garmin.hrvDeltaPct}`}
                    unit="%"
                    ratio={Math.min(1, Math.abs(garmin.hrvDeltaPct) / 30)}
                    tone={garmin.hrvDeltaPct >= 0 ? "good" : "danger"}
                    icon="favorite"
                  />
                )}
              </div>

              <div className="rounded-xl border border-longevity-line bg-white/[0.02] p-4">
                <p className="text-[11px] uppercase tracking-wider text-longevity-gold/80">Priorytet na dziś</p>
                <ul className="mt-2 space-y-1.5">
                  {garmin.priorities.map((priority) => (
                    <li key={priority} className="flex items-start gap-2 text-sm text-longevity-ink">
                      <span className="material-icons-outlined mt-px text-[15px] leading-none text-longevity-gold" aria-hidden>
                        check
                      </span>
                      <span className="leading-relaxed">{priority}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        )}

        {/* ── Cyfrowy bliźniak ─────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Cyfrowy bliźniak"
            title="Prognozy na najbliższe dni"
            description={
              twin.baseline.days >= 14
                ? `Model uczy się Twojego organizmu od ${twin.baseline.days} dni. Dojrzałość: ${Math.round(twin.maturity * 100)}%.`
                : `Model dopiero się uczy — ma dane z ${twin.baseline.days} dni. Prognozy będą precyzyjniejsze po dwóch tygodniach.`
            }
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {twin.predictions.map((prediction) => (
              <div key={prediction.key} className="rounded-xl border border-longevity-line bg-white/[0.02] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-longevity-muted">{prediction.label}</p>
                  <p className="shrink-0 font-display text-lg font-semibold tabular-nums text-longevity-ink">
                    {prediction.kind === "probability"
                      ? `${Math.round(prediction.value * 100)}%`
                      : `${prediction.value > 0 ? "+" : ""}${prediction.value} ${prediction.unit ?? ""}`}
                  </p>
                </div>
                {prediction.kind === "probability" && (
                  <ProgressBar
                    value={prediction.value}
                    tone={prediction.value >= 0.6 ? "danger" : prediction.value >= 0.35 ? "warn" : "good"}
                    className="mt-2"
                  />
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-longevity-muted/80">{prediction.explanation}</p>
              </div>
            ))}
          </div>

          {(twin.optimalBedtimeMinOfDay !== undefined || twin.optimalTrainingWindow) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {twin.optimalBedtimeMinOfDay !== undefined && (
                <Pill tone="gold">
                  Optymalna pora snu: {formatMinuteOfDay(twin.optimalBedtimeMinOfDay)}
                </Pill>
              )}
              {twin.optimalTrainingWindow && (
                <Pill tone="teal">
                  Najlepsze okno treningowe: {twin.optimalTrainingWindow.startHour}:00–
                  {twin.optimalTrainingWindow.endHour}:00
                </Pill>
              )}
              <Pill tone="neutral">Poziom {gamification.level} · seria {gamification.currentStreak} dni</Pill>
            </div>
          )}
        </GlassCard>

        <Disclaimer />

        {profile.chronologicalAge === 35 && !demoMode && !hasRealData && (
          <GlassCard accent="teal" className="p-5">
            <SectionTitle
              eyebrow="Pierwszy krok"
              title="Uzupełnij profil, aby wyniki dotyczyły Ciebie"
              description="Wiek, wzrost i masa ciała są potrzebne do wyliczenia wieku biologicznego i celów żywieniowych. Zajmie to minutę."
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`${LONGEVITY_BASE}/ustawienia`}>
                <LongevityButton size="sm">Uzupełnij profil</LongevityButton>
              </Link>
              <Link to={`${LONGEVITY_BASE}/urzadzenia`}>
                <LongevityButton size="sm" variant="ghost">
                  Podłącz urządzenie
                </LongevityButton>
              </Link>
            </div>
          </GlassCard>
        )}
      </div>
    </LongevityShell>
  );
};

export default Dashboard;
