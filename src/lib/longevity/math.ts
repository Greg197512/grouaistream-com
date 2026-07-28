/**
 * Wspólne funkcje numeryczne silnika Zatrzymać Starość.
 * Wszystkie są czyste (bez efektów ubocznych) i odporne na `undefined`,
 * bo dane z urządzeń bywają dziurawe.
 */

import type { Confidence, TrendPoint } from "./types";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

/** Zaokrąglenie do `digits` miejsc po przecinku (domyślnie do liczby całkowitej). */
export const round = (value: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** Liniowe przeskalowanie `value` z zakresu [from, to] na 0–1 (z obcięciem). */
export const normalize = (value: number, from: number, to: number): number => {
  if (from === to) return 0.5;
  return clamp01((value - from) / (to - from));
};

/**
 * Znormalizowana ocena „im bliżej optimum, tym lepiej”.
 * Zwraca 1 w przedziale [lowOpt, highOpt] i opada liniowo do 0 na krańcach.
 */
export const plateau = (
  value: number,
  hardLow: number,
  lowOpt: number,
  highOpt: number,
  hardHigh: number,
): number => {
  if (value >= lowOpt && value <= highOpt) return 1;
  if (value < lowOpt) return normalize(value, hardLow, lowOpt);
  return 1 - normalize(value, highOpt, hardHigh);
};

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

/** Odchylenie od bazy w jednostkach SD (z-score). Bezpieczne przy SD = 0. */
export const zScore = (value: number, baseline: number, sd: number): number => {
  if (!Number.isFinite(sd) || sd <= 0) return 0;
  return (value - baseline) / sd;
};

/** Nachylenie regresji liniowej metodą najmniejszych kwadratów (x = indeks dnia). */
export const linearSlope = (points: TrendPoint[]): number => {
  const n = points.length;
  if (n < 2) return 0;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.value);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

/**
 * Wykładnicza średnia krocząca — używana do baz „osobistej normy”,
 * bo szybciej reaguje na zmiany trybu życia niż zwykła średnia.
 */
export const ema = (values: number[], alpha = 0.2): number => {
  if (values.length === 0) return 0;
  return values.reduce((acc, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * acc), values[0]);
};

/** Średnia ważona z pominięciem składników bez danych. */
export const weightedMean = (
  entries: Array<{ value: number | undefined; weight: number }>,
): { value: number; usedWeight: number; count: number } => {
  let sum = 0;
  let usedWeight = 0;
  let count = 0;
  for (const entry of entries) {
    if (entry.value === undefined || !Number.isFinite(entry.value)) continue;
    sum += entry.value * entry.weight;
    usedWeight += entry.weight;
    count += 1;
  }
  return { value: usedWeight === 0 ? 0 : sum / usedWeight, usedWeight, count };
};

/**
 * Pewność wyniku liczona jako pokrycie danymi: ile z możliwych wag udało się
 * faktycznie wykorzystać. Progi dobrane tak, aby „high” wymagało realnie
 * kompletnego dnia z urządzenia noszonego na ciele.
 */
export const confidenceFromCoverage = (usedWeight: number, totalWeight: number): Confidence => {
  if (totalWeight <= 0) return "low";
  const coverage = usedWeight / totalWeight;
  if (coverage >= 0.75) return "high";
  if (coverage >= 0.4) return "medium";
  return "low";
};

/** Kołowa różnica czasu w minutach (obsługuje przejście przez północ). */
export const circularMinuteDiff = (a: number, b: number): number => {
  const raw = Math.abs(a - b) % 1440;
  return Math.min(raw, 1440 - raw);
};

/** Kołowa średnia z pór dnia (np. średnia godzina zaśnięcia). */
export const circularMeanMinutes = (minutes: number[]): number => {
  if (minutes.length === 0) return 0;
  let sinSum = 0;
  let cosSum = 0;
  for (const m of minutes) {
    const angle = (2 * Math.PI * (m % 1440)) / 1440;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }
  const angle = Math.atan2(sinSum / minutes.length, cosSum / minutes.length);
  const result = (angle * 1440) / (2 * Math.PI);
  return (result + 1440) % 1440;
};

/** Kołowe odchylenie standardowe pór dnia w minutach (miara regularności). */
export const circularStdMinutes = (minutes: number[]): number => {
  if (minutes.length < 2) return 0;
  const avg = circularMeanMinutes(minutes);
  const diffs = minutes.map((m) => circularMinuteDiff(m, avg));
  return Math.sqrt(mean(diffs.map((d) => d ** 2)));
};

/** `YYYY-MM-DD` z obiektu Date w czasie lokalnym (nie UTC — doba jest lokalna). */
export const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const addDays = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

export const daysBetween = (from: string, to: string): number => {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
};

/** Minuty od północy → `HH:MM` (obsługuje wartości > 1440). */
export const formatMinuteOfDay = (minutes: number): string => {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = Math.round(norm % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Minuty → `7 h 45 min`. */
export const formatDuration = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

/**
 * Deterministyczny generator pseudolosowy (mulberry32).
 * Używany tylko do danych demonstracyjnych, aby ekran startowy był
 * powtarzalny między odświeżeniami — nigdy do obliczeń zdrowotnych.
 */
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
