/**
 * Epigenetic Lifestyle Score — 100 punktów dziennie.
 *
 * ⚠️ Nazwa opisuje kategorię nawyków, o których wiadomo, że wpływają na
 * ekspresję genów i procesy starzenia (sen, ruch, dieta roślinna, regulacja
 * stresu, używki). To NIE jest pomiar metylacji DNA ani żaden test
 * laboratoryjny — punkty przyznajemy wyłącznie za zarejestrowane zachowania.
 *
 * Każda kategoria ma sufit punktowy i przyznaje punkty proporcjonalnie do
 * postępu, żeby dzień „prawie udany” nie wyglądał jak dzień zmarnowany.
 */

import type { DailyRecord, EpigeneticAward, EpigeneticResult, EpigeneticRule, UserProfile } from "./types";
import { clamp01, confidenceFromCoverage, formatDuration, round } from "./math";
import {
  MVPA_TARGET_MIN_PER_DAY,
  SLEEP_MAX_ACCEPTABLE,
  SLEEP_MIN_ACCEPTABLE,
  STEPS_TARGET_DEFAULT,
  VEGETABLE_SERVINGS_TARGET,
  WATER_TARGET_ML_DEFAULT,
} from "./norms";

export const EPIGENETIC_RULES: EpigeneticRule[] = [
  { key: "sleep", label: "Sen", maxPoints: 20, target: "7–9 godzin snu" },
  { key: "vegetables", label: "Warzywa", maxPoints: 15, target: "5 porcji warzyw" },
  { key: "exercise", label: "Aktywność", maxPoints: 15, target: "22 min ruchu intensywnego lub 8000 kroków" },
  { key: "meditation", label: "Medytacja", maxPoints: 10, target: "10 minut praktyki" },
  { key: "walk", label: "Spacer", maxPoints: 10, target: "30 minut spaceru na zewnątrz" },
  { key: "hydration", label: "Nawodnienie", maxPoints: 10, target: "2 litry wody" },
  { key: "alcohol", label: "Bez alkoholu", maxPoints: 10, target: "0 jednostek alkoholu" },
  { key: "nicotine", label: "Bez nikotyny", maxPoints: 5, target: "0 papierosów" },
  { key: "screen", label: "Wieczór bez ekranu", maxPoints: 5, target: "Bez ekranu godzinę przed snem" },
];

/** Suma sufitów — pilnowana testem, żeby nigdy nie rozjechała się ze 100. */
export const EPIGENETIC_MAX_POINTS = EPIGENETIC_RULES.reduce((acc, r) => acc + r.maxPoints, 0);

interface Evaluation {
  ratio: number | undefined;
  detail: string;
}

export const calculateEpigeneticScore = (
  record: DailyRecord,
  profile?: UserProfile,
): EpigeneticResult => {
  const targetSteps = profile?.targetSteps ?? STEPS_TARGET_DEFAULT;
  const targetWater = profile?.targetWaterMl ?? WATER_TARGET_ML_DEFAULT;

  const evaluate = (key: string): Evaluation => {
    switch (key) {
      case "sleep": {
        const min = record.sleep?.durationMin;
        if (min === undefined) return { ratio: undefined, detail: "Brak danych o śnie" };
        // Pełna pula w oknie 7–9 h; poniżej proporcjonalnie, powyżej lekka korekta.
        if (min >= SLEEP_MIN_ACCEPTABLE && min <= SLEEP_MAX_ACCEPTABLE) {
          return { ratio: 1, detail: formatDuration(min) };
        }
        const ratio =
          min < SLEEP_MIN_ACCEPTABLE
            ? clamp01(min / SLEEP_MIN_ACCEPTABLE)
            : clamp01(1 - (min - SLEEP_MAX_ACCEPTABLE) / 180);
        return { ratio, detail: formatDuration(min) };
      }
      case "vegetables": {
        const servings = record.nutrition?.vegetableServings;
        if (servings === undefined) return { ratio: undefined, detail: "Brak wpisu" };
        return {
          ratio: clamp01(servings / VEGETABLE_SERVINGS_TARGET),
          detail: `${round(servings, 1)} z ${VEGETABLE_SERVINGS_TARGET} porcji`,
        };
      }
      case "exercise": {
        const mvpa = record.activity?.moderateVigorousMin;
        const steps = record.activity?.steps;
        if (mvpa === undefined && steps === undefined) return { ratio: undefined, detail: "Brak danych o ruchu" };
        const byMvpa = mvpa === undefined ? 0 : clamp01(mvpa / MVPA_TARGET_MIN_PER_DAY);
        const bySteps = steps === undefined ? 0 : clamp01(steps / targetSteps);
        const ratio = Math.max(byMvpa, bySteps);
        const detail =
          steps !== undefined ? `${Math.round(steps)} kroków` : `${Math.round(mvpa ?? 0)} min ruchu`;
        return { ratio, detail };
      }
      case "meditation": {
        const meditation = record.lifestyle?.meditationMin;
        const breath = record.lifestyle?.breathworkMin;
        if (meditation === undefined && breath === undefined) return { ratio: undefined, detail: "Brak sesji" };
        const total = (meditation ?? 0) + (breath ?? 0);
        return { ratio: clamp01(total / 10), detail: `${Math.round(total)} min` };
      }
      case "walk": {
        const walk = record.activity?.walkMin ?? record.lifestyle?.outdoorMin;
        if (walk === undefined) return { ratio: undefined, detail: "Brak danych" };
        return { ratio: clamp01(walk / 30), detail: `${Math.round(walk)} min` };
      }
      case "hydration": {
        const water = record.nutrition?.waterMl;
        if (water === undefined) return { ratio: undefined, detail: "Brak wpisu" };
        return { ratio: clamp01(water / targetWater), detail: `${(water / 1000).toFixed(1)} l` };
      }
      case "alcohol": {
        const units = record.nutrition?.alcoholUnits;
        if (units === undefined) return { ratio: undefined, detail: "Brak wpisu" };
        return {
          ratio: units === 0 ? 1 : clamp01(1 - units / 3),
          detail: units === 0 ? "Bez alkoholu" : `${round(units, 1)} jednostki`,
        };
      }
      case "nicotine": {
        const cigarettes = record.lifestyle?.cigarettes;
        const status = record.lifestyle?.smokingStatus ?? profile?.smokingStatus;
        if (cigarettes === undefined && status === undefined) return { ratio: undefined, detail: "Brak wpisu" };
        if (cigarettes !== undefined) {
          return {
            ratio: cigarettes === 0 ? 1 : clamp01(1 - cigarettes / 10),
            detail: cigarettes === 0 ? "Bez nikotyny" : `${cigarettes} szt.`,
          };
        }
        return { ratio: status === "current" ? 0 : 1, detail: status === "current" ? "Palenie" : "Bez nikotyny" };
      }
      case "screen": {
        const screen = record.lifestyle?.screenBeforeBedMin;
        if (screen === undefined) return { ratio: undefined, detail: "Brak wpisu" };
        return {
          ratio: clamp01(1 - screen / 60),
          detail: screen === 0 ? "Wieczór bez ekranu" : `${Math.round(screen)} min ekranu`,
        };
      }
      default:
        return { ratio: undefined, detail: "" };
    }
  };

  const awards: EpigeneticAward[] = EPIGENETIC_RULES.map((rule) => {
    const { ratio, detail } = evaluate(rule.key);
    const points = ratio === undefined ? 0 : round(ratio * rule.maxPoints, 1);
    return {
      key: rule.key,
      label: rule.label,
      points,
      maxPoints: rule.maxPoints,
      complete: ratio !== undefined && ratio >= 0.999,
      detail,
    };
  });

  const usedWeight = EPIGENETIC_RULES.filter((rule) => evaluate(rule.key).ratio !== undefined).reduce(
    (acc, rule) => acc + rule.maxPoints,
    0,
  );

  const value = round(
    awards.reduce((acc, a) => acc + a.points, 0),
  );

  return {
    value: Math.min(value, EPIGENETIC_MAX_POINTS),
    awards,
    confidence: confidenceFromCoverage(usedWeight, EPIGENETIC_MAX_POINTS),
  };
};
