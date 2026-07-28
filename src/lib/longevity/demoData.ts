/**
 * Dane poglądowe do trybu demonstracyjnego.
 *
 * Używane wyłącznie tam, gdzie użytkownik świadomie włączy „Zobacz jak to
 * działa” przed podłączeniem urządzenia — każdy ekran w tym trybie jest
 * oznaczony banerem. Nigdy nie mieszają się z danymi rzeczywistymi:
 * warstwa magazynu trzyma je pod osobnym kluczem i nie synchronizuje do bazy.
 *
 * Generator jest deterministyczny (ziarno = data), więc demo wygląda tak samo
 * po odświeżeniu, a wartości są fizjologicznie spójne: HRV spada w dni
 * o wysokim obciążeniu, tętno spoczynkowe rośnie po alkoholu, sen w weekend
 * jest dłuższy i późniejszy.
 */

import type { DailyRecord, UserProfile } from "./types";
import { addDays, clamp, round, seededRandom, toIsoDate } from "./math";

export const DEMO_PROFILE: UserProfile = {
  chronologicalAge: 42,
  sex: "male",
  heightCm: 180,
  weightKg: 82,
  smokingStatus: "never",
  weeklyAlcoholUnits: 4,
  targetBedtimeMinOfDay: 1380, // 23:00
  targetSleepMin: 465,
  targetSteps: 9000,
  targetWaterMl: 2400,
  locale: "pl",
};

/** Prosty hash daty na ziarno — ten sam dzień zawsze daje ten sam rekord. */
const seedFor = (isoDate: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < isoDate.length; i += 1) {
    hash ^= isoDate.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const generateDay = (date: string, index: number, total: number): DailyRecord => {
  const rand = seededRandom(seedFor(date));
  const [, , dayStr] = date.split("-");
  const dayOfWeek = new Date(date).getDay(); // 0 = niedziela
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Powolny trend poprawy w całym oknie — demo ma pokazywać, że praca daje efekt.
  const progress = index / Math.max(total - 1, 1);

  // Cykl obciążenia treningowego: 3 dni mocniej, 1 lekko, 1 wolne.
  const loadPhase = index % 5;
  const isHardDay = loadPhase === 0 || loadPhase === 2;
  const isRestDay = loadPhase === 4;

  const drankAlcohol = isWeekend && rand() < 0.55;

  const bedtimeBase = isWeekend ? 1440 + 40 : 1380;
  const bedtime = round(bedtimeBase - progress * 25 + (rand() - 0.5) * 55);
  const sleepDuration = round(
    clamp(
      (isWeekend ? 480 : 435) + progress * 30 - (drankAlcohol ? 35 : 0) + (rand() - 0.5) * 55,
      300,
      560,
    ),
  );
  const timeInBed = round(sleepDuration * (1.06 + rand() * 0.06));
  const awakenings = Math.max(0, Math.round((drankAlcohol ? 3 : 1.4) + (rand() - 0.5) * 2));

  const deep = round(sleepDuration * (0.16 + progress * 0.02 - (drankAlcohol ? 0.03 : 0) + (rand() - 0.5) * 0.03));
  const rem = round(sleepDuration * (0.19 + progress * 0.02 - (drankAlcohol ? 0.05 : 0) + (rand() - 0.5) * 0.03));
  const awake = round(awakenings * 7 + rand() * 10);
  const light = Math.max(0, sleepDuration - deep - rem);

  // HRV: baza rośnie z postępem, spada po alkoholu i w dni ciężkiego treningu.
  const hrvBase = 42 + progress * 9;
  const hrv = round(
    clamp(hrvBase - (drankAlcohol ? 9 : 0) - (isHardDay ? 4 : 0) + (isRestDay ? 3 : 0) + (rand() - 0.5) * 7, 20, 78),
    1,
  );

  const rhr = round(
    clamp(58 - progress * 4 + (drankAlcohol ? 6 : 0) + (isHardDay ? 2 : 0) + (rand() - 0.5) * 4, 44, 78),
  );

  const stressScore = round(
    clamp(
      44 - progress * 10 + (drankAlcohol ? 12 : 0) + (isHardDay ? 8 : 0) - (isRestDay ? 8 : 0) + (rand() - 0.5) * 18,
      12,
      92,
    ),
  );

  const bodyBattery = round(clamp(100 - stressScore * 0.7 + (sleepDuration - 420) / 8 + (rand() - 0.5) * 12, 8, 98));
  const trainingReadiness = round(
    clamp(bodyBattery * 0.6 + (hrv - hrvBase) * 2.2 + (sleepDuration - 420) / 6 + 20 + (rand() - 0.5) * 10, 5, 99),
  );

  const steps = round(
    clamp(
      (isRestDay ? 6200 : isHardDay ? 11_500 : 9000) + progress * 900 + (isWeekend ? 1500 : 0) + (rand() - 0.5) * 2600,
      2200,
      19_000,
    ),
  );

  const mvpa = round(clamp(isRestDay ? 8 : isHardDay ? 62 : 28 + (rand() - 0.5) * 16, 0, 95));
  const walkMin = round(clamp(22 + (isWeekend ? 25 : 0) + (rand() - 0.5) * 20, 0, 90));

  return {
    date,
    sleep: {
      durationMin: sleepDuration,
      timeInBedMin: timeInBed,
      bedtimeMinOfDay: ((bedtime % 1440) + 1440) % 1440,
      wakeMinOfDay: ((bedtime + timeInBed) % 1440 + 1440) % 1440,
      awakenings,
      vendorScore: round(clamp(sleepDuration / 5.4 + deep / 4 - awakenings * 3 + (rand() - 0.5) * 8, 25, 97)),
      stages: { deepMin: deep, remMin: rem, lightMin: light, awakeMin: awake },
      avgHeartRate: round(rhr * 0.94),
      avgHrvMs: hrv,
      avgSpo2: round(clamp(96 + (rand() - 0.5) * 2, 92, 99)),
      respirationRate: round(clamp(13.5 + (drankAlcohol ? 1.2 : 0) + (rand() - 0.5) * 1.6, 11, 18), 1),
      skinTempDeltaC: round((rand() - 0.5) * 0.8, 2),
      source: "garmin",
    },
    cardio: {
      restingHeartRate: rhr,
      hrvMs: hrv,
      spo2: round(clamp(96 + (rand() - 0.5) * 2, 92, 99)),
      respirationRate: round(clamp(14 + (rand() - 0.5) * 2, 11, 19), 1),
      vo2Max: round(clamp(43 + progress * 2.5 + (rand() - 0.5) * 0.6, 35, 58), 1),
      source: "garmin",
    },
    activity: {
      steps,
      activeKcal: round(steps * 0.042 + mvpa * 7),
      totalKcal: round(2280 + steps * 0.042 + mvpa * 7),
      distanceKm: round(steps * 0.00072, 2),
      moderateVigorousMin: mvpa,
      sedentaryMin: round(clamp(620 - mvpa * 2 - (isWeekend ? 90 : 0) + (rand() - 0.5) * 80, 300, 800)),
      walkMin,
      stretchingMin: rand() < 0.45 ? round(8 + rand() * 12) : 0,
      workouts: isRestDay
        ? []
        : [
            {
              type: isHardDay ? "Bieg interwałowy" : "Rower stacjonarny",
              durationMin: mvpa,
              avgHeartRate: round(rhr + (isHardDay ? 82 : 58)),
              intensity: isHardDay ? 8 : 5,
              kcal: round(mvpa * 9.5),
              distanceKm: isHardDay ? round(mvpa * 0.19, 1) : round(mvpa * 0.32, 1),
            },
          ],
      source: "garmin",
    },
    body: {
      weightKg: round(82.5 - progress * 2.1 + (rand() - 0.5) * 0.5, 1),
      heightCm: 180,
      bodyFatPct: round(21.5 - progress * 1.8 + (rand() - 0.5) * 0.4, 1),
      skinTempDeltaC: round((rand() - 0.5) * 0.6, 2),
      source: "withings",
    },
    vendor: {
      bodyBattery,
      bodyBatteryLow: round(clamp(bodyBattery - 25 - rand() * 15, 3, 70)),
      bodyBatteryHigh: round(clamp(bodyBattery + 12 + rand() * 10, 20, 100)),
      trainingReadiness,
      stressScore,
      hrvStatus: hrv > hrvBase * 1.05 ? "balanced" : hrv < hrvBase * 0.85 ? "low" : "unbalanced",
      recoveryTimeH: isHardDay ? round(18 + rand() * 16) : round(rand() * 10),
      hillScore: round(52 + progress * 6),
      enduranceScore: round(5100 + progress * 700),
      sleepScore: round(clamp(sleepDuration / 5.4 + deep / 4 - awakenings * 3 + (rand() - 0.5) * 8, 25, 97)),
      source: "garmin",
    },
    nutrition: {
      kcal: round(2250 + (isWeekend ? 350 : 0) + (rand() - 0.5) * 380),
      proteinG: round(clamp(105 + progress * 18 + (rand() - 0.5) * 30, 55, 175)),
      fiberG: round(clamp(22 + progress * 7 + (rand() - 0.5) * 9, 8, 42)),
      addedSugarG: round(clamp(34 - progress * 12 + (drankAlcohol ? 14 : 0) + (rand() - 0.5) * 16, 3, 85)),
      waterMl: round(clamp(1900 + progress * 500 + (rand() - 0.5) * 700, 700, 3400) / 50) * 50,
      vegetableServings: round(clamp(3 + progress * 1.6 + (rand() - 0.5) * 2, 0, 8)),
      fruitServings: round(clamp(1.4 + (rand() - 0.5) * 1.6, 0, 4)),
      alcoholUnits: drankAlcohol ? round(1 + rand() * 2) : 0,
      ultraProcessedMeals: round(clamp(1.4 - progress + (rand() - 0.5) * 1.4, 0, 3)),
      lastMealMinOfDay: round(1140 + (isWeekend ? 60 : 0) + (rand() - 0.5) * 80),
      micronutrients: {
        vitaminD: round(8 + rand() * 9, 1),
        magnesium: round(280 + rand() * 130),
        omega3: round(120 + rand() * 260),
        potassium: round(2600 + rand() * 900),
      },
      source: "manual",
    },
    lifestyle: {
      cigarettes: 0,
      smokingStatus: "never",
      meditationMin: rand() < 0.55 + progress * 0.25 ? round(8 + rand() * 14) : 0,
      breathworkMin: rand() < 0.4 ? round(4 + rand() * 8) : 0,
      outdoorMin: walkMin,
      morningLightMin: rand() < 0.5 + progress * 0.3 ? round(10 + rand() * 20) : 0,
      screenBeforeBedMin: round(clamp(45 - progress * 28 + (rand() - 0.5) * 40, 0, 95)),
      notifications: round(clamp(120 - progress * 25 + (rand() - 0.5) * 70, 25, 260)),
      socialMin: round(clamp(45 + (isWeekend ? 90 : 0) + (rand() - 0.5) * 60, 0, 240)),
      thermalMin: rand() < 0.18 ? round(12 + rand() * 18) : 0,
    },
    subjective: {
      mood: round(clamp(3.4 + progress * 0.6 - (drankAlcohol ? 0.7 : 0) + (rand() - 0.5) * 1.2, 1, 5)),
      energy: round(clamp(3.2 + progress * 0.7 - (isHardDay ? 0.4 : 0) + (rand() - 0.5) * 1.2, 1, 5)),
      focus: round(clamp(3.3 + progress * 0.6 + (rand() - 0.5) * 1.2, 1, 5)),
      stress: round(clamp(3.1 - progress * 0.7 + (drankAlcohol ? 0.6 : 0) + (rand() - 0.5) * 1.3, 1, 5)),
      sleepQuality: round(clamp(3.3 + progress * 0.6 - (drankAlcohol ? 0.9 : 0) + (rand() - 0.5) * 1.2, 1, 5)),
      soreness: round(clamp(isHardDay ? 3.2 : 1.9 + (rand() - 0.5) * 1.2, 1, 5)),
    },
    sources: ["garmin", "withings", "manual"],
  };
};

/**
 * Generuje `days` dni danych poglądowych zakończonych dniem `endDate`
 * (domyślnie dziś). Zwraca tablicę posortowaną rosnąco.
 */
export const generateDemoHistory = (days = 120, endDate = toIsoDate(new Date())): DailyRecord[] => {
  const records: DailyRecord[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(endDate, -i);
    records.push(generateDay(date, days - 1 - i, days));
  }
  return records;
};

/** Pusty rekord dnia — punkt startowy dla nowego użytkownika. */
export const emptyRecord = (date: string): DailyRecord => ({ date, sources: [] });
