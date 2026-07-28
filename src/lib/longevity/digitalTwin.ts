/**
 * AI Health Digital Twin — cyfrowy bliźniak użytkownika.
 *
 * Bliźniak to nie osobny model językowy, tylko warstwa statystyczna:
 * uczy się OSOBISTEJ NORMY (mediana + rozrzut dla każdej metryki) i na jej tle
 * wykrywa odchylenia oraz ekstrapoluje trendy. Dzięki temu ta sama liczba
 * (np. HRV 45 ms) jest interpretowana inaczej u różnych osób.
 *
 * Dojrzałość modelu (`maturity`) rośnie z liczbą dni danych. Poniżej 14 dni
 * bliźniak jawnie sygnalizuje, że dopiero się uczy — nie udaje pewności,
 * której nie ma. Wszystkie prognozy są wskazówkami opartymi na danych,
 * nie rozpoznaniem medycznym.
 */

import type {
  DailyRecord,
  DigitalTwin,
  TrendAnalysis,
  TrendPoint,
  TrendWindow,
  TwinBaseline,
  TwinPrediction,
  UserProfile,
} from "./types";
import {
  circularMeanMinutes,
  clamp,
  clamp01,
  confidenceFromCoverage,
  linearSlope,
  mean,
  median,
  normalize,
  round,
  stdDev,
} from "./math";
import { SLEEP_TARGET_MIN } from "./norms";

/** Metryki dostępne na wykresach i w analizie trendów. */
export const TREND_METRICS = {
  sleepMin: {
    label: "Długość snu",
    unit: "min",
    pick: (r: DailyRecord) => r.sleep?.durationMin,
  },
  hrvMs: {
    label: "HRV",
    unit: "ms",
    pick: (r: DailyRecord) => r.cardio?.hrvMs ?? r.sleep?.avgHrvMs,
  },
  restingHeartRate: {
    label: "Tętno spoczynkowe",
    unit: "bpm",
    pick: (r: DailyRecord) => r.cardio?.restingHeartRate ?? r.sleep?.avgHeartRate,
  },
  steps: {
    label: "Kroki",
    unit: "",
    pick: (r: DailyRecord) => r.activity?.steps,
  },
  bodyBattery: {
    label: "Body Battery",
    unit: "",
    pick: (r: DailyRecord) => r.vendor?.bodyBattery,
  },
  stressScore: {
    label: "Stres z urządzenia",
    unit: "",
    pick: (r: DailyRecord) => r.vendor?.stressScore,
  },
  weightKg: {
    label: "Masa ciała",
    unit: "kg",
    pick: (r: DailyRecord) => r.body?.weightKg,
  },
  vo2Max: {
    label: "VO₂max",
    unit: "ml/kg/min",
    pick: (r: DailyRecord) => r.cardio?.vo2Max,
  },
  waterMl: {
    label: "Nawodnienie",
    unit: "ml",
    pick: (r: DailyRecord) => r.nutrition?.waterMl,
  },
} as const;

export type TrendMetricKey = keyof typeof TREND_METRICS;

/**
 * Buduje bazę osobistą z ostatnich `windowDays` dni.
 * Używa mediany, nie średniej — jedna noc na lotnisku nie ma prawa przesunąć
 * normy, względem której oceniamy kolejne dni.
 */
export const buildBaseline = (records: DailyRecord[], windowDays = 28): TwinBaseline => {
  const window = records.slice(-windowDays);

  const collect = (pick: (r: DailyRecord) => number | undefined): number[] =>
    window.map(pick).filter((v): v is number => v !== undefined && Number.isFinite(v));

  const hrv = collect((r) => r.cardio?.hrvMs ?? r.sleep?.avgHrvMs);
  const rhr = collect((r) => r.cardio?.restingHeartRate ?? r.sleep?.avgHeartRate);
  const sleep = collect((r) => r.sleep?.durationMin);
  const steps = collect((r) => r.activity?.steps);
  const battery = collect((r) => r.vendor?.bodyBattery);
  const bedtimes = collect((r) => r.sleep?.bedtimeMinOfDay);

  return {
    hrvMs: hrv.length ? round(median(hrv), 1) : undefined,
    hrvSd: hrv.length > 2 ? round(stdDev(hrv), 2) : undefined,
    restingHeartRate: rhr.length ? round(median(rhr), 1) : undefined,
    restingHeartRateSd: rhr.length > 2 ? round(stdDev(rhr), 2) : undefined,
    sleepMin: sleep.length ? round(median(sleep)) : undefined,
    sleepMinSd: sleep.length > 2 ? round(stdDev(sleep)) : undefined,
    steps: steps.length ? round(median(steps)) : undefined,
    bodyBattery: battery.length ? round(median(battery)) : undefined,
    bedtimeMinOfDay: bedtimes.length ? round(circularMeanMinutes(bedtimes)) : undefined,
    days: window.length,
  };
};

/** Analiza trendu jednej metryki w oknie 7 / 30 / 90 / 365 dni. */
export const analyzeTrend = (
  records: DailyRecord[],
  metric: TrendMetricKey,
  window: TrendWindow,
  /** Kierunek „lepiej”: dla tętna spoczynkowego i stresu niższa wartość jest lepsza. */
  lowerIsBetter = metric === "restingHeartRate" || metric === "stressScore",
): TrendAnalysis => {
  const config = TREND_METRICS[metric];
  const slice = records.slice(-window);
  const points: TrendPoint[] = slice
    .map((r) => ({ date: r.date, value: config.pick(r) }))
    .filter((p): p is TrendPoint => p.value !== undefined && Number.isFinite(p.value));

  if (points.length < 2) {
    return {
      metric,
      window,
      points,
      mean: points.length === 1 ? points[0].value : 0,
      slopePerDay: 0,
      changePct: 0,
      direction: "stable",
      coverage: points.length,
    };
  }

  const half = Math.floor(points.length / 2);
  const firstHalf = mean(points.slice(0, half).map((p) => p.value));
  const secondHalf = mean(points.slice(half).map((p) => p.value));
  const changePct = firstHalf === 0 ? 0 : ((secondHalf - firstHalf) / Math.abs(firstHalf)) * 100;
  const slope = linearSlope(points);

  // Próg 3% chroni przed nazywaniem szumu pomiarowego „poprawą”.
  const improving = lowerIsBetter ? changePct < -3 : changePct > 3;
  const declining = lowerIsBetter ? changePct > 3 : changePct < -3;

  return {
    metric,
    window,
    points,
    mean: round(mean(points.map((p) => p.value)), 1),
    slopePerDay: round(slope, 3),
    changePct: round(changePct, 1),
    direction: improving ? "improving" : declining ? "declining" : "stable",
    coverage: points.length,
  };
};

const lastN = <T>(records: DailyRecord[], n: number, pick: (r: DailyRecord) => T | undefined): T[] =>
  records
    .slice(-n)
    .map(pick)
    .filter((v): v is T => v !== undefined);

/**
 * Optymalna pora snu: kołowa średnia z pór zaśnięcia w dniach, po których
 * użytkownik miał najlepszą regenerację. Jeśli danych o regeneracji brak,
 * cofamy się do zwykłej bazy chronotypu.
 */
const inferOptimalBedtime = (records: DailyRecord[]): number | undefined => {
  const scored = records
    .map((r, i) => {
      const next = records[i + 1];
      const quality =
        next?.vendor?.trainingReadiness ??
        next?.vendor?.readinessScore ??
        next?.vendor?.bodyBattery ??
        (r.sleep?.vendorScore ?? undefined);
      return r.sleep?.bedtimeMinOfDay !== undefined && quality !== undefined
        ? { bedtime: r.sleep.bedtimeMinOfDay, quality }
        : undefined;
    })
    .filter((v): v is { bedtime: number; quality: number } => v !== undefined);

  if (scored.length >= 6) {
    const sorted = [...scored].sort((a, b) => b.quality - a.quality);
    const best = sorted.slice(0, Math.max(3, Math.floor(sorted.length * 0.3)));
    return round(circularMeanMinutes(best.map((s) => s.bedtime)));
  }

  const bedtimes = lastN(records, 28, (r) => r.sleep?.bedtimeMinOfDay);
  return bedtimes.length >= 3 ? round(circularMeanMinutes(bedtimes)) : undefined;
};

/**
 * Okno treningowe: u większości osób szczyt temperatury głębokiej i siły
 * przypada 6–9 h po pobudce. Wyliczamy je z realnej pory wstawania
 * użytkownika, a nie z ogólnej rekomendacji „trenuj po południu”.
 */
const inferTrainingWindow = (records: DailyRecord[]): { startHour: number; endHour: number } | undefined => {
  const wakes = lastN(records, 28, (r) => r.sleep?.wakeMinOfDay);
  if (wakes.length < 3) return undefined;
  const wake = circularMeanMinutes(wakes) / 60;
  return {
    startHour: round(clamp(wake + 6, 6, 20)),
    endHour: round(clamp(wake + 9, 8, 22)),
  };
};

export const buildDigitalTwin = (
  profile: UserProfile,
  records: DailyRecord[],
  baseline: TwinBaseline,
): DigitalTwin => {
  const predictions: TwinPrediction[] = [];
  const maturity = clamp01(baseline.days / 60);
  const confidence = confidenceFromCoverage(baseline.days, 60);

  // ── 1. Spadek energii jutro ────────────────────────────────────────────────
  const recentSleep = lastN(records, 3, (r) => r.sleep?.durationMin);
  const targetSleep = profile.targetSleepMin ?? SLEEP_TARGET_MIN;
  const sleepDebt = recentSleep.length
    ? recentSleep.reduce((acc, v) => acc + Math.max(0, targetSleep - v), 0)
    : undefined;
  const hrvTrend = analyzeTrend(records, "hrvMs", 7);
  if (sleepDebt !== undefined) {
    const debtRisk = normalize(sleepDebt, 0, 240);
    const hrvRisk = hrvTrend.direction === "declining" ? normalize(Math.abs(hrvTrend.changePct), 3, 25) : 0;
    const probability = clamp01(debtRisk * 0.65 + hrvRisk * 0.35);
    predictions.push({
      key: "energyDip",
      label: "Ryzyko spadku energii jutro",
      value: round(probability, 2),
      kind: "probability",
      horizonDays: 1,
      confidence,
      explanation: `Deficyt snu z ostatnich 3 dni: ${Math.round(sleepDebt)} min${
        hrvTrend.direction === "declining" ? `, HRV w trendzie spadkowym (${hrvTrend.changePct}%)` : ""
      }.`,
    });
  }

  // ── 2. Ryzyko przetrenowania ───────────────────────────────────────────────
  const load = lastN(records, 7, (r) => r.activity?.moderateVigorousMin ?? undefined);
  const strain = lastN(records, 7, (r) => r.vendor?.strain);
  const readiness = lastN(records, 7, (r) => r.vendor?.trainingReadiness ?? r.vendor?.readinessScore);
  if (load.length >= 3 || strain.length >= 3) {
    const weeklyLoad = load.reduce((a, b) => a + b, 0);
    const loadRisk = load.length ? normalize(weeklyLoad, 240, 600) : 0;
    const strainRisk = strain.length ? normalize(mean(strain), 12, 19) : 0;
    const readinessRisk = readiness.length ? 1 - clamp01(mean(readiness) / 100) : 0;
    const parts = [
      load.length ? loadRisk : undefined,
      strain.length ? strainRisk : undefined,
      readiness.length ? readinessRisk : undefined,
    ].filter((v): v is number => v !== undefined);
    predictions.push({
      key: "overtraining",
      label: "Ryzyko przetrenowania (7 dni)",
      value: round(clamp01(mean(parts)), 2),
      kind: "probability",
      horizonDays: 7,
      confidence,
      explanation: load.length
        ? `Obciążenie tygodniowe: ${Math.round(weeklyLoad)} min aktywności intensywnej przy ${
            readiness.length ? `średniej gotowości ${Math.round(mean(readiness))}/100` : "braku danych o gotowości"
          }.`
        : "Na podstawie obciążenia raportowanego przez urządzenie.",
    });
  }

  // ── 3. Przewlekły stres ────────────────────────────────────────────────────
  const stressDays = lastN(records, 14, (r) =>
    r.vendor?.stressScore ?? (r.subjective?.stress !== undefined ? r.subjective.stress * 20 : undefined),
  );
  if (stressDays.length >= 5) {
    const highDays = stressDays.filter((v) => v >= 60).length;
    const probability = clamp01(highDays / Math.max(stressDays.length * 0.5, 1));
    predictions.push({
      key: "chronicStress",
      label: "Oznaki przewlekłego stresu",
      value: round(probability, 2),
      kind: "probability",
      horizonDays: 14,
      confidence,
      explanation: `Podwyższony stres w ${highDays} z ${stressDays.length} ostatnich dni z pomiarem.`,
    });
  }

  // ── 4. Pogorszenie jakości snu ─────────────────────────────────────────────
  const sleepTrend = analyzeTrend(records, "sleepMin", 14);
  if (sleepTrend.coverage >= 5) {
    const probability =
      sleepTrend.direction === "declining" ? clamp01(normalize(Math.abs(sleepTrend.changePct), 3, 25)) : clamp01(0.15 - sleepTrend.changePct / 200);
    predictions.push({
      key: "sleepDecline",
      label: "Ryzyko pogorszenia snu",
      value: round(clamp01(probability), 2),
      kind: "probability",
      horizonDays: 7,
      confidence,
      explanation: `Sen w 14 dniach: ${sleepTrend.changePct > 0 ? "+" : ""}${sleepTrend.changePct}% (średnio ${Math.round(
        sleepTrend.mean,
      )} min).`,
    });
  }

  // ── 5. Zapotrzebowanie na regenerację ──────────────────────────────────────
  const batteryLows = lastN(records, 7, (r) => r.vendor?.bodyBatteryLow ?? r.vendor?.bodyBattery);
  if (batteryLows.length >= 3) {
    const avgLow = mean(batteryLows);
    predictions.push({
      key: "recoveryNeed",
      label: "Zalecany dzień regeneracyjny w ciągu 48 h",
      value: round(clamp01(1 - normalize(avgLow, 5, 45)), 2),
      kind: "probability",
      horizonDays: 2,
      confidence,
      explanation: `Średni minimalny poziom Body Battery: ${Math.round(avgLow)}/100.`,
    });
  }

  // ── 6. Prognoza wieku biologicznego za 90 dni ──────────────────────────────
  const sleepSlope = analyzeTrend(records, "sleepMin", 90).slopePerDay;
  const stepsSlope = analyzeTrend(records, "steps", 90).slopePerDay;
  if (records.length >= 21) {
    // Przybliżenie: utrzymanie obecnych trendów przez kwartał przekłada się na
    // ułamek roku różnicy. Skala celowo zachowawcza.
    const projected =
      -(sleepSlope * 90) / 600 - (stepsSlope * 90) / 30_000;
    predictions.push({
      key: "bioAgeProjection",
      label: "Prognozowana zmiana wieku biologicznego (90 dni)",
      value: round(clamp(projected, -1.5, 1.5), 2),
      kind: "value",
      unit: "lat",
      horizonDays: 90,
      confidence,
      explanation:
        "Ekstrapolacja obecnych trendów snu i aktywności. Wartość ujemna oznacza kierunek korzystny.",
    });
  }

  return {
    baseline,
    predictions,
    optimalBedtimeMinOfDay: inferOptimalBedtime(records),
    optimalTrainingWindow: inferTrainingWindow(records),
    maturity: round(maturity, 2),
  };
};
