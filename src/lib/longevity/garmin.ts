/**
 * Warstwa Garmin AI — priorytetowa integracja produktu.
 *
 * Garmin udostępnia metryki, których nie da się odtworzyć z surowego tętna
 * (Body Battery, Training Readiness, HRV Status, Recovery Time, Endurance
 * i Hill Score). Ten moduł zamienia je w jedną decyzję na dziś: ile obciążenia
 * organizm uniesie i co zrobić w pierwszej kolejności.
 *
 * Wszystkie progi pochodzą z publicznej dokumentacji Garmin Connect
 * (pasma Body Battery, klasy HRV Status). Interpretacja jest wskazówką
 * treningową opartą na danych, nie oceną medyczną.
 */

import type { DailyRecord, TwinBaseline } from "./types";
import { clamp01, mean, normalize, round } from "./math";

export type TrainingRecommendation =
  | "hard"
  | "moderate"
  | "easy"
  | "recovery"
  | "rest";

export const TRAINING_LABEL: Record<TrainingRecommendation, string> = {
  hard: "Trening intensywny",
  moderate: "Trening umiarkowany",
  easy: "Lekki wysiłek",
  recovery: "Aktywna regeneracja",
  rest: "Dzień bez treningu",
};

export interface GarminInsight {
  /** Czy w rekordzie są jakiekolwiek metryki Garmin. */
  available: boolean;
  bodyBattery?: number;
  bodyBatteryBand?: "critical" | "low" | "moderate" | "high";
  trainingReadiness?: number;
  readinessBand?: "poor" | "low" | "moderate" | "high" | "prime";
  hrvStatus?: string;
  hrvDeltaPct?: number;
  stressScore?: number;
  recoveryTimeH?: number;
  vo2Max?: number;
  enduranceScore?: number;
  hillScore?: number;
  recommendation: TrainingRecommendation;
  /** Gotowe zdania do „Morning Report” — każde oparte na konkretnej liczbie. */
  bullets: string[];
  /** Priorytety na dziś, w kolejności ważności. */
  priorities: string[];
}

const bodyBatteryBand = (value: number): "critical" | "low" | "moderate" | "high" => {
  if (value <= 25) return "critical";
  if (value <= 50) return "low";
  if (value <= 75) return "moderate";
  return "high";
};

const readinessBand = (value: number): "poor" | "low" | "moderate" | "high" | "prime" => {
  if (value <= 24) return "poor";
  if (value <= 49) return "low";
  if (value <= 69) return "moderate";
  if (value <= 89) return "high";
  return "prime";
};

const HRV_STATUS_LABEL: Record<string, string> = {
  balanced: "zrównoważone",
  unbalanced: "niezrównoważone",
  low: "niskie",
  poor: "bardzo niskie",
  no_status: "bez statusu",
};

/**
 * Buduje rekomendację treningową. Logika jest celowo zachowawcza:
 * pojedynczy zły sygnał obniża zalecenie o stopień, dwa sygnały krytyczne
 * prowadzą do dnia bez treningu.
 */
const recommendTraining = (insight: {
  bodyBattery?: number;
  trainingReadiness?: number;
  recoveryTimeH?: number;
  stressScore?: number;
  hrvStatus?: string;
  hrvDeltaPct?: number;
}): TrainingRecommendation => {
  const ladder: TrainingRecommendation[] = ["hard", "moderate", "easy", "recovery", "rest"];
  let step = 0;

  const readiness = insight.trainingReadiness;
  if (readiness !== undefined) {
    if (readiness >= 80) step += 0;
    else if (readiness >= 60) step += 1;
    else if (readiness >= 40) step += 2;
    else if (readiness >= 25) step += 3;
    else step += 4;
  } else {
    step += 1; // brak danych → nie zalecamy maksymalnego obciążenia
  }

  const battery = insight.bodyBattery;
  if (battery !== undefined) {
    if (battery <= 25) step += 2;
    else if (battery <= 40) step += 1;
    else if (battery >= 75) step -= 1;
  }

  if (insight.recoveryTimeH !== undefined && insight.recoveryTimeH >= 24) step += 1;
  if (insight.stressScore !== undefined && insight.stressScore >= 70) step += 1;
  if (insight.hrvStatus === "low" || insight.hrvStatus === "poor") step += 2;
  else if (insight.hrvStatus === "unbalanced") step += 1;
  else if (insight.hrvStatus === "balanced") step -= 1;
  if (insight.hrvDeltaPct !== undefined && insight.hrvDeltaPct <= -15) step += 1;

  return ladder[Math.min(Math.max(step, 0), ladder.length - 1)];
};

export const buildGarminInsight = (
  record: DailyRecord,
  history: DailyRecord[],
  baseline: TwinBaseline,
): GarminInsight => {
  const v = record.vendor;
  const bullets: string[] = [];
  const priorities: string[] = [];

  const hrv = record.cardio?.hrvMs ?? record.sleep?.avgHrvMs;
  const hrvDeltaPct =
    hrv !== undefined && baseline.hrvMs ? round(((hrv - baseline.hrvMs) / baseline.hrvMs) * 100, 1) : undefined;

  const available = Boolean(
    v &&
      (v.bodyBattery !== undefined ||
        v.trainingReadiness !== undefined ||
        v.stressScore !== undefined ||
        v.hrvStatus !== undefined ||
        v.recoveryTimeH !== undefined),
  );

  if (v?.bodyBattery !== undefined) {
    bullets.push(`Body Battery wynosi ${Math.round(v.bodyBattery)}/100.`);
  }
  if (hrvDeltaPct !== undefined && Math.abs(hrvDeltaPct) >= 8) {
    bullets.push(
      hrvDeltaPct < 0
        ? `HRV spadło o ${Math.abs(hrvDeltaPct)}% względem Twojej bazy (${Math.round(baseline.hrvMs ?? 0)} ms).`
        : `HRV wzrosło o ${hrvDeltaPct}% względem Twojej bazy.`,
    );
  }
  if (v?.hrvStatus && v.hrvStatus !== "no_status") {
    bullets.push(`HRV Status: ${HRV_STATUS_LABEL[v.hrvStatus] ?? v.hrvStatus}.`);
  }

  // Ile dni z rzędu stres utrzymuje się wysoko — to zdanie z przykładu produktowego.
  const stressSeries = history
    .slice(-7)
    .map((r) => r.vendor?.stressScore)
    .filter((s): s is number => s !== undefined);
  const trailingHighStress = (() => {
    let count = 0;
    for (let i = stressSeries.length - 1; i >= 0; i -= 1) {
      if (stressSeries[i] >= 60) count += 1;
      else break;
    }
    return count;
  })();
  if (trailingHighStress >= 2) {
    bullets.push(`Stres utrzymuje się wysoko od ${trailingHighStress} dni.`);
  } else if (v?.stressScore !== undefined) {
    bullets.push(`Średni stres dobowy: ${Math.round(v.stressScore)}/100.`);
  }

  if (v?.recoveryTimeH !== undefined && v.recoveryTimeH > 0) {
    bullets.push(`Do pełnej regeneracji pozostało ${Math.round(v.recoveryTimeH)} h.`);
  }
  if (record.cardio?.vo2Max !== undefined) {
    bullets.push(`VO₂max: ${round(record.cardio.vo2Max, 1)} ml/kg/min.`);
  }

  const recommendation = recommendTraining({
    bodyBattery: v?.bodyBattery,
    trainingReadiness: v?.trainingReadiness,
    recoveryTimeH: v?.recoveryTimeH,
    stressScore: v?.stressScore,
    hrvStatus: v?.hrvStatus,
    hrvDeltaPct,
  });

  if (recommendation === "rest" || recommendation === "recovery") {
    priorities.push("sen — połóż się wcześniej niż zwykle");
    priorities.push("spacer w tempie rozmowy, 30–45 minut");
    priorities.push("nawodnienie — 2 litry rozłożone na cały dzień");
    priorities.push("10 minut oddechu z wydłużonym wydechem");
  } else if (recommendation === "easy") {
    priorities.push("trening w strefie 1–2, bez interwałów");
    priorities.push("sen — utrzymaj stałą porę zaśnięcia");
    priorities.push("posiłek z pełnowartościowym białkiem po wysiłku");
  } else {
    priorities.push(
      recommendation === "hard"
        ? "wykorzystaj gotowość — dziś możesz zaplanować jednostkę jakościową"
        : "trening umiarkowany, kontroluj tętno w drugiej połowie",
    );
    priorities.push("rozgrzewka 10 minut i schłodzenie 5 minut");
    priorities.push("nawodnienie i posiłek w ciągu 2 h po wysiłku");
  }

  return {
    available,
    bodyBattery: v?.bodyBattery,
    bodyBatteryBand: v?.bodyBattery !== undefined ? bodyBatteryBand(v.bodyBattery) : undefined,
    trainingReadiness: v?.trainingReadiness,
    readinessBand: v?.trainingReadiness !== undefined ? readinessBand(v.trainingReadiness) : undefined,
    hrvStatus: v?.hrvStatus,
    hrvDeltaPct,
    stressScore: v?.stressScore,
    recoveryTimeH: v?.recoveryTimeH,
    vo2Max: record.cardio?.vo2Max,
    enduranceScore: v?.enduranceScore,
    hillScore: v?.hillScore,
    recommendation,
    bullets,
    priorities,
  };
};

/**
 * „Morning Report” — tekst gotowy do wyświetlenia i do odczytania lektorem.
 * Format zgodny z przykładem produktowym: fakty, wniosek, priorytety.
 */
export const buildGarminMorningReport = (insight: GarminInsight): string => {
  if (!insight.available) {
    return "Podłącz Garmin Connect, aby otrzymywać poranny raport z Body Battery, Training Readiness i HRV Status.";
  }

  const facts = insight.bullets.join("\n");
  const verdict =
    insight.recommendation === "rest"
      ? "Dzisiaj nie zalecamy treningu — organizm potrzebuje doby na odbudowę."
      : insight.recommendation === "recovery"
        ? "Dzisiaj nie zalecamy intensywnego treningu."
        : insight.recommendation === "easy"
          ? "Dzisiaj lepiej sprawdzi się lekki wysiłek niż jednostka jakościowa."
          : insight.recommendation === "moderate"
            ? "Możesz trenować, ale utrzymaj umiarkowaną intensywność."
            : "Organizm jest gotowy na mocniejszy bodziec.";

  const priorities = insight.priorities.map((p) => `✔ ${p}`).join("\n");

  return `${facts}\n\n${verdict}\n\nPriorytet:\n${priorities}`;
};

/** Skrócona ocena obciążenia tygodniowego — do karty „Trening” w module Garmin. */
export const weeklyGarminLoad = (
  history: DailyRecord[],
): { avgBodyBattery?: number; avgReadiness?: number; avgStress?: number; loadTrend: "rising" | "stable" | "falling" } => {
  const window = history.slice(-14);
  const battery = window.map((r) => r.vendor?.bodyBattery).filter((v): v is number => v !== undefined);
  const readiness = window
    .map((r) => r.vendor?.trainingReadiness ?? r.vendor?.readinessScore)
    .filter((v): v is number => v !== undefined);
  const stress = window.map((r) => r.vendor?.stressScore).filter((v): v is number => v !== undefined);

  const half = Math.floor(stress.length / 2);
  const trend =
    stress.length < 4
      ? "stable"
      : mean(stress.slice(half)) - mean(stress.slice(0, half)) > 5
        ? "rising"
        : mean(stress.slice(0, half)) - mean(stress.slice(half)) > 5
          ? "falling"
          : "stable";

  return {
    avgBodyBattery: battery.length ? round(mean(battery)) : undefined,
    avgReadiness: readiness.length ? round(mean(readiness)) : undefined,
    avgStress: stress.length ? round(mean(stress)) : undefined,
    loadTrend: trend,
  };
};

/** Znormalizowana „gotowość Garmin” 0–1 do wykorzystania w innych modułach. */
export const garminReadinessNormalized = (record: DailyRecord): number | undefined => {
  const parts = [
    record.vendor?.trainingReadiness,
    record.vendor?.bodyBattery,
    record.vendor?.stressScore !== undefined ? 100 - record.vendor.stressScore : undefined,
  ].filter((v): v is number => v !== undefined);
  if (parts.length === 0) return undefined;
  return clamp01(mean(parts) / 100);
};

/** Szacunek zużycia Body Battery na podstawie planowanego wysiłku (minuty × intensywność). */
export const estimateBatteryCost = (durationMin: number, intensity: number): number =>
  round(normalize(durationMin * clamp01(intensity / 10), 0, 120) * 45);
