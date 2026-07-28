/**
 * Silnik wyników dziennych: sen, stres, regeneracja, energia, mózg,
 * układ krążenia, metabolizm i zbiorczy Longevity Index.
 *
 * Zasady, których trzymają się wszystkie funkcje w tym pliku:
 *  1. Są czyste i deterministyczne — ten sam wejściowy dzień daje ten sam wynik.
 *  2. Brakujące dane nie są zastępowane zerem; składnik po prostu wypada
 *     z ważonej średniej, a `confidence` spada.
 *  3. Każdy wynik zwraca listę `drivers`, więc UI zawsze potrafi pokazać,
 *     z czego dokładnie powstała liczba. Brak „czarnych skrzynek”.
 *  4. To są wskaźniki stylu życia, nie parametry medyczne.
 */

import type {
  Confidence,
  DailyRecord,
  ScoreDriver,
  ScoreResult,
  StressLevel,
  TwinBaseline,
  UserProfile,
} from "./types";
import {
  circularStdMinutes,
  clamp,
  clamp01,
  confidenceFromCoverage,
  normalize,
  plateau,
  round,
  zScore,
} from "./math";
import {
  ADDED_SUGAR_LIMIT_G,
  BMI_OPTIMAL_HIGH,
  BMI_OPTIMAL_LOW,
  FIBER_TARGET_G,
  MVPA_TARGET_MIN_PER_DAY,
  PROTEIN_G_PER_KG,
  REFERENCE_RESTING_HR,
  SLEEP_TARGET_MIN,
  STEPS_TARGET_DEFAULT,
  VEGETABLE_SERVINGS_TARGET,
  bmi,
  referenceHrv,
  vo2Normalized,
} from "./norms";

interface Component {
  key: string;
  label: string;
  weight: number;
  /** 0–1, gdzie 1 = najlepszy możliwy wynik dla tego składnika. */
  normalized: number | undefined;
}

/**
 * Składa wynik 0–100 z ważonych komponentów, pomijając te bez danych.
 * `contribution` sumuje się do `value`, więc wykres udziałów zawsze się domyka.
 */
const buildScore = (components: Component[]): ScoreResult => {
  const totalWeight = components.reduce((acc, c) => acc + c.weight, 0);
  const available = components.filter(
    (c) => c.normalized !== undefined && Number.isFinite(c.normalized),
  );
  const usedWeight = available.reduce((acc, c) => acc + c.weight, 0);

  if (usedWeight === 0) {
    return { value: 0, confidence: "low", drivers: [], inputsUsed: 0 };
  }

  const drivers: ScoreDriver[] = available.map((c) => ({
    key: c.key,
    label: c.label,
    normalized: clamp01(c.normalized as number),
    contribution: round((clamp01(c.normalized as number) * c.weight * 100) / usedWeight, 1),
  }));

  const value = drivers.reduce((acc, d) => acc + d.contribution, 0);

  return {
    value: round(clamp(value, 0, 100)),
    confidence: confidenceFromCoverage(usedWeight, totalWeight),
    drivers: drivers.sort((a, b) => b.contribution - a.contribution),
    inputsUsed: available.length,
  };
};

/** Odwrotność oceny — do składników, gdzie „więcej = gorzej”. */
const invert = (v: number | undefined): number | undefined =>
  v === undefined ? undefined : 1 - clamp01(v);

// ─────────────────────────────────────────────────────────────────────────────
// SEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wynik snu 0–100. Regularność liczona jest z historii pór zaśnięcia
 * (kołowe odchylenie standardowe), bo to ona — a nie sama długość —
 * najmocniej koreluje z jakością regeneracji.
 */
export const sleepScore = (
  record: DailyRecord,
  history: DailyRecord[] = [],
  profile?: UserProfile,
): ScoreResult => {
  const sleep = record.sleep;
  const target = profile?.targetSleepMin ?? SLEEP_TARGET_MIN;

  const duration = sleep?.durationMin;
  const durationNorm =
    duration === undefined
      ? undefined
      : plateau(duration, 240, target - 30, target + 60, 660);

  const efficiency =
    sleep?.durationMin !== undefined && sleep?.timeInBedMin
      ? normalize(sleep.durationMin / sleep.timeInBedMin, 0.7, 0.95)
      : undefined;

  const bedtimes = history
    .map((d) => d.sleep?.bedtimeMinOfDay)
    .filter((v): v is number => v !== undefined);
  const regularity =
    bedtimes.length >= 4 ? 1 - normalize(circularStdMinutes(bedtimes), 15, 120) : undefined;

  const awakenings =
    sleep?.awakenings === undefined ? undefined : 1 - normalize(sleep.awakenings, 1, 6);

  const stages = sleep?.stages;
  const restorativeShare =
    stages && duration
      ? normalize(((stages.deepMin ?? 0) + (stages.remMin ?? 0)) / duration, 0.25, 0.5)
      : undefined;

  const vendor = sleep?.vendorScore ?? record.vendor?.sleepScore;
  const vendorNorm = vendor === undefined ? undefined : clamp01(vendor / 100);

  const subjective =
    record.subjective?.sleepQuality === undefined
      ? undefined
      : normalize(record.subjective.sleepQuality, 1, 5);

  return buildScore([
    { key: "duration", label: "Długość snu", weight: 30, normalized: durationNorm },
    { key: "regularity", label: "Regularność pór snu", weight: 20, normalized: regularity },
    { key: "efficiency", label: "Efektywność snu", weight: 15, normalized: efficiency },
    { key: "stages", label: "Sen głęboki i REM", weight: 12, normalized: restorativeShare },
    { key: "awakenings", label: "Pobudki w nocy", weight: 8, normalized: awakenings },
    { key: "vendor", label: "Sleep Score z urządzenia", weight: 10, normalized: vendorNorm },
    { key: "subjective", label: "Odczuwana jakość snu", weight: 5, normalized: subjective },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// STRES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Indeks stresu 0–100, gdzie WYŻEJ = GORZEJ (odwrotnie niż pozostałe wyniki).
 *
 * Kluczowa różnica względem prostych aplikacji: HRV i tętno spoczynkowe są
 * oceniane względem osobistej bazy użytkownika (z-score), a nie sztywnej normy.
 * HRV 42 ms może oznaczać świetny dzień u jednej osoby i alarm u innej.
 */
export const stressIndex = (
  record: DailyRecord,
  baseline: TwinBaseline,
  profile?: UserProfile,
): ScoreResult => {
  const hrv = record.cardio?.hrvMs ?? record.sleep?.avgHrvMs;
  const hrvBase = baseline.hrvMs ?? (profile ? referenceHrv(profile.chronologicalAge) : undefined);
  const hrvSd = baseline.hrvSd && baseline.hrvSd > 0 ? baseline.hrvSd : (hrvBase ?? 40) * 0.18;
  // Spadek HRV o 1,5 SD poniżej bazy = pełne obciążenie (1.0).
  const hrvLoad =
    hrv !== undefined && hrvBase !== undefined
      ? clamp01(-zScore(hrv, hrvBase, hrvSd) / 1.5)
      : undefined;

  const rhr = record.cardio?.restingHeartRate ?? record.sleep?.avgHeartRate;
  const rhrBase = baseline.restingHeartRate ?? REFERENCE_RESTING_HR;
  const rhrSd =
    baseline.restingHeartRateSd && baseline.restingHeartRateSd > 0
      ? baseline.restingHeartRateSd
      : 4;
  const rhrLoad = rhr === undefined ? undefined : clamp01(zScore(rhr, rhrBase, rhrSd) / 2);

  const vendorStress =
    record.vendor?.stressScore === undefined ? undefined : clamp01(record.vendor.stressScore / 100);

  const notifications =
    record.lifestyle?.notifications === undefined
      ? undefined
      : normalize(record.lifestyle.notifications, 40, 250);

  const subjective =
    record.subjective?.stress === undefined
      ? undefined
      : normalize(record.subjective.stress, 1, 5);

  // Zarówno brak ruchu, jak i bardzo duże obciążenie treningowe podnoszą stres
  // fizjologiczny — dlatego to krzywa U, a nie prosta zależność.
  const mvpa = record.activity?.moderateVigorousMin;
  const activityLoad =
    mvpa === undefined
      ? undefined
      : mvpa < MVPA_TARGET_MIN_PER_DAY
        ? normalize(MVPA_TARGET_MIN_PER_DAY - mvpa, 0, MVPA_TARGET_MIN_PER_DAY) * 0.5
        : normalize(mvpa, 90, 180);

  const sleepDebt =
    record.sleep?.durationMin === undefined
      ? undefined
      : normalize((profile?.targetSleepMin ?? SLEEP_TARGET_MIN) - record.sleep.durationMin, 0, 180);

  const components: Component[] = [
    { key: "hrv", label: "HRV względem Twojej bazy", weight: 30, normalized: hrvLoad },
    { key: "vendorStress", label: "Stres z urządzenia", weight: 20, normalized: vendorStress },
    { key: "restingHr", label: "Tętno spoczynkowe", weight: 15, normalized: rhrLoad },
    { key: "subjective", label: "Odczuwany stres", weight: 15, normalized: subjective },
    { key: "sleepDebt", label: "Niedobór snu", weight: 10, normalized: sleepDebt },
    { key: "activity", label: "Obciążenie aktywnością", weight: 5, normalized: activityLoad },
    { key: "notifications", label: "Liczba powiadomień", weight: 5, normalized: notifications },
  ];

  return buildScore(components);
};

export const stressLevelFromIndex = (index: number): StressLevel => {
  if (index < 30) return "low";
  if (index < 55) return "moderate";
  if (index < 78) return "high";
  return "critical";
};

export const STRESS_LEVEL_LABEL: Record<StressLevel, string> = {
  low: "Stres niski",
  moderate: "Stres średni",
  high: "Stres wysoki",
  critical: "Stres krytyczny",
};

// ─────────────────────────────────────────────────────────────────────────────
// REGENERACJA I ENERGIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wynik regeneracji — na ile organizm jest gotowy przyjąć obciążenie.
 * Gdy dostępne są metryki producenta (Garmin Training Readiness, WHOOP
 * Recovery, Oura Readiness), mają one wysoką wagę, bo powstają z surowych
 * danych sekundowych, do których aplikacja nie ma dostępu.
 */
export const recoveryScore = (
  record: DailyRecord,
  baseline: TwinBaseline,
  sleep: ScoreResult,
  stress: ScoreResult,
): ScoreResult => {
  const readiness = record.vendor?.trainingReadiness ?? record.vendor?.readinessScore;
  const readinessNorm = readiness === undefined ? undefined : clamp01(readiness / 100);

  const bodyBattery = record.vendor?.bodyBattery;
  const batteryNorm = bodyBattery === undefined ? undefined : clamp01(bodyBattery / 100);

  const hrv = record.cardio?.hrvMs ?? record.sleep?.avgHrvMs;
  const hrvBase = baseline.hrvMs;
  const hrvSd = baseline.hrvSd && baseline.hrvSd > 0 ? baseline.hrvSd : (hrvBase ?? 40) * 0.18;
  const hrvNorm =
    hrv !== undefined && hrvBase !== undefined
      ? clamp01(0.5 + zScore(hrv, hrvBase, hrvSd) / 3)
      : undefined;

  const recoveryTime = record.vendor?.recoveryTimeH;
  const recoveryTimeNorm =
    recoveryTime === undefined ? undefined : 1 - normalize(recoveryTime, 0, 48);

  const soreness =
    record.subjective?.soreness === undefined
      ? undefined
      : 1 - normalize(record.subjective.soreness, 1, 5);

  const strain = record.vendor?.strain;
  const strainNorm = strain === undefined ? undefined : 1 - normalize(strain, 10, 20);

  return buildScore([
    { key: "readiness", label: "Gotowość z urządzenia", weight: 25, normalized: readinessNorm },
    { key: "sleep", label: "Jakość snu", weight: 22, normalized: sleep.value / 100 },
    { key: "stress", label: "Obciążenie stresem", weight: 18, normalized: 1 - stress.value / 100 },
    { key: "bodyBattery", label: "Body Battery", weight: 15, normalized: batteryNorm },
    { key: "hrv", label: "HRV względem bazy", weight: 10, normalized: hrvNorm },
    { key: "recoveryTime", label: "Pozostały czas regeneracji", weight: 5, normalized: recoveryTimeNorm },
    { key: "strain", label: "Obciążenie treningowe", weight: 3, normalized: strainNorm },
    { key: "soreness", label: "Bolesność mięśni", weight: 2, normalized: soreness },
  ]);
};

/** Wynik energii — jak dużo „paliwa” zostało na dziś. */
export const energyScore = (
  record: DailyRecord,
  sleep: ScoreResult,
  stress: ScoreResult,
  baseline: TwinBaseline,
): ScoreResult => {
  const bodyBattery = record.vendor?.bodyBattery;
  const subjective =
    record.subjective?.energy === undefined
      ? undefined
      : normalize(record.subjective.energy, 1, 5);

  const steps = record.activity?.steps;
  const stepsBase = baseline.steps ?? STEPS_TARGET_DEFAULT;
  const stepsNorm = steps === undefined ? undefined : normalize(steps, 0, stepsBase * 1.2);

  const sedentary =
    record.activity?.sedentaryMin === undefined
      ? undefined
      : 1 - normalize(record.activity.sedentaryMin, 480, 840);

  const hydration =
    record.nutrition?.waterMl === undefined
      ? undefined
      : normalize(record.nutrition.waterMl, 500, 2000);

  return buildScore([
    { key: "sleep", label: "Sen z ostatniej nocy", weight: 28, normalized: sleep.value / 100 },
    {
      key: "bodyBattery",
      label: "Body Battery",
      weight: 22,
      normalized: bodyBattery === undefined ? undefined : clamp01(bodyBattery / 100),
    },
    { key: "stress", label: "Poziom stresu", weight: 18, normalized: 1 - stress.value / 100 },
    { key: "subjective", label: "Odczuwana energia", weight: 14, normalized: subjective },
    { key: "movement", label: "Ruch w ciągu dnia", weight: 8, normalized: stepsNorm },
    { key: "sedentary", label: "Czas siedzenia", weight: 5, normalized: sedentary },
    { key: "hydration", label: "Nawodnienie", weight: 5, normalized: hydration },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// MÓZG, UKŁAD KRĄŻENIA, METABOLIZM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Brain Recovery Score — regeneracja poznawcza. Opiera się na tym, co realnie
 * wpływa na klirens glimfatyczny i konsolidację pamięci: sen głęboki i REM,
 * ekspozycja na ekran przed snem, obciążenie uwagi i praktyki uważności.
 */
export const brainRecoveryScore = (record: DailyRecord, sleep: ScoreResult): ScoreResult => {
  const stages = record.sleep?.stages;
  const duration = record.sleep?.durationMin;

  const deepNorm =
    stages?.deepMin !== undefined && duration
      ? normalize(stages.deepMin / duration, 0.08, 0.22)
      : undefined;
  const remNorm =
    stages?.remMin !== undefined && duration
      ? normalize(stages.remMin / duration, 0.13, 0.27)
      : undefined;

  const screen =
    record.lifestyle?.screenBeforeBedMin === undefined
      ? undefined
      : 1 - normalize(record.lifestyle.screenBeforeBedMin, 0, 60);

  const mindfulness = (() => {
    const m = (record.lifestyle?.meditationMin ?? 0) + (record.lifestyle?.breathworkMin ?? 0);
    if (record.lifestyle?.meditationMin === undefined && record.lifestyle?.breathworkMin === undefined) {
      return undefined;
    }
    return normalize(m, 0, 20);
  })();

  const focus =
    record.subjective?.focus === undefined ? undefined : normalize(record.subjective.focus, 1, 5);

  const attentionLoad = invert(
    record.lifestyle?.notifications === undefined
      ? undefined
      : normalize(record.lifestyle.notifications, 40, 250),
  );

  const outdoor =
    record.lifestyle?.outdoorMin === undefined
      ? undefined
      : normalize(record.lifestyle.outdoorMin, 0, 60);

  return buildScore([
    { key: "sleepQuality", label: "Jakość snu", weight: 25, normalized: sleep.value / 100 },
    { key: "deep", label: "Sen głęboki", weight: 15, normalized: deepNorm },
    { key: "rem", label: "Sen REM", weight: 15, normalized: remNorm },
    { key: "screen", label: "Ekran przed snem", weight: 12, normalized: screen },
    { key: "mindfulness", label: "Medytacja i oddech", weight: 12, normalized: mindfulness },
    { key: "focus", label: "Odczuwana koncentracja", weight: 10, normalized: focus },
    { key: "attention", label: "Obciążenie uwagi", weight: 6, normalized: attentionLoad },
    { key: "outdoor", label: "Czas na zewnątrz", weight: 5, normalized: outdoor },
  ]);
};

/** Wynik sercowo-naczyniowy oparty na wydolności, tętnie i nawykach. */
export const cardiovascularScore = (
  record: DailyRecord,
  profile: UserProfile,
  baseline: TwinBaseline,
): ScoreResult => {
  const vo2 = record.cardio?.vo2Max;
  const vo2Norm =
    vo2 === undefined ? undefined : vo2Normalized(vo2, profile.chronologicalAge, profile.sex);

  const rhr = record.cardio?.restingHeartRate ?? baseline.restingHeartRate;
  const rhrNorm = rhr === undefined ? undefined : 1 - normalize(rhr, 48, 80);

  const hrv = record.cardio?.hrvMs ?? baseline.hrvMs;
  const hrvNorm =
    hrv === undefined
      ? undefined
      : normalize(hrv, referenceHrv(profile.chronologicalAge) * 0.5, referenceHrv(profile.chronologicalAge) * 1.4);

  const mvpa =
    record.activity?.moderateVigorousMin === undefined
      ? undefined
      : normalize(record.activity.moderateVigorousMin, 0, MVPA_TARGET_MIN_PER_DAY * 2);

  const smoking =
    profile.smokingStatus === "current"
      ? 0
      : profile.smokingStatus === "former"
        ? clamp01(0.6 + (profile.yearsSinceQuit ?? 0) / 25)
        : 1;

  const bp =
    record.cardio?.systolic !== undefined && record.cardio?.diastolic !== undefined
      ? (plateau(record.cardio.systolic, 90, 105, 125, 160) +
          plateau(record.cardio.diastolic, 55, 65, 80, 100)) /
        2
      : undefined;

  const spo2 =
    record.cardio?.spo2 === undefined ? undefined : normalize(record.cardio.spo2, 90, 97);

  return buildScore([
    { key: "vo2", label: "VO₂max względem normy wiekowej", weight: 30, normalized: vo2Norm },
    { key: "restingHr", label: "Tętno spoczynkowe", weight: 18, normalized: rhrNorm },
    { key: "mvpa", label: "Aktywność umiarkowana i intensywna", weight: 16, normalized: mvpa },
    { key: "hrv", label: "HRV", weight: 14, normalized: hrvNorm },
    { key: "smoking", label: "Status palenia", weight: 12, normalized: smoking },
    { key: "bloodPressure", label: "Ciśnienie krwi", weight: 6, normalized: bp },
    { key: "spo2", label: "Saturacja", weight: 4, normalized: spo2 },
  ]);
};

/** Wynik metaboliczny — skład ciała, jakość diety i wzorzec ruchu. */
export const metabolicScore = (record: DailyRecord, profile: UserProfile): ScoreResult => {
  const weight = record.body?.weightKg ?? profile.weightKg;
  const height = record.body?.heightCm ?? profile.heightCm;
  const bmiValue = weight && height ? bmi(weight, height) : undefined;
  const bmiNorm =
    bmiValue === undefined ? undefined : plateau(bmiValue, 15, BMI_OPTIMAL_LOW, BMI_OPTIMAL_HIGH, 38);

  const waistNorm = (() => {
    const waist = record.body?.waistCm;
    if (waist === undefined) return undefined;
    const limit = profile.sex === "female" ? 80 : 94;
    return 1 - normalize(waist, limit - 10, limit + 20);
  })();

  const nutrition = record.nutrition;
  const fiberNorm =
    nutrition?.fiberG === undefined ? undefined : normalize(nutrition.fiberG, 8, FIBER_TARGET_G);
  const sugarNorm =
    nutrition?.addedSugarG === undefined
      ? undefined
      : 1 - normalize(nutrition.addedSugarG, ADDED_SUGAR_LIMIT_G * 0.4, ADDED_SUGAR_LIMIT_G * 3);
  const proteinNorm =
    nutrition?.proteinG === undefined || !weight
      ? undefined
      : plateau(nutrition.proteinG / weight, 0.4, PROTEIN_G_PER_KG, PROTEIN_G_PER_KG * 1.8, 3);
  const vegNorm =
    nutrition?.vegetableServings === undefined
      ? undefined
      : normalize(nutrition.vegetableServings, 0, VEGETABLE_SERVINGS_TARGET);
  const upfNorm =
    nutrition?.ultraProcessedMeals === undefined
      ? undefined
      : 1 - normalize(nutrition.ultraProcessedMeals, 0, 3);
  const alcoholNorm =
    nutrition?.alcoholUnits === undefined ? undefined : 1 - normalize(nutrition.alcoholUnits, 0, 4);

  const steps =
    record.activity?.steps === undefined
      ? undefined
      : normalize(record.activity.steps, 2000, profile.targetSteps ?? STEPS_TARGET_DEFAULT);
  const sedentary =
    record.activity?.sedentaryMin === undefined
      ? undefined
      : 1 - normalize(record.activity.sedentaryMin, 420, 840);

  // Późny posiłek pogarsza glikemię nocną — liczymy odstęp od pory snu.
  const mealTiming = (() => {
    const lastMeal = nutrition?.lastMealMinOfDay;
    const bedtime = record.sleep?.bedtimeMinOfDay;
    if (lastMeal === undefined || bedtime === undefined) return undefined;
    const gap = bedtime >= lastMeal ? bedtime - lastMeal : bedtime + 1440 - lastMeal;
    return normalize(gap, 60, 180);
  })();

  return buildScore([
    { key: "bmi", label: "BMI", weight: 18, normalized: bmiNorm },
    { key: "fiber", label: "Błonnik", weight: 13, normalized: fiberNorm },
    { key: "sugar", label: "Cukry dodane", weight: 13, normalized: sugarNorm },
    { key: "steps", label: "Kroki", weight: 12, normalized: steps },
    { key: "protein", label: "Białko", weight: 10, normalized: proteinNorm },
    { key: "vegetables", label: "Warzywa", weight: 10, normalized: vegNorm },
    { key: "sedentary", label: "Czas siedzenia", weight: 8, normalized: sedentary },
    { key: "upf", label: "Żywność wysokoprzetworzona", weight: 6, normalized: upfNorm },
    { key: "alcohol", label: "Alkohol", weight: 5, normalized: alcoholNorm },
    { key: "waist", label: "Obwód talii", weight: 3, normalized: waistNorm },
    { key: "mealTiming", label: "Pora ostatniego posiłku", weight: 2, normalized: mealTiming },
  ]);
};

/**
 * Longevity Index — jeden wskaźnik zbiorczy pokazywany na dashboardzie.
 * To ważona kompozycja pozostałych wyników; celowo daje największą wagę
 * wydolności krążeniowej i snu, bo mają najsilniejsze poparcie w danych
 * epidemiologicznych dotyczących długości życia w zdrowiu.
 */
export const longevityIndex = (parts: {
  sleep: ScoreResult;
  stress: ScoreResult;
  recovery: ScoreResult;
  cardiovascular: ScoreResult;
  metabolic: ScoreResult;
  brain: ScoreResult;
  epigenetic: number;
}): ScoreResult =>
  buildScore([
    {
      key: "cardiovascular",
      label: "Układ krążenia",
      weight: 25,
      normalized: parts.cardiovascular.inputsUsed ? parts.cardiovascular.value / 100 : undefined,
    },
    {
      key: "sleep",
      label: "Sen",
      weight: 20,
      normalized: parts.sleep.inputsUsed ? parts.sleep.value / 100 : undefined,
    },
    {
      key: "metabolic",
      label: "Metabolizm",
      weight: 18,
      normalized: parts.metabolic.inputsUsed ? parts.metabolic.value / 100 : undefined,
    },
    {
      key: "stress",
      label: "Stres i regulacja",
      weight: 15,
      normalized: parts.stress.inputsUsed ? 1 - parts.stress.value / 100 : undefined,
    },
    {
      key: "epigenetic",
      label: "Nawyki dnia",
      weight: 10,
      normalized: parts.epigenetic / 100,
    },
    {
      key: "recovery",
      label: "Regeneracja",
      weight: 7,
      normalized: parts.recovery.inputsUsed ? parts.recovery.value / 100 : undefined,
    },
    {
      key: "brain",
      label: "Regeneracja mózgu",
      weight: 5,
      normalized: parts.brain.inputsUsed ? parts.brain.value / 100 : undefined,
    },
  ]);

/** Etykieta słowna dla wyniku 0–100 — używana w kafelkach i w raportach AI. */
export const scoreBand = (value: number): { key: string; label: string } => {
  if (value >= 85) return { key: "excellent", label: "Doskonały" };
  if (value >= 70) return { key: "good", label: "Dobry" };
  if (value >= 55) return { key: "fair", label: "Przeciętny" };
  if (value >= 40) return { key: "low", label: "Niski" };
  return { key: "critical", label: "Bardzo niski" };
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Wysoka pewność danych",
  medium: "Średnia pewność danych",
  low: "Niska pewność — uzupełnij dane",
};
