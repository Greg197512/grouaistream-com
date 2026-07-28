/**
 * Moduł diety: cele dzienne, ocena realizacji i konkretne poprawki.
 *
 * Cele liczone są z profilu (masa, wzrost, wiek, płeć) i z realnej aktywności
 * danego dnia — kalorie po treningu biegowym są inne niż w dniu przy biurku.
 * Podpowiedzi są konkretne („dołóż 25 g białka: 150 g twarogu albo 4 jajka”),
 * bo ogólniki w rodzaju „jedz zdrowiej” nie zmieniają zachowania.
 *
 * To wskazówki żywieniowe dla osób zdrowych, nie plan dietetyczny ani element
 * leczenia. Przy chorobach przewlekłych, ciąży lub diecie eliminacyjnej
 * decyduje zalecenie lekarza lub dietetyka.
 */

import type { DailyRecord, Micronutrient, UserProfile } from "./types";
import { clamp01, round } from "./math";
import {
  ADDED_SUGAR_LIMIT_G,
  FIBER_TARGET_G,
  PROTEIN_G_PER_KG,
  VEGETABLE_SERVINGS_TARGET,
  WATER_TARGET_ML_DEFAULT,
} from "./norms";

export interface NutritionTargets {
  kcal: number;
  proteinG: number;
  fiberG: number;
  addedSugarMaxG: number;
  waterMl: number;
  vegetableServings: number;
  fruitServings: number;
}

/**
 * Podstawowa przemiana materii wg równania Mifflina–St Jeora — standard
 * stosowany w praktyce dietetycznej dla osób bez pomiaru kalorymetrycznego.
 */
export const basalMetabolicRate = (profile: UserProfile, weightKg: number): number => {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.chronologicalAge;
  if (profile.sex === "female") return round(base - 161);
  if (profile.sex === "male") return round(base + 5);
  return round(base - 78); // średnia obu wariantów
};

/** Współczynnik aktywności wyliczony z realnych kroków i minut wysiłku. */
const activityFactor = (record: DailyRecord): number => {
  const steps = record.activity?.steps ?? 0;
  const mvpa = record.activity?.moderateVigorousMin ?? 0;
  const base = 1.2 + clamp01(steps / 12_000) * 0.35 + clamp01(mvpa / 90) * 0.25;
  return round(base, 2);
};

export const computeTargets = (profile: UserProfile, record: DailyRecord): NutritionTargets => {
  const weight = record.body?.weightKg ?? profile.weightKg ?? 70;
  const bmr = basalMetabolicRate(profile, weight);
  const kcal = round(bmr * activityFactor(record));

  return {
    kcal,
    proteinG: round(weight * PROTEIN_G_PER_KG),
    fiberG: FIBER_TARGET_G,
    addedSugarMaxG: ADDED_SUGAR_LIMIT_G,
    waterMl: profile.targetWaterMl ?? Math.max(WATER_TARGET_ML_DEFAULT, round(weight * 30)),
    vegetableServings: VEGETABLE_SERVINGS_TARGET,
    fruitServings: 2,
  };
};

/** Dzienne wartości referencyjne mikroskładników dla dorosłych. */
export const MICRONUTRIENT_RDA: Record<Micronutrient, { amount: number; unit: string; label: string }> = {
  vitaminD: { amount: 20, unit: "µg", label: "Witamina D" },
  vitaminB12: { amount: 2.4, unit: "µg", label: "Witamina B12" },
  magnesium: { amount: 375, unit: "mg", label: "Magnez" },
  omega3: { amount: 250, unit: "mg", label: "Omega-3 (EPA+DHA)" },
  iron: { amount: 14, unit: "mg", label: "Żelazo" },
  zinc: { amount: 10, unit: "mg", label: "Cynk" },
  potassium: { amount: 3500, unit: "mg", label: "Potas" },
  calcium: { amount: 1000, unit: "mg", label: "Wapń" },
  folate: { amount: 400, unit: "µg", label: "Kwas foliowy" },
};

/** Praktyczne źródła — używane w podpowiedziach, żeby rada była wykonalna. */
const PROTEIN_SOURCES = [
  { name: "150 g twarogu półtłustego", grams: 27 },
  { name: "4 jajka", grams: 25 },
  { name: "120 g piersi z kurczaka", grams: 28 },
  { name: "150 g soczewicy po ugotowaniu", grams: 13 },
  { name: "200 g jogurtu skyr", grams: 22 },
  { name: "100 g tofu wędzonego", grams: 16 },
];

const FIBER_SOURCES = [
  { name: "40 g płatków owsianych", grams: 4 },
  { name: "150 g malin", grams: 10 },
  { name: "200 g brokułów", grams: 5 },
  { name: "100 g ciecierzycy po ugotowaniu", grams: 7 },
  { name: "2 kromki chleba żytniego razowego", grams: 6 },
  { name: "30 g nasion chia", grams: 10 },
];

export interface NutritionGap {
  key: string;
  label: string;
  actual: number;
  target: number;
  unit: string;
  /** 0–1; 1 = cel osiągnięty. */
  progress: number;
  /** Kierunek: czy trzeba zwiększyć, czy ograniczyć. */
  direction: "increase" | "limit";
  status: "ok" | "warn" | "off";
}

export interface NutritionAnalysis {
  targets: NutritionTargets;
  gaps: NutritionGap[];
  /** Konkretne rekomendacje, posortowane wg wagi. */
  suggestions: string[];
  /** Ocena jakości diety 0–100 dla tego dnia. */
  qualityScore: number;
  micronutrientGaps: Array<{ key: Micronutrient; label: string; pct: number; unit: string }>;
}

const statusFor = (progress: number, direction: "increase" | "limit"): "ok" | "warn" | "off" => {
  if (direction === "increase") {
    if (progress >= 0.9) return "ok";
    if (progress >= 0.6) return "warn";
    return "off";
  }
  if (progress >= 0.9) return "ok";
  if (progress >= 0.5) return "warn";
  return "off";
};

export const analyzeNutrition = (record: DailyRecord, profile: UserProfile): NutritionAnalysis => {
  const targets = computeTargets(profile, record);
  const n = record.nutrition ?? {};
  const gaps: NutritionGap[] = [];

  const push = (
    key: string,
    label: string,
    actual: number | undefined,
    target: number,
    unit: string,
    direction: "increase" | "limit",
  ) => {
    if (actual === undefined) return;
    const progress =
      direction === "increase"
        ? clamp01(actual / target)
        : target === 0
          ? actual === 0
            ? 1
            : 0
          : clamp01(1 - Math.max(0, actual - target) / target);
    gaps.push({
      key,
      label,
      actual: round(actual, 1),
      target: round(target, 1),
      unit,
      progress: round(progress, 3),
      direction,
      status: statusFor(progress, direction),
    });
  };

  push("protein", "Białko", n.proteinG, targets.proteinG, "g", "increase");
  push("fiber", "Błonnik", n.fiberG, targets.fiberG, "g", "increase");
  push("water", "Woda", n.waterMl, targets.waterMl, "ml", "increase");
  push("vegetables", "Warzywa", n.vegetableServings, targets.vegetableServings, "porcji", "increase");
  push("fruit", "Owoce", n.fruitServings, targets.fruitServings, "porcji", "increase");
  push("sugar", "Cukry dodane", n.addedSugarG, targets.addedSugarMaxG, "g", "limit");
  push("kcal", "Kalorie", n.kcal, targets.kcal, "kcal", "increase");
  push("alcohol", "Alkohol", n.alcoholUnits, 0, "jedn.", "limit");
  push("upf", "Posiłki wysokoprzetworzone", n.ultraProcessedMeals, 0, "szt.", "limit");

  // ── Podpowiedzi ────────────────────────────────────────────────────────────
  const suggestions: string[] = [];

  const proteinGap = targets.proteinG - (n.proteinG ?? targets.proteinG);
  if (proteinGap > 10) {
    const source = PROTEIN_SOURCES.reduce((best, s) =>
      Math.abs(s.grams - proteinGap) < Math.abs(best.grams - proteinGap) ? s : best,
    );
    suggestions.push(
      `Brakuje ${Math.round(proteinGap)} g białka. Najprościej dołożyć ${source.name} (${source.grams} g białka).`,
    );
  }

  const fiberGap = targets.fiberG - (n.fiberG ?? targets.fiberG);
  if (fiberGap > 5) {
    const source = FIBER_SOURCES.reduce((best, s) =>
      Math.abs(s.grams - fiberGap) < Math.abs(best.grams - fiberGap) ? s : best,
    );
    suggestions.push(`Do celu błonnika brakuje ${Math.round(fiberGap)} g — na przykład ${source.name}.`);
  }

  if (n.waterMl !== undefined && n.waterMl < targets.waterMl) {
    const missing = targets.waterMl - n.waterMl;
    suggestions.push(
      `Brakuje ${Math.round(missing)} ml wody, czyli około ${Math.ceil(missing / 250)} szklanek. Ustaw je przy biurku — pijesz to, co widzisz.`,
    );
  }

  if (n.vegetableServings !== undefined && n.vegetableServings < targets.vegetableServings) {
    suggestions.push(
      `Warzywa: ${round(n.vegetableServings, 1)} z ${targets.vegetableServings} porcji. Dołóż garść do każdego posiłku — to najszybsza droga do celu.`,
    );
  }

  if (n.addedSugarG !== undefined && n.addedSugarG > targets.addedSugarMaxG) {
    suggestions.push(
      `Cukry dodane: ${Math.round(n.addedSugarG)} g przy limicie ${targets.addedSugarMaxG} g. Największe źródła to zwykle napoje i jogurty smakowe — sprawdź je w pierwszej kolejności.`,
    );
  }

  if ((n.ultraProcessedMeals ?? 0) >= 2) {
    suggestions.push(
      `${n.ultraProcessedMeals} posiłki wysokoprzetworzone. Zamiana jednego z nich na posiłek gotowany zmienia bilans błonnika i sodu bardziej niż liczenie kalorii.`,
    );
  }

  if (n.lastMealMinOfDay !== undefined && record.sleep?.bedtimeMinOfDay !== undefined) {
    const bedtime = record.sleep.bedtimeMinOfDay;
    const gap = bedtime >= n.lastMealMinOfDay ? bedtime - n.lastMealMinOfDay : bedtime + 1440 - n.lastMealMinOfDay;
    if (gap < 120) {
      suggestions.push(
        `Ostatni posiłek ${Math.round(gap)} minut przed snem. Przesunięcie go o godzinę zwykle poprawia jakość pierwszej fazy nocy.`,
      );
    }
  }

  if ((n.alcoholUnits ?? 0) > 0) {
    suggestions.push(
      "Alkohol skraca fazę REM nawet przy jednej jednostce. Jeśli planujesz drinka, wypij go co najmniej 4 godziny przed snem.",
    );
  }

  // ── Jakość diety ───────────────────────────────────────────────────────────
  const scoreParts = gaps.map((g) => g.progress);
  const qualityScore = scoreParts.length ? round((scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length) * 100) : 0;

  // ── Mikroskładniki ─────────────────────────────────────────────────────────
  const micronutrientGaps = (Object.keys(MICRONUTRIENT_RDA) as Micronutrient[])
    .map((key) => {
      const rda = MICRONUTRIENT_RDA[key];
      const actual = n.micronutrients?.[key];
      if (actual === undefined) return undefined;
      return {
        key,
        label: rda.label,
        pct: round((actual / rda.amount) * 100),
        unit: rda.unit,
      };
    })
    .filter((v): v is { key: Micronutrient; label: string; pct: number; unit: string } => v !== undefined)
    .filter((v) => v.pct < 80)
    .sort((a, b) => a.pct - b.pct);

  return { targets, gaps, suggestions, qualityScore, micronutrientGaps };
};
