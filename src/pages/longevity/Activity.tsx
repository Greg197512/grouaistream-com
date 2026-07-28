/**
 * Moduł AKTYWNOŚĆ — kroki, kalorie, treningi, spacer i rozciąganie.
 *
 * Ekran odpowiada na jedno pytanie: ile obciążenia organizm uniesie dzisiaj.
 * Dlatego rekomendacja treningowa (z gotowości Garmina albo z wyniku
 * regeneracji) stoi wyżej niż same liczby kroków.
 */

import { useMemo } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import { MetricTile, ScoreRing } from "@/components/longevity/ScoreRing";
import { TrendChart } from "@/components/longevity/TrendChart";
import {
  Disclaimer,
  EmptyState,
  GlassCard,
  LongevityButton,
  Pill,
  ProgressBar,
  SectionTitle,
  StatRow,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  MVPA_TARGET_MIN_PER_DAY,
  STEPS_TARGET_DEFAULT,
  TRAINING_LABEL,
  analyzeTrend,
  formatDuration,
  weeklyGarminLoad,
} from "@/lib/longevity";

const TRAINING_TONE = {
  hard: "good",
  moderate: "good",
  easy: "warn",
  recovery: "warn",
  rest: "danger",
} as const;

const Activity = () => {
  const { analysis, records, today, profile, updateRecord } = useLongevity();
  const { panel, garmin, twin } = analysis;

  const stepsTrend = useMemo(() => analyzeTrend(records, "steps", 30), [records]);
  const weeklyLoad = useMemo(() => weeklyGarminLoad(records), [records]);

  const targetSteps = profile.targetSteps ?? STEPS_TARGET_DEFAULT;
  const activity = today.activity ?? {};
  const workouts = activity.workouts ?? [];

  const weekly = useMemo(() => {
    const week = records.slice(-7);
    return {
      steps: week.reduce((acc, r) => acc + (r.activity?.steps ?? 0), 0),
      mvpa: week.reduce((acc, r) => acc + (r.activity?.moderateVigorousMin ?? 0), 0),
      workouts: week.reduce((acc, r) => acc + (r.activity?.workouts?.length ?? 0), 0),
      kcal: week.reduce((acc, r) => acc + (r.activity?.activeKcal ?? 0), 0),
    };
  }, [records]);

  /**
   * Rekomendacja treningowa: dane Garmina mają pierwszeństwo, bo powstają
   * z pomiarów sekundowych. Bez nich schodzimy na własny wynik regeneracji.
   */
  const recommendation = garmin.available
    ? garmin.recommendation
    : panel.recoveryScore.value >= 75
      ? "hard"
      : panel.recoveryScore.value >= 60
        ? "moderate"
        : panel.recoveryScore.value >= 45
          ? "easy"
          : panel.recoveryScore.value >= 30
            ? "recovery"
            : "rest";

  const addWalk = (minutes: number) => {
    updateRecord({
      activity: {
        ...activity,
        walkMin: (activity.walkMin ?? 0) + minutes,
        steps: (activity.steps ?? 0) + minutes * 100,
      },
      lifestyle: { ...today.lifestyle, outdoorMin: (today.lifestyle?.outdoorMin ?? 0) + minutes },
    });
  };

  return (
    <LongevityShell
      title="Aktywność"
      subtitle="Ruch dopasowany do gotowości organizmu, nie do sztywnego planu."
      action={<Pill tone={TRAINING_TONE[recommendation]}>{TRAINING_LABEL[recommendation]}</Pill>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard accent="teal" className="flex flex-col items-center gap-4 p-6 lg:col-span-2">
            <ScoreRing
              value={Math.min(100, ((activity.steps ?? 0) / targetSteps) * 100)}
              tone="teal"
              size={190}
            >
              <span className="text-[11px] uppercase tracking-[0.2em] text-longevity-muted">Kroki dziś</span>
              <span className="font-display text-4xl font-semibold tabular-nums leading-none text-longevity-ink">
                {(activity.steps ?? 0).toLocaleString("pl-PL")}
              </span>
              <span className="mt-1 text-xs text-longevity-muted">cel {targetSteps.toLocaleString("pl-PL")}</span>
            </ScoreRing>

            <div className="w-full space-y-2.5">
              <div>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-longevity-muted">Aktywność umiarkowana i intensywna</span>
                  <span className="tabular-nums text-longevity-ink">
                    {activity.moderateVigorousMin ?? 0} / {MVPA_TARGET_MIN_PER_DAY} min
                  </span>
                </div>
                <ProgressBar value={(activity.moderateVigorousMin ?? 0) / MVPA_TARGET_MIN_PER_DAY} tone="teal" />
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-longevity-muted">Czas siedzenia</span>
                  <span className="tabular-nums text-longevity-ink">
                    {formatDuration(activity.sedentaryMin ?? 0)}
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(1, (activity.sedentaryMin ?? 0) / 720)}
                  tone={(activity.sedentaryMin ?? 0) > 600 ? "danger" : "good"}
                />
              </div>
            </div>
          </GlassCard>

          <div className="space-y-4 lg:col-span-3">
            <GlassCard accent="gold" className="p-5">
              <SectionTitle
                eyebrow="Rekomendacja na dziś"
                title={TRAINING_LABEL[recommendation]}
                description={
                  garmin.available
                    ? "Na podstawie Body Battery, Training Readiness i HRV Status z Garmina."
                    : `Na podstawie wyniku regeneracji (${panel.recoveryScore.value}/100) — podłącz zegarek, aby uwzględnić metryki producenta.`
                }
              />

              <ul className="mt-4 space-y-2">
                {(garmin.available ? garmin.priorities : [
                  recommendation === "rest" || recommendation === "recovery"
                    ? "Spacer 30–45 minut w tempie rozmowy"
                    : recommendation === "easy"
                      ? "Trening w strefie 1–2, bez interwałów"
                      : "Rozgrzewka 10 minut, potem właściwa jednostka",
                  "Nawodnienie 2 litry rozłożone na cały dzień",
                  "Rozciąganie lub mobilność 10 minut wieczorem",
                ]).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-longevity-ink">
                    <span className="material-icons-outlined mt-px text-[15px] leading-none text-longevity-gold" aria-hidden>
                      check
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              {twin.optimalTrainingWindow && (
                <Pill tone="teal" className="mt-4">
                  Najlepsze okno treningowe: {twin.optimalTrainingWindow.startHour}:00–
                  {twin.optimalTrainingWindow.endHour}:00
                </Pill>
              )}
            </GlassCard>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile
                label="Kalorie aktywne"
                value={Math.round(activity.activeKcal ?? 0)}
                ratio={Math.min(1, (activity.activeKcal ?? 0) / 700)}
                tone="gold"
                icon="local_fire_department"
              />
              <MetricTile
                label="Dystans"
                value={(activity.distanceKm ?? 0).toFixed(1)}
                unit="km"
                ratio={Math.min(1, (activity.distanceKm ?? 0) / 8)}
                tone="teal"
                icon="straighten"
              />
              <MetricTile
                label="Spacer"
                value={activity.walkMin ?? 0}
                unit="min"
                ratio={Math.min(1, (activity.walkMin ?? 0) / 45)}
                tone="good"
                icon="directions_walk"
              />
              <MetricTile
                label="Rozciąganie"
                value={activity.stretchingMin ?? 0}
                unit="min"
                ratio={Math.min(1, (activity.stretchingMin ?? 0) / 15)}
                tone="teal"
                icon="accessibility_new"
              />
            </div>

            <GlassCard className="p-5">
              <SectionTitle eyebrow="Szybki wpis" title="Dopisz aktywność" />
              <div className="mt-3 flex flex-wrap gap-2">
                {[10, 20, 30, 45].map((minutes) => (
                  <LongevityButton key={minutes} variant="ghost" size="sm" onClick={() => addWalk(minutes)}>
                    + {minutes} min spaceru
                  </LongevityButton>
                ))}
                <LongevityButton
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateRecord({ activity: { ...activity, stretchingMin: (activity.stretchingMin ?? 0) + 10 } })
                  }
                >
                  + 10 min rozciągania
                </LongevityButton>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-longevity-muted/70">
                Spacer dopisany ręcznie dolicza również około 100 kroków na minutę — to przybliżenie
                dla tempa spacerowego. Kroki z zegarka zawsze nadpisują wartość wpisaną ręcznie.
              </p>
            </GlassCard>
          </div>
        </div>

        {/* ── Treningi dnia ─────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle eyebrow="Dzisiejsze treningi" title={`${workouts.length} jednostki`} />
          {workouts.length === 0 ? (
            <EmptyState
              icon="fitness_center"
              title="Brak treningów w tym dniu"
              description="Treningi synchronizują się automatycznie z Garmin Connect, Strava, Apple Health i Health Connect. Możesz też dopisać spacer przyciskiem powyżej."
            />
          ) : (
            <div className="mt-4 space-y-2.5">
              {workouts.map((workout, index) => (
                <div
                  key={`${workout.type}-${index}`}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-longevity-line bg-white/[0.02] p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-longevity-teal/15">
                    <span className="material-icons-outlined text-[18px] leading-none text-longevity-teal" aria-hidden>
                      directions_run
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-longevity-ink">{workout.type}</p>
                    <p className="text-xs text-longevity-muted">
                      {formatDuration(workout.durationMin)}
                      {workout.distanceKm ? ` · ${workout.distanceKm} km` : ""}
                      {workout.avgHeartRate ? ` · średnio ${workout.avgHeartRate} bpm` : ""}
                    </p>
                  </div>
                  {workout.kcal && <Pill tone="gold">{Math.round(workout.kcal)} kcal</Pill>}
                  {workout.intensity !== undefined && (
                    <Pill tone={workout.intensity >= 7 ? "danger" : "neutral"}>Intensywność {workout.intensity}/10</Pill>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* ── Tydzień i trend ───────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-5">
            <SectionTitle eyebrow="Ostatnie 7 dni" title="Bilans tygodnia" />
            <div className="mt-3">
              <StatRow
                label="Kroki łącznie"
                value={weekly.steps.toLocaleString("pl-PL")}
                hint={`Średnio ${Math.round(weekly.steps / 7).toLocaleString("pl-PL")} dziennie`}
                tone={weekly.steps / 7 >= targetSteps ? "good" : "warn"}
              />
              <StatRow
                label="Aktywność intensywna"
                value={`${weekly.mvpa} min`}
                hint="Rekomendacja WHO: 150 minut tygodniowo"
                tone={weekly.mvpa >= 150 ? "good" : "warn"}
              />
              <StatRow label="Treningi" value={`${weekly.workouts}`} />
              <StatRow label="Kalorie aktywne" value={`${Math.round(weekly.kcal).toLocaleString("pl-PL")} kcal`} />
              {weeklyLoad.avgBodyBattery !== undefined && (
                <StatRow
                  label="Średnie Body Battery"
                  value={`${weeklyLoad.avgBodyBattery}/100`}
                  hint={
                    weeklyLoad.loadTrend === "rising"
                      ? "Obciążenie rośnie — rozważ dzień regeneracyjny"
                      : weeklyLoad.loadTrend === "falling"
                        ? "Obciążenie maleje"
                        : "Obciążenie stabilne"
                  }
                  tone={weeklyLoad.avgBodyBattery >= 55 ? "good" : "warn"}
                />
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle
              eyebrow="Kroki · 30 dni"
              title={
                stepsTrend.direction === "improving"
                  ? `Więcej ruchu (+${Math.abs(stepsTrend.changePct)}%)`
                  : stepsTrend.direction === "declining"
                    ? `Mniej ruchu (${stepsTrend.changePct}%)`
                    : "Poziom ruchu stabilny"
              }
            />
            <TrendChart
              analysis={stepsTrend}
              className="mt-4"
              reference={{ value: targetSteps, label: "cel" }}
            />
          </GlassCard>
        </div>

        <Disclaimer text="Rekomendacje treningowe wynikają z danych o regeneracji i obciążeniu. Nie zastępują opieki trenera ani konsultacji lekarskiej, szczególnie przy chorobach układu krążenia, kontuzjach i powrocie do aktywności po przerwie." />
      </div>
    </LongevityShell>
  );
};

export default Activity;
