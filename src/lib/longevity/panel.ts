/**
 * Kompozycja pełnego panelu dnia — jedno wejście dla całego UI.
 *
 * `analyzeDay` jest jedynym miejscem, w którym ustalona jest kolejność
 * obliczeń (bo część wyników zależy od innych: regeneracja korzysta ze snu
 * i stresu, Longevity Index z wszystkich). Komponenty nie liczą niczego same —
 * dostają gotowy `DayAnalysis` i tylko go renderują.
 */

import type {
  CoachReport,
  DailyRecord,
  DigitalTwin,
  GamificationState,
  LongevityPanel,
  Mission,
  MissionProgress,
  TwinBaseline,
  UserProfile,
} from "./types";
import {
  brainRecoveryScore,
  cardiovascularScore,
  energyScore,
  longevityIndex,
  metabolicScore,
  recoveryScore,
  sleepScore,
  stressIndex,
  stressLevelFromIndex,
} from "./scores";
import { calculateEpigeneticScore } from "./epigenetic";
import { assessNervousSystem } from "./nervousSystem";
import { estimateBiologicalAge, estimateRecoveryAge } from "./biologicalAge";
import { buildBaseline, buildDigitalTwin } from "./digitalTwin";
import { evaluateMissions, generateDailyMissions, missionXp } from "./missions";
import { buildGamificationState } from "./gamification";
import { buildCoachReport } from "./coach";
import { buildGarminInsight, type GarminInsight } from "./garmin";
import { analyzeNutrition, type NutritionAnalysis } from "./nutrition";

export interface DayAnalysis {
  panel: LongevityPanel;
  twin: DigitalTwin;
  baseline: TwinBaseline;
  missions: Mission[];
  missionProgress: MissionProgress[];
  earnedXpToday: number;
  gamification: GamificationState;
  report: CoachReport;
  garmin: GarminInsight;
  nutrition: NutritionAnalysis;
}

/** Buduje sam panel wyników (bez misji, gamifikacji i raportu). */
export const buildPanel = (
  record: DailyRecord,
  history: DailyRecord[],
  profile: UserProfile,
  baseline: TwinBaseline,
): LongevityPanel => {
  const sleep = sleepScore(record, history, profile);
  const stress = stressIndex(record, baseline, profile);
  const recovery = recoveryScore(record, baseline, sleep, stress);
  const energy = energyScore(record, sleep, stress, baseline);
  const epigenetic = calculateEpigeneticScore(record, profile);
  const nervous = assessNervousSystem(record, history, baseline, recovery, stress);
  const brain = brainRecoveryScore(record, sleep);
  const cardio = cardiovascularScore(record, profile, baseline);
  const metabolic = metabolicScore(record, profile);
  const biologicalAge = estimateBiologicalAge(profile, [...history, record], baseline);

  return {
    date: record.date,
    biologicalAge,
    recoveryAge: estimateRecoveryAge(profile, recovery.value, sleep.value, stress.value),
    sleepScore: sleep,
    stressIndex: stress,
    recoveryScore: recovery,
    energyScore: energy,
    epigeneticScore: epigenetic,
    nervousSystem: nervous,
    brainRecoveryScore: brain,
    cardiovascularScore: cardio,
    metabolicScore: metabolic,
    longevityIndex: longevityIndex({
      sleep,
      stress,
      recovery,
      cardiovascular: cardio,
      metabolic,
      brain,
      epigenetic: epigenetic.value,
    }),
    stressLevel: stressLevelFromIndex(stress.value),
  };
};

/**
 * Pełna analiza dnia.
 *
 * @param today   rekord dzisiejszy (może być częściowy — dzień trwa)
 * @param history rekordy poprzednich dni, posortowane rosnąco po dacie
 * @param profile profil użytkownika
 * @param options `totalXp` i `badgeEarnedAt` pochodzą z bazy, `history`
 *                z pamięci lokalnej lub z Supabase — silnik nie wie skąd.
 */
export const analyzeDay = (
  today: DailyRecord,
  history: DailyRecord[],
  profile: UserProfile,
  options: { totalXp?: number; badgeEarnedAt?: Record<string, string> } = {},
): DayAnalysis => {
  // Historia bez dzisiejszego dnia — inaczej baza „uczyłaby się” z niepełnej doby.
  const past = history.filter((r) => r.date !== today.date);
  const baseline = buildBaseline(past);
  const panel = buildPanel(today, past, profile, baseline);
  const twin = buildDigitalTwin(profile, [...past, today], baseline);

  const missions = generateDailyMissions(panel, past, profile, twin.optimalBedtimeMinOfDay);
  const missionProgress = evaluateMissions(missions, today);
  const earnedXpToday = missionXp(missionProgress);

  // Historię misji odtwarzamy z bieżącego zestawu zadań zamiast przeliczać
  // pełny panel dla każdego z 120 dni. Reguły punktacji są te same, a koszt
  // spada z kwadratowego do liniowego — dashboard musi wstawać poniżej klatki.
  const dailyProgress = past
    .slice(-120)
    .map((record) => ({ date: record.date, progress: evaluateMissions(missions, record) }));

  const bestEpigenetic = past.reduce(
    (best, record) => Math.max(best, calculateEpigeneticScore(record, profile).value),
    panel.epigeneticScore.value,
  );

  const totalXp =
    options.totalXp ?? dailyProgress.reduce((acc, d) => acc + missionXp(d.progress), 0) + earnedXpToday;

  const gamification = buildGamificationState(
    totalXp,
    [...dailyProgress, { date: today.date, progress: missionProgress }],
    [...past, today],
    bestEpigenetic,
    options.badgeEarnedAt,
  );

  return {
    panel,
    twin,
    baseline,
    missions,
    missionProgress,
    earnedXpToday,
    gamification,
    report: buildCoachReport(panel, today, past, twin, profile),
    garmin: buildGarminInsight(today, past, baseline),
    nutrition: analyzeNutrition(today, profile),
  };
};
