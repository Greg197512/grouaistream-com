/**
 * Szacowanie wieku biologicznego stylu życia.
 *
 * ⚠️ To NIE jest zegar epigenetyczny ani badanie medyczne. Nie mierzymy
 * metylacji DNA, telomerów ani żadnego biomarkera. Model przekłada
 * NAWYKI i POMIARY Z URZĄDZEŃ na orientacyjną liczbę lat, korzystając
 * z kierunków i rzędów wielkości znanych z badań populacyjnych nad stylem
 * życia. Wynik służy motywacji i śledzeniu zmian w czasie — nie diagnostyce.
 *
 * Konstrukcja:
 *   wiek biologiczny = wiek metrykalny + Σ wkładów czynników
 * Każdy czynnik ma zdefiniowany maksymalny wpływ w latach. Jakość czynnika
 * jest normalizowana do 0–1, gdzie 0,5 oznacza „przeciętnie dla populacji”,
 * czyli wkład zerowy. Czynniki bez danych są pomijane, a nie zerowane —
 * dzięki temu użytkownik bez opaski nie dostaje sztucznie dobrego wyniku.
 */

import type {
  BiologicalAgeResult,
  DailyRecord,
  ScoreDriver,
  TwinBaseline,
  UserProfile,
} from "./types";
import {
  circularStdMinutes,
  clamp,
  clamp01,
  confidenceFromCoverage,
  mean,
  normalize,
  plateau,
  round,
} from "./math";
import {
  ALCOHOL_WEEKLY_LOW_RISK_UNITS,
  BMI_OPTIMAL_HIGH,
  BMI_OPTIMAL_LOW,
  FIBER_TARGET_G,
  MVPA_TARGET_MIN_PER_DAY,
  SLEEP_TARGET_MIN,
  STEPS_TARGET_DEFAULT,
  VEGETABLE_SERVINGS_TARGET,
  bmi,
  referenceHrv,
  vo2Normalized,
} from "./norms";

interface AgeFactor {
  key: string;
  label: string;
  /** Maksymalny wpływ w latach w każdą stronę. */
  maxYears: number;
  /** 0–1; 0,5 = przeciętnie (wkład 0). `undefined` = brak danych. */
  quality: number | undefined;
  /** Nazwa pola, którego brakuje — pokazywana użytkownikowi. */
  missingHint: string;
}

/** Średnia z dostępnych wartości pola w oknie; `undefined`, gdy nie ma nic. */
const avgOf = <T>(
  records: DailyRecord[],
  pick: (r: DailyRecord) => number | undefined,
): number | undefined => {
  const values = records.map(pick).filter((v): v is number => v !== undefined && Number.isFinite(v));
  return values.length === 0 ? undefined : mean(values);
};

/**
 * Szacuje wiek biologiczny z okna ostatnich dni (zalecane 14–90).
 * Im dłuższe okno, tym stabilniejszy wynik — dzienne wahania HRV nie powinny
 * przesuwać „wieku” o rok w tę i z powrotem.
 */
export const estimateBiologicalAge = (
  profile: UserProfile,
  records: DailyRecord[],
  baseline: TwinBaseline,
): BiologicalAgeResult => {
  const window = records.slice(-90);
  const age = profile.chronologicalAge;

  // ── Sen: długość + regularność ─────────────────────────────────────────────
  const sleepMin = avgOf(window, (r) => r.sleep?.durationMin) ?? baseline.sleepMin;
  const sleepDurationQuality =
    sleepMin === undefined ? undefined : plateau(sleepMin, 240, SLEEP_TARGET_MIN - 30, SLEEP_TARGET_MIN + 60, 660);

  const bedtimes = window
    .map((r) => r.sleep?.bedtimeMinOfDay)
    .filter((v): v is number => v !== undefined);
  const regularityQuality =
    bedtimes.length >= 5 ? 1 - normalize(circularStdMinutes(bedtimes), 20, 120) : undefined;

  // ── Wydolność krążeniowa ───────────────────────────────────────────────────
  const vo2 = avgOf(window, (r) => r.cardio?.vo2Max);
  const vo2Quality = vo2 === undefined ? undefined : vo2Normalized(vo2, age, profile.sex);

  const rhr = avgOf(window, (r) => r.cardio?.restingHeartRate) ?? baseline.restingHeartRate;
  const rhrQuality = rhr === undefined ? undefined : 1 - normalize(rhr, 48, 82);

  // HRV odnosimy do normy wiekowej — tu chodzi o pozycję względem populacji,
  // a nie o dzienne odchylenie od własnej bazy (to mierzy indeks stresu).
  const hrv = avgOf(window, (r) => r.cardio?.hrvMs ?? r.sleep?.avgHrvMs) ?? baseline.hrvMs;
  const hrvRef = referenceHrv(age);
  const hrvQuality = hrv === undefined ? undefined : normalize(hrv, hrvRef * 0.5, hrvRef * 1.5);

  // ── Aktywność ──────────────────────────────────────────────────────────────
  const steps = avgOf(window, (r) => r.activity?.steps) ?? baseline.steps;
  const stepsQuality = steps === undefined ? undefined : normalize(steps, 2500, 10_000);
  const mvpa = avgOf(window, (r) => r.activity?.moderateVigorousMin);
  const mvpaQuality = mvpa === undefined ? undefined : normalize(mvpa, 0, MVPA_TARGET_MIN_PER_DAY * 2);

  // ── Skład ciała ────────────────────────────────────────────────────────────
  const weight = avgOf(window, (r) => r.body?.weightKg) ?? profile.weightKg;
  const bmiValue = weight ? bmi(weight, profile.heightCm) : undefined;
  const bmiQuality =
    bmiValue === undefined ? undefined : plateau(bmiValue, 15, BMI_OPTIMAL_LOW, BMI_OPTIMAL_HIGH, 40);

  // ── Dieta ──────────────────────────────────────────────────────────────────
  const fiber = avgOf(window, (r) => r.nutrition?.fiberG);
  const veg = avgOf(window, (r) => r.nutrition?.vegetableServings);
  const sugar = avgOf(window, (r) => r.nutrition?.addedSugarG);
  const dietParts = [
    fiber === undefined ? undefined : normalize(fiber, 8, FIBER_TARGET_G),
    veg === undefined ? undefined : normalize(veg, 0, VEGETABLE_SERVINGS_TARGET),
    sugar === undefined ? undefined : 1 - normalize(sugar, 10, 75),
  ].filter((v): v is number => v !== undefined);
  const dietQuality = dietParts.length === 0 ? undefined : mean(dietParts);

  // ── Stres subiektywny ──────────────────────────────────────────────────────
  const stress = avgOf(window, (r) => r.subjective?.stress);
  const vendorStress = avgOf(window, (r) => r.vendor?.stressScore);
  const stressQuality =
    stress !== undefined
      ? 1 - normalize(stress, 1, 5)
      : vendorStress !== undefined
        ? 1 - clamp01(vendorStress / 100)
        : undefined;

  const factors: AgeFactor[] = [
    {
      key: "sleepDuration",
      label: "Długość snu",
      maxYears: 2.2,
      quality: sleepDurationQuality,
      missingHint: "Długość snu",
    },
    {
      key: "sleepRegularity",
      label: "Regularność snu",
      maxYears: 1.4,
      quality: regularityQuality,
      missingHint: "Regularne pory snu (min. 5 nocy)",
    },
    {
      key: "vo2max",
      label: "Wydolność tlenowa (VO₂max)",
      maxYears: 4.0,
      quality: vo2Quality,
      missingHint: "VO₂max z zegarka",
    },
    {
      key: "restingHr",
      label: "Tętno spoczynkowe",
      maxYears: 1.2,
      quality: rhrQuality,
      missingHint: "Tętno spoczynkowe",
    },
    { key: "hrv", label: "HRV", maxYears: 1.8, quality: hrvQuality, missingHint: "HRV (RMSSD)" },
    {
      key: "steps",
      label: "Kroki dziennie",
      maxYears: 1.6,
      quality: stepsQuality,
      missingHint: "Kroki",
    },
    {
      key: "mvpa",
      label: "Aktywność umiarkowana i intensywna",
      maxYears: 1.4,
      quality: mvpaQuality,
      missingHint: "Minuty aktywności intensywnej",
    },
    { key: "bmi", label: "BMI", maxYears: 2.2, quality: bmiQuality, missingHint: "Masa ciała" },
    { key: "diet", label: "Jakość diety", maxYears: 2.4, quality: dietQuality, missingHint: "Dziennik diety" },
    {
      key: "stress",
      label: "Poziom stresu",
      maxYears: 2.2,
      quality: stressQuality,
      missingHint: "Ocena stresu lub Stress Score z zegarka",
    },
  ];

  const drivers: ScoreDriver[] = [];
  const missingInputs: string[] = [];
  let deltaYears = 0;
  let usedWeight = 0;
  const totalWeight = factors.reduce((acc, f) => acc + f.maxYears, 0);

  for (const factor of factors) {
    if (factor.quality === undefined) {
      missingInputs.push(factor.missingHint);
      continue;
    }
    // quality 1 → −maxYears (młodziej), quality 0 → +maxYears (starzej).
    const contribution = (0.5 - clamp01(factor.quality)) * 2 * factor.maxYears;
    deltaYears += contribution;
    usedWeight += factor.maxYears;
    drivers.push({
      key: factor.key,
      label: factor.label,
      normalized: clamp01(factor.quality),
      contribution: round(contribution, 2),
    });
  }

  // ── Używki: wpływ wyłącznie w jedną stronę (nie da się „odmłodzić” niepaleniem) ──
  const cigarettes = avgOf(window, (r) => r.lifestyle?.cigarettes);
  const smokingStatus =
    window.find((r) => r.lifestyle?.smokingStatus)?.lifestyle?.smokingStatus ?? profile.smokingStatus;

  if (smokingStatus === "current") {
    const perDay = cigarettes ?? 10;
    const penalty = clamp(2.5 + normalize(perDay, 1, 25) * 5.5, 2.5, 8);
    deltaYears += penalty;
    usedWeight += 4;
    drivers.push({
      key: "smoking",
      label: "Palenie tytoniu",
      normalized: 0,
      contribution: round(penalty, 2),
    });
  } else if (smokingStatus === "former") {
    // Nadwyżka ryzyka maleje z latami od rzucenia — po ~15 latach bliska zeru.
    const years = profile.yearsSinceQuit ?? 1;
    const penalty = clamp(3 * (1 - normalize(years, 0, 15)), 0, 3);
    deltaYears += penalty;
    usedWeight += 2;
    drivers.push({
      key: "smoking",
      label: "Palenie w przeszłości",
      normalized: clamp01(normalize(years, 0, 15)),
      contribution: round(penalty, 2),
    });
  }

  const dailyAlcohol = avgOf(window, (r) => r.nutrition?.alcoholUnits);
  const weeklyAlcohol =
    dailyAlcohol !== undefined ? dailyAlcohol * 7 : profile.weeklyAlcoholUnits;
  if (weeklyAlcohol !== undefined) {
    const excess = Math.max(0, weeklyAlcohol - ALCOHOL_WEEKLY_LOW_RISK_UNITS);
    const penalty = normalize(excess, 0, 21) * 2.5;
    deltaYears += penalty;
    usedWeight += 2;
    drivers.push({
      key: "alcohol",
      label: "Alkohol",
      normalized: clamp01(1 - normalize(weeklyAlcohol, 0, ALCOHOL_WEEKLY_LOW_RISK_UNITS * 3)),
      contribution: round(penalty, 2),
    });
  } else {
    missingInputs.push("Spożycie alkoholu");
  }

  // Ograniczenie zakresu: model stylu życia nie ma prawa twierdzić,
  // że ktoś jest o 25 lat młodszy. Realistyczne widełki to −10…+15 lat.
  const bounded = clamp(deltaYears, -10, 15);
  const estimated = clamp(age + bounded, 18, 110);

  return {
    estimatedAge: round(estimated, 1),
    chronologicalAge: age,
    deltaYears: round(estimated - age, 1),
    confidence: confidenceFromCoverage(usedWeight, totalWeight),
    drivers: drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    missingInputs,
  };
};

/**
 * Recovery Age — „wiek regeneracyjny”. Reaguje szybko (okno 7–14 dni) i mówi,
 * jak organizm radzi sobie TERAZ, w odróżnieniu od wolnozmiennego wieku
 * biologicznego. To ta liczba spada po tygodniu złego snu i wraca po urlopie.
 */
export const estimateRecoveryAge = (
  profile: UserProfile,
  recoveryScoreValue: number,
  sleepScoreValue: number,
  stressIndexValue: number,
): number => {
  const quality = clamp01(
    (recoveryScoreValue / 100) * 0.45 +
      (sleepScoreValue / 100) * 0.35 +
      (1 - stressIndexValue / 100) * 0.2,
  );
  // Pełna regeneracja → −6 lat, brak regeneracji → +8 lat.
  const delta = (0.5 - quality) * 2 * 7 + 1;
  return round(clamp(profile.chronologicalAge + delta, 18, 110), 1);
};
