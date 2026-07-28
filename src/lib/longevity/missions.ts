/**
 * Misje dnia.
 *
 * Misje nie są stałą listą „8000 kroków / 2 l wody” dla wszystkich. Silnik
 * dobiera pięć zadań do TEGO dnia: patrzy na stan układu nerwowego, deficyt
 * snu, wczorajsze obciążenie i luki w nawykach z ostatniego tygodnia.
 * Każda misja niesie ze sobą `reason` — użytkownik zawsze widzi, dlaczego
 * dostał akurat to zadanie.
 */

import type {
  DailyRecord,
  LongevityPanel,
  Mission,
  MissionMetric,
  MissionProgress,
  UserProfile,
} from "./types";
import { clamp, clamp01, formatDuration, formatMinuteOfDay, mean, round } from "./math";
import {
  SLEEP_TARGET_MIN,
  STEPS_TARGET_DEFAULT,
  VEGETABLE_SERVINGS_TARGET,
  WATER_TARGET_ML_DEFAULT,
} from "./norms";

/** Odczyt aktualnej wartości metryki misji z rekordu dnia. */
export const readMissionMetric = (record: DailyRecord, metric: MissionMetric): number => {
  switch (metric) {
    case "steps":
      return record.activity?.steps ?? 0;
    case "sleepMin":
      return record.sleep?.durationMin ?? 0;
    case "waterMl":
      return record.nutrition?.waterMl ?? 0;
    case "meditationMin":
      return record.lifestyle?.meditationMin ?? 0;
    case "breathworkMin":
      return record.lifestyle?.breathworkMin ?? 0;
    case "screenBeforeBedMin":
      return record.lifestyle?.screenBeforeBedMin ?? 0;
    case "vegetableServings":
      return record.nutrition?.vegetableServings ?? 0;
    case "outdoorMin":
      return record.lifestyle?.outdoorMin ?? record.activity?.walkMin ?? 0;
    case "alcoholUnits":
      return record.nutrition?.alcoholUnits ?? 0;
    case "walkMin":
      return record.activity?.walkMin ?? record.lifestyle?.outdoorMin ?? 0;
    case "stretchingMin":
      return record.activity?.stretchingMin ?? 0;
    case "morningLightMin":
      return record.lifestyle?.morningLightMin ?? 0;
    default:
      return 0;
  }
};

/** Metryki, w których celem jest wartość NIE WIĘKSZA niż próg. */
const LOWER_IS_BETTER: MissionMetric[] = ["screenBeforeBedMin", "alcoholUnits"];

const avgOf = (records: DailyRecord[], metric: MissionMetric): number | undefined => {
  const values = records
    .map((r) => {
      const v = readMissionMetric(r, metric);
      return v === 0 ? undefined : v;
    })
    .filter((v): v is number => v !== undefined);
  return values.length ? mean(values) : undefined;
};

/**
 * Generuje 5 misji na dany dzień. Kolejność wynika z priorytetu: najpierw to,
 * co najmocniej ciąży wynikom, potem uzupełnienie kategorii.
 */
export const generateDailyMissions = (
  panel: LongevityPanel,
  history: DailyRecord[],
  profile: UserProfile,
  /** Sugerowana pora snu z cyfrowego bliźniaka (minuty od północy). */
  optimalBedtimeMinOfDay?: number,
): Mission[] => {
  const week = history.slice(-7);
  const targetSteps = profile.targetSteps ?? STEPS_TARGET_DEFAULT;
  const targetWater = profile.targetWaterMl ?? WATER_TARGET_ML_DEFAULT;
  const targetSleep = profile.targetSleepMin ?? SLEEP_TARGET_MIN;

  const avgSleep = avgOf(week, "sleepMin");
  const avgSteps = avgOf(week, "steps");
  const avgWater = avgOf(week, "waterMl");
  const avgVeg = avgOf(week, "vegetableServings");
  const avgScreen = avgOf(week, "screenBeforeBedMin");

  const pool: Array<Mission & { weight: number }> = [];

  // ── Sen ────────────────────────────────────────────────────────────────────
  const sleepGap = avgSleep === undefined ? 0 : Math.max(0, targetSleep - avgSleep);
  pool.push({
    id: "sleep-duration",
    title:
      sleepGap >= 30
        ? `Połóż się ${Math.round(clamp(sleepGap, 15, 90) / 15) * 15} minut wcześniej`
        : `Prześpij ${formatDuration(targetSleep)}`,
    description:
      optimalBedtimeMinOfDay !== undefined
        ? `Twoja optymalna pora zaśnięcia wyliczona z historii to ${formatMinuteOfDay(optimalBedtimeMinOfDay)}.`
        : `Celuj w ${formatDuration(targetSleep)} snu netto.`,
    metric: "sleepMin",
    target: targetSleep,
    unit: "min",
    xp: 40,
    category: "sleep",
    reason:
      avgSleep === undefined
        ? "Brakuje danych o śnie — pierwszy pomiar ustawi Twoją bazę."
        : `Średnia z 7 dni: ${formatDuration(avgSleep)}${sleepGap >= 30 ? `, czyli ${formatDuration(sleepGap)} poniżej celu` : ""}.`,
    weight: 60 + sleepGap / 2 + (100 - panel.sleepScore.value) / 2,
  });

  // ── Ruch ───────────────────────────────────────────────────────────────────
  const stepTarget =
    panel.nervousSystem.state === "overload" || panel.nervousSystem.state === "freeze"
      ? Math.round(targetSteps * 0.75)
      : targetSteps;
  pool.push({
    id: "steps",
    title: `Przejdź ${stepTarget.toLocaleString("pl-PL")} kroków`,
    description:
      stepTarget < targetSteps
        ? "Dziś obniżamy próg — chodzi o ruch regeneracyjny, nie o wynik."
        : "Rozłóż kroki na cały dzień, najlepiej 3 krótsze wyjścia.",
    metric: "steps",
    target: stepTarget,
    unit: "kroków",
    xp: 30,
    category: "movement",
    reason:
      avgSteps === undefined
        ? "Podłącz zegarek lub telefon, aby liczyć kroki automatycznie."
        : `Średnia z 7 dni: ${Math.round(avgSteps).toLocaleString("pl-PL")} kroków.`,
    weight: 50 + (avgSteps !== undefined && avgSteps < targetSteps ? 20 : 0),
  });

  // ── Nawodnienie ────────────────────────────────────────────────────────────
  pool.push({
    id: "water",
    title: `Wypij ${(targetWater / 1000).toFixed(1)} litra wody`,
    description: "Pierwsza szklanka w ciągu 30 minut po pobudce ustawia resztę dnia.",
    metric: "waterMl",
    target: targetWater,
    unit: "ml",
    xp: 20,
    category: "nutrition",
    reason:
      avgWater === undefined
        ? "Zapisuj nawodnienie — to jeden z najłatwiejszych punktów Epigenetic Score."
        : `Średnia z 7 dni: ${(avgWater / 1000).toFixed(1)} l.`,
    weight: 40 + (avgWater !== undefined && avgWater < targetWater ? 15 : 0),
  });

  // ── Regulacja układu nerwowego ─────────────────────────────────────────────
  const needsRegulation =
    panel.stressLevel === "high" ||
    panel.stressLevel === "critical" ||
    panel.nervousSystem.state === "overload" ||
    panel.nervousSystem.state === "fight";
  pool.push({
    id: "meditation",
    title: needsRegulation ? "15 minut oddechu lub medytacji" : "10 minut medytacji",
    description: needsRegulation
      ? "Wydłużony wydech aktywuje reakcję przywspółczulną — najszybsza droga do obniżenia tętna."
      : "Krótka praktyka uważności utrwala regulację, nawet w spokojny dzień.",
    metric: "meditationMin",
    target: needsRegulation ? 15 : 10,
    unit: "min",
    xp: needsRegulation ? 35 : 25,
    category: "mind",
    reason: needsRegulation
      ? `Indeks stresu ${panel.stressIndex.value}/100, stan układu nerwowego: ${panel.nervousSystem.state === "overload" ? "przeciążenie" : "mobilizacja"}.`
      : "Utrzymanie serii praktyk jest ważniejsze niż długość pojedynczej sesji.",
    weight: 45 + (needsRegulation ? 35 : 0),
  });

  // ── Ekran przed snem ───────────────────────────────────────────────────────
  pool.push({
    id: "screen-free",
    title: "Bez telefonu godzinę przed snem",
    description: "Ekran przesuwa wydzielanie melatoniny i wydłuża czas zasypiania.",
    metric: "screenBeforeBedMin",
    target: 0,
    unit: "min",
    xp: 25,
    category: "sleep",
    reason:
      avgScreen === undefined
        ? "Zaznacz wieczorem, czy udało się odłożyć telefon."
        : `Średnio ${Math.round(avgScreen)} min ekranu przed snem w ostatnim tygodniu.`,
    weight: 35 + (panel.sleepScore.value < 70 ? 20 : 0) + (avgScreen !== undefined ? clamp(avgScreen / 2, 0, 25) : 0),
  });

  // ── Warzywa ────────────────────────────────────────────────────────────────
  pool.push({
    id: "vegetables",
    title: `Zjedz ${VEGETABLE_SERVINGS_TARGET} porcje warzyw`,
    description: "Porcja to około 80 g — garść. Najprościej dołożyć je do każdego posiłku.",
    metric: "vegetableServings",
    target: VEGETABLE_SERVINGS_TARGET,
    unit: "porcji",
    xp: 25,
    category: "nutrition",
    reason:
      avgVeg === undefined
        ? "Dziennik diety odblokuje pełną punktację Epigenetic Score."
        : `Średnia z 7 dni: ${round(avgVeg, 1)} porcji.`,
    weight: 30 + (panel.metabolicScore.value < 65 ? 20 : 0),
  });

  // ── Regeneracja / światło ──────────────────────────────────────────────────
  pool.push({
    id: "morning-light",
    title: "15 minut światła dziennego rano",
    description: "Światło w ciągu godziny od pobudki stabilizuje rytm dobowy i porę zaśnięcia.",
    metric: "morningLightMin",
    target: 15,
    unit: "min",
    xp: 20,
    category: "recovery",
    reason:
      panel.sleepScore.value < 70
        ? `Sen na poziomie ${panel.sleepScore.value}/100 — poranne światło jest tu najszybszą dźwignią.`
        : "Poranne światło utrwala regularność snu.",
    weight: 25 + (panel.sleepScore.value < 70 ? 25 : 0) + (panel.nervousSystem.state === "freeze" ? 20 : 0),
  });

  pool.push({
    id: "walk",
    title: "30 minut spaceru na zewnątrz",
    description: "Tempo rozmowy, bez ambicji wynikowych — to jednostka regeneracyjna.",
    metric: "outdoorMin",
    target: 30,
    unit: "min",
    xp: 20,
    category: "recovery",
    reason:
      panel.recoveryScore.value < 60
        ? `Regeneracja ${panel.recoveryScore.value}/100 — spacer obciąża mniej niż trening, a poprawia krążenie.`
        : "Spacer domyka dzienny bilans ruchu.",
    weight: 25 + (panel.recoveryScore.value < 60 ? 30 : 0),
  });

  pool.push({
    id: "stretching",
    title: "10 minut rozciągania",
    description: "Mobilność bioder i klatki piersiowej — przeciwwaga dla dnia przy biurku.",
    metric: "stretchingMin",
    target: 10,
    unit: "min",
    xp: 15,
    category: "movement",
    reason: "Uzupełnienie dnia o pracę nad zakresem ruchu.",
    weight: 20,
  });

  const selected = [...pool]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(({ weight: _weight, ...mission }) => mission);

  return selected;
};

export const evaluateMissions = (missions: Mission[], record: DailyRecord): MissionProgress[] =>
  missions.map((mission) => {
    const current = readMissionMetric(record, mission.metric);
    const lowerIsBetter = LOWER_IS_BETTER.includes(mission.metric);

    const progress = lowerIsBetter
      ? current <= mission.target
        ? 1
        : clamp01(1 - (current - mission.target) / Math.max(mission.target || 60, 60))
      : mission.target === 0
        ? current === 0
          ? 1
          : 0
        : clamp01(current / mission.target);

    return {
      mission,
      current: round(current, 1),
      progress: round(progress, 3),
      complete: progress >= 0.999,
    };
  });

/** XP zdobyte za ukończone misje danego dnia. */
export const missionXp = (progress: MissionProgress[]): number =>
  progress.reduce((acc, p) => acc + (p.complete ? p.mission.xp : Math.round(p.mission.xp * p.progress * 0.5)), 0);
