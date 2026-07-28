/**
 * Moduł SEN — długość, regularność, jakość, pobudki i fazy snu.
 * Rekomendacja jest zawsze skwantyfikowana („połóż się 45 minut wcześniej”),
 * bo tylko taka rada jest wykonalna.
 */

import { useMemo } from "react";
import { LongevityShell } from "@/components/longevity/LongevityShell";
import { DriverBars, MetricTile, ScoreRing } from "@/components/longevity/ScoreRing";
import { TrendChart } from "@/components/longevity/TrendChart";
import {
  ConfidenceBadge,
  Disclaimer,
  EmptyState,
  GlassCard,
  Pill,
  ProgressBar,
  SectionTitle,
  StatRow,
} from "@/components/longevity/primitives";
import { useLongevity } from "@/contexts/LongevityContext";
import {
  analyzeTrend,
  circularStdMinutes,
  formatDuration,
  formatMinuteOfDay,
  scoreBand,
  SLEEP_TARGET_MIN,
} from "@/lib/longevity";

const STAGE_COLORS = {
  deep: "#0E7C6F",
  rem: "#2DD4BF",
  light: "#4B5A6E",
  awake: "#F0B45E",
} as const;

const Sleep = () => {
  const { analysis, records, today, profile } = useLongevity();
  const { panel, twin } = analysis;
  const sleep = today.sleep;
  const target = profile.targetSleepMin ?? SLEEP_TARGET_MIN;

  const trend = useMemo(() => analyzeTrend(records, "sleepMin", 30), [records]);

  const regularity = useMemo(() => {
    const bedtimes = records
      .slice(-30)
      .map((r) => r.sleep?.bedtimeMinOfDay)
      .filter((v): v is number => v !== undefined);
    if (bedtimes.length < 4) return undefined;
    return Math.round(circularStdMinutes(bedtimes));
  }, [records]);

  const stages = sleep?.stages;
  const totalStages = stages
    ? (stages.deepMin ?? 0) + (stages.remMin ?? 0) + (stages.lightMin ?? 0) + (stages.awakeMin ?? 0)
    : 0;

  /** Rekomendacja przesunięcia pory snu — zaokrąglona do kwadransa. */
  const bedtimeAdvice = useMemo(() => {
    const optimal = twin.optimalBedtimeMinOfDay;
    const actual = sleep?.bedtimeMinOfDay;
    const deficit = sleep?.durationMin !== undefined ? target - sleep.durationMin : undefined;

    if (deficit !== undefined && deficit >= 20) {
      const shift = Math.round(deficit / 15) * 15;
      return {
        headline: `Dziś połóż się ${shift} minut wcześniej.`,
        detail:
          optimal !== undefined
            ? `To oznacza zaśnięcie około ${formatMinuteOfDay(optimal)} — tej porze odpowiadają Twoje najlepsze wyniki regeneracji.`
            : `Przy celu ${formatDuration(target)} brakuje Ci ${formatDuration(deficit)} snu.`,
      };
    }
    if (regularity !== undefined && regularity > 60) {
      return {
        headline: "Ustabilizuj porę zaśnięcia.",
        detail: `Twoje godziny snu wahają się o ${regularity} minut. Regularność wpływa na regenerację silniej niż pojedyncza długa noc.`,
      };
    }
    if (actual !== undefined && optimal !== undefined && Math.abs(actual - optimal) > 45) {
      return {
        headline: `Przesuń porę snu w stronę ${formatMinuteOfDay(optimal)}.`,
        detail: "To okno, w którym Twoje dane pokazują najlepszą regenerację.",
      };
    }
    return {
      headline: "Utrzymaj obecny rytm snu.",
      detail: "Długość i pora zaśnięcia mieszczą się w Twoim optymalnym zakresie.",
    };
  }, [regularity, sleep?.bedtimeMinOfDay, sleep?.durationMin, target, twin.optimalBedtimeMinOfDay]);

  return (
    <LongevityShell
      title="Sen"
      subtitle="Fundament regeneracji — długość, regularność, jakość i architektura nocy."
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <GlassCard accent="teal" className="flex flex-col items-center gap-4 p-6 lg:col-span-2">
            <ScoreRing value={panel.sleepScore.value} tone="teal" size={190} label="Sleep Score" />
            <div className="text-center">
              <p className="font-display text-lg font-semibold text-longevity-ink">
                {scoreBand(panel.sleepScore.value).label}
              </p>
              <ConfidenceBadge confidence={panel.sleepScore.confidence} className="mt-2" />
            </div>
            <div className="w-full">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-longevity-muted">Składniki wyniku</p>
              <DriverBars drivers={panel.sleepScore.drivers} />
            </div>
          </GlassCard>

          <div className="space-y-4 lg:col-span-3">
            <GlassCard accent="gold" className="p-5">
              <SectionTitle eyebrow="Rekomendacja na dziś" title={bedtimeAdvice.headline} />
              <p className="mt-2 text-sm leading-relaxed text-longevity-muted">{bedtimeAdvice.detail}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {twin.optimalBedtimeMinOfDay !== undefined && (
                  <Pill tone="gold">Optymalna pora snu: {formatMinuteOfDay(twin.optimalBedtimeMinOfDay)}</Pill>
                )}
                <Pill tone="neutral">Cel: {formatDuration(target)}</Pill>
                {regularity !== undefined && (
                  <Pill tone={regularity <= 45 ? "good" : "warn"}>Rozrzut pór snu: ±{regularity} min</Pill>
                )}
              </div>
            </GlassCard>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile
                label="Długość"
                value={sleep?.durationMin ? formatDuration(sleep.durationMin) : "—"}
                ratio={sleep?.durationMin ? Math.min(1, sleep.durationMin / target) : 0}
                tone="teal"
                icon="schedule"
              />
              <MetricTile
                label="Efektywność"
                value={
                  sleep?.durationMin && sleep?.timeInBedMin
                    ? `${Math.round((sleep.durationMin / sleep.timeInBedMin) * 100)}%`
                    : "—"
                }
                ratio={
                  sleep?.durationMin && sleep?.timeInBedMin ? sleep.durationMin / sleep.timeInBedMin : 0
                }
                tone="teal"
                icon="donut_small"
                hint="Sen do czasu w łóżku"
              />
              <MetricTile
                label="Pobudki"
                value={sleep?.awakenings ?? "—"}
                ratio={sleep?.awakenings !== undefined ? Math.max(0, 1 - sleep.awakenings / 6) : 0}
                tone={(sleep?.awakenings ?? 0) <= 2 ? "good" : "warn"}
                icon="notifications_active"
              />
              <MetricTile
                label="HRV nocne"
                value={sleep?.avgHrvMs ? `${Math.round(sleep.avgHrvMs)}` : "—"}
                unit="ms"
                ratio={sleep?.avgHrvMs && twin.baseline.hrvMs ? Math.min(1, sleep.avgHrvMs / (twin.baseline.hrvMs * 1.3)) : 0}
                tone="teal"
                icon="favorite"
                hint={twin.baseline.hrvMs ? `Baza: ${Math.round(twin.baseline.hrvMs)} ms` : undefined}
              />
            </div>
          </div>
        </div>

        {/* ── Architektura nocy ────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Architektura nocy"
            title="Fazy snu"
            description="Sen głęboki odpowiada za regenerację fizyczną, REM za konsolidację pamięci i regulację emocji."
          />

          {stages && totalStages > 0 ? (
            <div className="mt-4">
              <div className="flex h-10 w-full overflow-hidden rounded-xl">
                {(
                  [
                    { key: "deep", label: "Głęboki", value: stages.deepMin ?? 0 },
                    { key: "rem", label: "REM", value: stages.remMin ?? 0 },
                    { key: "light", label: "Lekki", value: stages.lightMin ?? 0 },
                    { key: "awake", label: "Czuwanie", value: stages.awakeMin ?? 0 },
                  ] as const
                ).map((stage) => (
                  <div
                    key={stage.key}
                    className="flex items-center justify-center text-[10px] font-medium text-black/70 transition-[width] duration-700"
                    style={{
                      width: `${(stage.value / totalStages) * 100}%`,
                      background: STAGE_COLORS[stage.key],
                    }}
                    title={`${stage.label}: ${formatDuration(stage.value)}`}
                  >
                    {stage.value / totalStages > 0.12 ? `${Math.round((stage.value / totalStages) * 100)}%` : ""}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
                <StatRow
                  label="Sen głęboki"
                  value={`${formatDuration(stages.deepMin ?? 0)} · ${Math.round(((stages.deepMin ?? 0) / totalStages) * 100)}%`}
                  hint="Zakres typowy: 13–23% nocy"
                  tone={(stages.deepMin ?? 0) / totalStages >= 0.13 ? "good" : "warn"}
                />
                <StatRow
                  label="Sen REM"
                  value={`${formatDuration(stages.remMin ?? 0)} · ${Math.round(((stages.remMin ?? 0) / totalStages) * 100)}%`}
                  hint="Zakres typowy: 20–25% nocy"
                  tone={(stages.remMin ?? 0) / totalStages >= 0.18 ? "good" : "warn"}
                />
                <StatRow label="Sen lekki" value={formatDuration(stages.lightMin ?? 0)} />
                <StatRow label="Czuwanie w nocy" value={formatDuration(stages.awakeMin ?? 0)} />
              </div>
            </div>
          ) : (
            <EmptyState
              icon="bedtime_off"
              title="Brak danych o fazach snu"
              description="Fazy snu raportują zegarki i pierścienie noszone w nocy (Garmin, Oura, Apple Watch, WHOOP, Fitbit). Podłącz urządzenie w zakładce Urządzenia albo wpisz długość snu ręcznie w Dzienniku."
            />
          )}
        </GlassCard>

        {/* ── Trend ─────────────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle
            eyebrow="Trend 30 dni"
            title={
              trend.coverage < 3
                ? "Za mało nocy, aby pokazać trend"
                : trend.direction === "improving"
                  ? `Sen poprawił się o ${Math.abs(trend.changePct)}%`
                  : trend.direction === "declining"
                    ? `Sen skrócił się o ${Math.abs(trend.changePct)}%`
                    : "Sen stabilny"
            }
            description={
              trend.coverage >= 3
                ? `Średnia z ${trend.coverage} nocy: ${formatDuration(trend.mean)}. Linia gruba to średnia krocząca 7-dniowa.`
                : undefined
            }
          />
          <TrendChart
            analysis={trend}
            unit="min"
            className="mt-4"
            reference={{ value: target, label: "cel" }}
          />
        </GlassCard>

        {/* ── Higiena snu ───────────────────────────────────────────────────── */}
        <GlassCard className="p-5">
          <SectionTitle eyebrow="Co realnie zmienia jakość nocy" title="Lista kontrolna wieczoru" />
          <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
            {[
              {
                label: "Ekran przed snem",
                value: today.lifestyle?.screenBeforeBedMin,
                target: 0,
                unit: "min",
                good: (v: number) => v <= 15,
                hint: "Światło niebieskie przesuwa wydzielanie melatoniny",
              },
              {
                label: "Ostatni posiłek przed snem",
                value:
                  today.nutrition?.lastMealMinOfDay !== undefined && sleep?.bedtimeMinOfDay !== undefined
                    ? (sleep.bedtimeMinOfDay >= today.nutrition.lastMealMinOfDay
                        ? sleep.bedtimeMinOfDay - today.nutrition.lastMealMinOfDay
                        : sleep.bedtimeMinOfDay + 1440 - today.nutrition.lastMealMinOfDay)
                    : undefined,
                target: 180,
                unit: "min odstępu",
                good: (v: number) => v >= 120,
                hint: "Odstęp co najmniej 2 godziny",
              },
              {
                label: "Alkohol",
                value: today.nutrition?.alcoholUnits,
                target: 0,
                unit: "jedn.",
                good: (v: number) => v === 0,
                hint: "Skraca fazę REM nawet przy jednej jednostce",
              },
              {
                label: "Światło poranne",
                value: today.lifestyle?.morningLightMin,
                target: 15,
                unit: "min",
                good: (v: number) => v >= 10,
                hint: "Ustawia rytm dobowy na wieczór",
              },
            ].map((item) => (
              <StatRow
                key={item.label}
                label={item.label}
                hint={item.hint}
                value={item.value === undefined ? "— brak wpisu" : `${Math.round(item.value)} ${item.unit}`}
                tone={item.value === undefined ? undefined : item.good(item.value) ? "good" : "warn"}
              />
            ))}
          </div>
          {panel.sleepScore.drivers.length > 0 && (
            <ProgressBar value={panel.sleepScore.value / 100} tone="teal" className="mt-4" />
          )}
        </GlassCard>

        <Disclaimer text="Analiza snu opiera się na danych z Twojego urządzenia i dziennika. To wskazówki dotyczące stylu życia, a nie badanie snu ani diagnoza zaburzeń snu. Przy chrapaniu z bezdechami, uporczywej bezsenności lub nadmiernej senności w ciągu dnia skonsultuj się z lekarzem." />
      </div>
    </LongevityShell>
  );
};

export default Sleep;
