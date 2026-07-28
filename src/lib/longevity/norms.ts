/**
 * Wartości referencyjne używane przez silnik.
 *
 * Źródła to publiczne normy populacyjne dla zdrowych dorosłych (m.in. Cooper
 * Institute dla VO₂max, rekomendacje WHO dla aktywności, konsensus AASM dla
 * długości snu). Silnik używa ich WYŁĄCZNIE do skalowania wyników stylu życia
 * — nie służą do oceny stanu zdrowia ani do wykrywania chorób.
 */

import type { Sex } from "./types";
import { clamp, normalize } from "./math";

/** Rekomendowana długość snu dla dorosłych (min). */
export const SLEEP_TARGET_MIN = 450; // 7 h 30 min
export const SLEEP_MIN_ACCEPTABLE = 420; // 7 h
export const SLEEP_MAX_ACCEPTABLE = 540; // 9 h

/** WHO: 150 min aktywności umiarkowanej tygodniowo ≈ 21 min dziennie. */
export const MVPA_TARGET_MIN_PER_DAY = 22;

export const STEPS_TARGET_DEFAULT = 8000;
export const WATER_TARGET_ML_DEFAULT = 2000;
export const PROTEIN_G_PER_KG = 1.2;
export const FIBER_TARGET_G = 30;
export const VEGETABLE_SERVINGS_TARGET = 5;
export const ADDED_SUGAR_LIMIT_G = 25;

/** Powyżej tylu jednostek alkoholu tygodniowo rośnie ryzyko wg wytycznych. */
export const ALCOHOL_WEEKLY_LOW_RISK_UNITS = 7;

/**
 * Normy VO₂max (ml/kg/min) — wartość „dobra” (≈ 60. centyl) dla wieku i płci.
 * Interpolujemy liniowo między punktami wiekowymi.
 */
const VO2_REFERENCE: Record<"female" | "male", Array<{ age: number; good: number }>> = {
  male: [
    { age: 25, good: 46 },
    { age: 35, good: 43 },
    { age: 45, good: 39 },
    { age: 55, good: 35 },
    { age: 65, good: 31 },
    { age: 75, good: 27 },
  ],
  female: [
    { age: 25, good: 39 },
    { age: 35, good: 36 },
    { age: 45, good: 33 },
    { age: 55, good: 30 },
    { age: 65, good: 26 },
    { age: 75, good: 23 },
  ],
};

/** Referencyjne (dobre) VO₂max dla danego wieku i płci. */
export const referenceVo2Max = (age: number, sex: Sex): number => {
  const table = VO2_REFERENCE[sex === "female" ? "female" : "male"];
  const a = clamp(age, table[0].age, table[table.length - 1].age);
  for (let i = 0; i < table.length - 1; i += 1) {
    const lo = table[i];
    const hi = table[i + 1];
    if (a >= lo.age && a <= hi.age) {
      const t = (a - lo.age) / (hi.age - lo.age);
      return lo.good + t * (hi.good - lo.good);
    }
  }
  return table[table.length - 1].good;
};

/**
 * Referencyjne HRV (RMSSD, ms) — mediana maleje z wiekiem.
 * HRV jest silnie osobnicze, więc silnik zawsze preferuje bazę użytkownika,
 * a tej normy używa tylko przy zimnym starcie (mniej niż 7 dni danych).
 */
export const referenceHrv = (age: number): number => clamp(66 - 0.62 * (age - 20), 18, 80);

/** Referencyjne tętno spoczynkowe — środek zdrowego zakresu dla dorosłych. */
export const REFERENCE_RESTING_HR = 60;

/** Zakresy BMI używane do skalowania wyniku metabolicznego. */
export const BMI_OPTIMAL_LOW = 20;
export const BMI_OPTIMAL_HIGH = 25;

export const bmi = (weightKg: number, heightCm: number): number => {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
};

/**
 * Ocena VO₂max względem normy wiekowej: 0 = bardzo niska, 1 = wybitna.
 * 0,5 odpowiada dokładnie wartości referencyjnej „dobrej”.
 */
export const vo2Normalized = (vo2: number, age: number, sex: Sex): number => {
  const ref = referenceVo2Max(age, sex);
  return normalize(vo2, ref * 0.65, ref * 1.3);
};

/** Kategorie stresu Garmin All-Day Stress (0–100). */
export const GARMIN_STRESS_BANDS = {
  rest: [0, 25],
  low: [26, 50],
  medium: [51, 75],
  high: [76, 100],
} as const;

/**
 * Przeliczenie tygodniowej liczby jednostek alkoholu na ryzyko 0–1
 * (0 = abstynencja lub sporadycznie, 1 = spożycie wysokiego ryzyka).
 */
export const alcoholRisk = (weeklyUnits: number): number =>
  normalize(weeklyUnits, 0, ALCOHOL_WEEKLY_LOW_RISK_UNITS * 3);
