/**
 * Gamifikacja: XP, poziomy, serie dni i odznaki.
 *
 * Zasada projektowa: nagradzamy KONSEKWENCJĘ, nie rekordy. Seria dni nie
 * zrywa się od jednego słabszego dnia (jest jeden „dzień ochronny” w tygodniu),
 * bo aplikacja ma obniżać stres, a nie go generować.
 */

import type { Badge, DailyRecord, GamificationState, IsoDate, MissionProgress } from "./types";
import { addDays, clamp01, round } from "./math";

/**
 * Krzywa poziomów: wymagane XP rośnie ~1,18× na poziom, startując od 100.
 * Poziom 10 ≈ 3 200 XP, poziom 25 ≈ 22 000 XP — tempo dopasowane do
 * ~120 XP dziennie przy pełnym wykonaniu misji.
 */
export const xpForLevel = (level: number): number =>
  Math.round(100 * (1.18 ** (level - 1)));

export const levelFromXp = (xp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } => {
  let level = 1;
  let remaining = Math.max(0, xp);
  let need = xpForLevel(level);
  while (remaining >= need && level < 100) {
    remaining -= need;
    level += 1;
    need = xpForLevel(level);
  }
  return { level, xpIntoLevel: Math.round(remaining), xpForNextLevel: need };
};

export const LEVEL_TITLES: Array<{ minLevel: number; title: string }> = [
  { minLevel: 1, title: "Początek drogi" },
  { minLevel: 5, title: "Świadomy rytm" },
  { minLevel: 10, title: "Stabilna regeneracja" },
  { minLevel: 16, title: "Odporny układ nerwowy" },
  { minLevel: 24, title: "Architekt nawyków" },
  { minLevel: 34, title: "Mistrz regeneracji" },
  { minLevel: 50, title: "Długowieczność w praktyce" },
];

export const titleForLevel = (level: number): string =>
  [...LEVEL_TITLES].reverse().find((t) => level >= t.minLevel)?.title ?? LEVEL_TITLES[0].title;

interface DayOutcome {
  date: IsoDate;
  /** Czy dzień liczy się do serii (co najmniej jedna misja ukończona). */
  active: boolean;
}

/**
 * Liczy serię dni. Jeden przerwany dzień w oknie 7 dni jest wybaczany
 * („dzień ochronny”), dwa z rzędu przerywają serię.
 */
export const calculateStreak = (outcomes: DayOutcome[]): { current: number; longest: number } => {
  const sorted = [...outcomes].sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  let longest = 0;
  let graceUsed = false;
  let sinceGrace = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const day = sorted[i];
    const previous = sorted[i - 1];
    const contiguous = !previous || addDays(previous.date, 1) === day.date;

    if (!contiguous) {
      current = 0;
      graceUsed = false;
      sinceGrace = 0;
    }

    if (day.active) {
      current += 1;
      sinceGrace += 1;
      if (sinceGrace >= 7) graceUsed = false;
    } else if (!graceUsed) {
      graceUsed = true;
      sinceGrace = 0;
      // Dzień ochronny podtrzymuje serię, ale jej nie zwiększa.
    } else {
      current = 0;
      graceUsed = false;
      sinceGrace = 0;
    }

    longest = Math.max(longest, current);
  }

  return { current, longest };
};

interface BadgeDefinition {
  id: string;
  label: string;
  description: string;
  /** Zwraca postęp 0–1. */
  evaluate: (ctx: BadgeContext) => number;
}

export interface BadgeContext {
  records: DailyRecord[];
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  /** Liczba dni, w których wszystkie misje zostały ukończone. */
  perfectDays: number;
  /** Najlepszy dzienny Epigenetic Score. */
  bestEpigenetic: number;
  /** Liczba minut medytacji łącznie. */
  totalMeditationMin: number;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: "first-night",
    label: "Pierwsza noc",
    description: "Zsynchronizuj pierwszą noc snu z urządzenia lub wpisz ją ręcznie.",
    evaluate: ({ records }) => clamp01(records.filter((r) => r.sleep?.durationMin).length / 1),
  },
  {
    id: "week-of-rhythm",
    label: "Tydzień rytmu",
    description: "7 dni serii z ukończoną co najmniej jedną misją.",
    evaluate: ({ longestStreak }) => clamp01(longestStreak / 7),
  },
  {
    id: "month-of-rhythm",
    label: "Miesiąc rytmu",
    description: "30 dni serii — nawyk zaczyna się utrwalać.",
    evaluate: ({ longestStreak }) => clamp01(longestStreak / 30),
  },
  {
    id: "quarter-of-rhythm",
    label: "Kwartał konsekwencji",
    description: "90 dni serii.",
    evaluate: ({ longestStreak }) => clamp01(longestStreak / 90),
  },
  {
    id: "perfect-day",
    label: "Dzień idealny",
    description: "Ukończ wszystkie 5 misji jednego dnia.",
    evaluate: ({ perfectDays }) => clamp01(perfectDays / 1),
  },
  {
    id: "ten-perfect-days",
    label: "Dziesięć pełnych dni",
    description: "10 dni z kompletem misji.",
    evaluate: ({ perfectDays }) => clamp01(perfectDays / 10),
  },
  {
    id: "epigenetic-90",
    label: "Epigenetyka 90+",
    description: "Osiągnij 90 punktów Epigenetic Lifestyle Score w jednym dniu.",
    evaluate: ({ bestEpigenetic }) => clamp01(bestEpigenetic / 90),
  },
  {
    id: "sleep-guardian",
    label: "Strażnik snu",
    description: "14 nocy z rzędu w oknie 7–9 godzin snu.",
    evaluate: ({ records }) => {
      let best = 0;
      let run = 0;
      for (const r of records) {
        const min = r.sleep?.durationMin;
        if (min !== undefined && min >= 420 && min <= 540) {
          run += 1;
          best = Math.max(best, run);
        } else {
          run = 0;
        }
      }
      return clamp01(best / 14);
    },
  },
  {
    id: "calm-mind",
    label: "Spokojny umysł",
    description: "Zbierz 300 minut medytacji i oddechu.",
    evaluate: ({ totalMeditationMin }) => clamp01(totalMeditationMin / 300),
  },
  {
    id: "walker",
    label: "Chodzę codziennie",
    description: "21 dni z co najmniej 8000 kroków.",
    evaluate: ({ records }) =>
      clamp01(records.filter((r) => (r.activity?.steps ?? 0) >= 8000).length / 21),
  },
  {
    id: "dry-fortnight",
    label: "Dwa tygodnie bez alkoholu",
    description: "14 dni z rzędu z zerowym spożyciem alkoholu.",
    evaluate: ({ records }) => {
      let best = 0;
      let run = 0;
      for (const r of records) {
        if (r.nutrition?.alcoholUnits === 0) {
          run += 1;
          best = Math.max(best, run);
        } else if (r.nutrition?.alcoholUnits !== undefined) {
          run = 0;
        }
      }
      return clamp01(best / 14);
    },
  },
  {
    id: "level-10",
    label: "Poziom 10",
    description: "Zdobądź dziesiąty poziom.",
    evaluate: ({ totalXp }) => clamp01(levelFromXp(totalXp).level / 10),
  },
];

export const evaluateBadges = (ctx: BadgeContext, earnedAt: Record<string, IsoDate> = {}): Badge[] =>
  BADGES.map((badge) => {
    const progress = round(clamp01(badge.evaluate(ctx)), 3);
    return {
      id: badge.id,
      label: badge.label,
      description: badge.description,
      progress,
      earnedAt: progress >= 1 ? (earnedAt[badge.id] ?? undefined) : undefined,
    };
  });

/** Składa pełny stan gamifikacji z historii dni i wyników misji. */
export const buildGamificationState = (
  totalXp: number,
  dailyProgress: Array<{ date: IsoDate; progress: MissionProgress[] }>,
  records: DailyRecord[],
  /** Najlepszy dzienny Epigenetic Score w historii — do odznaki „Epigenetyka 90+”. */
  bestEpigenetic = 0,
  badgeEarnedAt: Record<string, IsoDate> = {},
): GamificationState => {
  const outcomes: DayOutcome[] = dailyProgress.map((d) => ({
    date: d.date,
    active: d.progress.some((p) => p.complete),
  }));
  const { current, longest } = calculateStreak(outcomes);
  const perfectDays = dailyProgress.filter(
    (d) => d.progress.length > 0 && d.progress.every((p) => p.complete),
  ).length;

  const totalMeditationMin = records.reduce(
    (acc, r) => acc + (r.lifestyle?.meditationMin ?? 0) + (r.lifestyle?.breathworkMin ?? 0),
    0,
  );

  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(totalXp);

  return {
    xp: Math.round(totalXp),
    level,
    xpIntoLevel,
    xpForNextLevel,
    currentStreak: current,
    longestStreak: longest,
    badges: evaluateBadges(
      {
        records,
        totalXp,
        currentStreak: current,
        longestStreak: longest,
        perfectDays,
        bestEpigenetic,
        totalMeditationMin,
      },
      badgeEarnedAt,
    ),
  };
};
