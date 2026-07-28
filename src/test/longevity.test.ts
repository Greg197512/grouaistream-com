import { describe, expect, it } from "vitest";
import {
  BREATHING_PROTOCOLS,
  DEVICE_INTEGRATIONS,
  EPIGENETIC_MAX_POINTS,
  MEDITATION_SESSIONS,
  analyzeDay,
  analyzeNutrition,
  analyzeTrend,
  assessNervousSystem,
  buildBaseline,
  buildDigitalTwin,
  buildGarminInsight,
  buildGarminMorningReport,
  buildPanel,
  calculateEpigeneticScore,
  calculateStreak,
  circularMeanMinutes,
  circularStdMinutes,
  cycleSeconds,
  estimateBiologicalAge,
  evaluateMissions,
  generateDailyMissions,
  generateDemoHistory,
  levelFromXp,
  phaseAt,
  plateau,
  recommendSessions,
  scaleForPhase,
  scriptSeconds,
  sleepScore,
  stressIndex,
  stressLevelFromIndex,
  type DailyRecord,
  type UserProfile,
} from "@/lib/longevity";
import { DEMO_PROFILE } from "@/lib/longevity/demoData";

const profile: UserProfile = {
  chronologicalAge: 40,
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  smokingStatus: "never",
  weeklyAlcoholUnits: 2,
  targetSleepMin: 465,
  targetSteps: 8000,
  targetWaterMl: 2000,
};

/** Dzień „wzorcowy”: wszystkie nawyki spełnione, dane kompletne. */
const goodDay = (date = "2026-07-20"): DailyRecord => ({
  date,
  sleep: {
    durationMin: 480,
    timeInBedMin: 500,
    bedtimeMinOfDay: 1380,
    wakeMinOfDay: 420,
    awakenings: 1,
    stages: { deepMin: 95, remMin: 110, lightMin: 265, awakeMin: 10 },
    avgHeartRate: 52,
    avgHrvMs: 62,
    avgSpo2: 97,
    respirationRate: 13,
    vendorScore: 88,
  },
  cardio: { restingHeartRate: 54, hrvMs: 62, spo2: 97, respirationRate: 13.5, vo2Max: 50 },
  activity: { steps: 11_000, moderateVigorousMin: 45, sedentaryMin: 420, walkMin: 40, stretchingMin: 12 },
  body: { weightKg: 78, heightCm: 180 },
  vendor: { bodyBattery: 82, trainingReadiness: 85, stressScore: 22, hrvStatus: "balanced", recoveryTimeH: 4 },
  nutrition: {
    kcal: 2400,
    proteinG: 120,
    fiberG: 34,
    addedSugarG: 12,
    waterMl: 2400,
    vegetableServings: 6,
    fruitServings: 2,
    alcoholUnits: 0,
    ultraProcessedMeals: 0,
    lastMealMinOfDay: 1140,
  },
  lifestyle: {
    cigarettes: 0,
    smokingStatus: "never",
    meditationMin: 15,
    breathworkMin: 5,
    outdoorMin: 45,
    morningLightMin: 20,
    screenBeforeBedMin: 0,
    notifications: 45,
  },
  subjective: { mood: 5, energy: 5, focus: 5, stress: 1, sleepQuality: 5, soreness: 1 },
});

/** Dzień „trudny”: niedosypianie, alkohol, brak ruchu, wysoki stres. */
const badDay = (date = "2026-07-21"): DailyRecord => ({
  date,
  sleep: {
    durationMin: 300,
    timeInBedMin: 400,
    bedtimeMinOfDay: 120,
    wakeMinOfDay: 420,
    awakenings: 6,
    stages: { deepMin: 25, remMin: 30, lightMin: 245, awakeMin: 60 },
    avgHeartRate: 74,
    avgHrvMs: 24,
    avgSpo2: 94,
    respirationRate: 17,
    vendorScore: 41,
  },
  cardio: { restingHeartRate: 76, hrvMs: 24, spo2: 94, respirationRate: 17.5, vo2Max: 32 },
  activity: { steps: 2200, moderateVigorousMin: 0, sedentaryMin: 780, walkMin: 5 },
  body: { weightKg: 98, heightCm: 180 },
  vendor: { bodyBattery: 18, trainingReadiness: 21, stressScore: 82, hrvStatus: "low", recoveryTimeH: 36 },
  nutrition: {
    kcal: 3100,
    proteinG: 45,
    fiberG: 9,
    addedSugarG: 88,
    waterMl: 600,
    vegetableServings: 0,
    fruitServings: 0,
    alcoholUnits: 4,
    ultraProcessedMeals: 3,
    lastMealMinOfDay: 60,
  },
  lifestyle: {
    cigarettes: 12,
    smokingStatus: "current",
    meditationMin: 0,
    breathworkMin: 0,
    outdoorMin: 0,
    morningLightMin: 0,
    screenBeforeBedMin: 90,
    notifications: 240,
  },
  subjective: { mood: 2, energy: 1, focus: 2, stress: 5, sleepQuality: 1, soreness: 4 },
});

const historyOf = (make: (date: string) => DailyRecord, days: number, endDate = "2026-07-19"): DailyRecord[] => {
  const out: DailyRecord[] = [];
  const [y, m, d] = endDate.split("-").map(Number);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(y, m - 1, d - i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    out.push(make(iso));
  }
  return out;
};

describe("funkcje numeryczne", () => {
  it("plateau zwraca 1 w optimum i 0 na krańcach", () => {
    expect(plateau(8, 4, 7, 9, 11)).toBe(1);
    expect(plateau(4, 4, 7, 9, 11)).toBe(0);
    expect(plateau(11, 4, 7, 9, 11)).toBe(0);
    expect(plateau(5.5, 4, 7, 9, 11)).toBeCloseTo(0.5, 5);
  });

  it("kołowa średnia radzi sobie z przejściem przez północ", () => {
    // 23:40 i 00:20 → średnia 00:00, a nie 12:00.
    expect(circularMeanMinutes([1420, 20])).toBeCloseTo(0, 0);
  });

  it("kołowe odchylenie rośnie przy nieregularnych porach snu", () => {
    const regular = circularStdMinutes([1380, 1385, 1375, 1390]);
    const irregular = circularStdMinutes([1380, 60, 1200, 300]);
    expect(regular).toBeLessThan(15);
    expect(irregular).toBeGreaterThan(regular * 5);
  });
});

describe("wynik snu", () => {
  it("dobra noc daje wyraźnie wyższy wynik niż zła", () => {
    const good = sleepScore(goodDay(), historyOf(goodDay, 10), profile);
    const bad = sleepScore(badDay(), historyOf(badDay, 10), profile);
    expect(good.value).toBeGreaterThan(80);
    expect(bad.value).toBeLessThan(50);
    expect(good.value).toBeGreaterThan(bad.value + 30);
  });

  it("brak danych obniża pewność, ale nie wywraca obliczeń", () => {
    const result = sleepScore({ date: "2026-07-20" }, [], profile);
    expect(result.value).toBe(0);
    expect(result.confidence).toBe("low");
    expect(result.inputsUsed).toBe(0);
  });

  it("suma udziałów składników równa się wynikowi", () => {
    const result = sleepScore(goodDay(), historyOf(goodDay, 10), profile);
    const sum = result.drivers.reduce((acc, d) => acc + d.contribution, 0);
    expect(Math.abs(sum - result.value)).toBeLessThanOrEqual(1);
  });

  it("nieregularne pory snu obniżają wynik przy tej samej długości snu", () => {
    const stable = historyOf((date) => ({ ...goodDay(date) }), 10);
    const shifting = stable.map((r, i) => ({
      ...r,
      sleep: { ...r.sleep!, bedtimeMinOfDay: i % 2 === 0 ? 1320 : 180 },
    }));
    const a = sleepScore(goodDay(), stable, profile);
    const b = sleepScore(goodDay(), shifting, profile);
    expect(a.value).toBeGreaterThan(b.value);
  });
});

describe("indeks stresu", () => {
  it("ocenia HRV względem bazy użytkownika, nie sztywnej normy", () => {
    const lowBaseline = buildBaseline(
      historyOf((date) => ({ ...goodDay(date), cardio: { restingHeartRate: 54, hrvMs: 28 } }), 20),
    );
    const record: DailyRecord = { date: "2026-07-20", cardio: { restingHeartRate: 54, hrvMs: 28 } };
    // HRV 28 ms to niska wartość bezwzględnie, ale dla tej osoby jest normą.
    const result = stressIndex(record, lowBaseline, profile);
    expect(result.value).toBeLessThan(45);
  });

  it("rozpoznaje spadek HRV poniżej własnej bazy", () => {
    const baseline = buildBaseline(historyOf(goodDay, 20));
    const stressed = stressIndex(
      { date: "2026-07-20", cardio: { restingHeartRate: 70, hrvMs: 30 }, subjective: { stress: 5 } },
      baseline,
      profile,
    );
    expect(stressed.value).toBeGreaterThan(60);
    expect(stressLevelFromIndex(stressed.value)).toMatch(/high|critical/);
  });

  it("progi poziomów stresu są monotoniczne", () => {
    expect(stressLevelFromIndex(10)).toBe("low");
    expect(stressLevelFromIndex(40)).toBe("moderate");
    expect(stressLevelFromIndex(60)).toBe("high");
    expect(stressLevelFromIndex(90)).toBe("critical");
  });
});

describe("Epigenetic Lifestyle Score", () => {
  it("sufit punktowy wynosi dokładnie 100", () => {
    expect(EPIGENETIC_MAX_POINTS).toBe(100);
  });

  it("dzień wzorcowy zdobywa komplet, trudny prawie nic", () => {
    const good = calculateEpigeneticScore(goodDay(), profile);
    const bad = calculateEpigeneticScore(badDay(), profile);
    expect(good.value).toBeGreaterThanOrEqual(95);
    expect(good.value).toBeLessThanOrEqual(100);
    expect(bad.value).toBeLessThan(25);
  });

  it("przyznaje punkty częściowe zamiast zero-jedynkowych", () => {
    const partial = calculateEpigeneticScore(
      { date: "2026-07-20", nutrition: { vegetableServings: 2.5, waterMl: 1000, alcoholUnits: 0 } },
      profile,
    );
    const veg = partial.awards.find((a) => a.key === "vegetables");
    expect(veg?.points).toBeCloseTo(7.5, 1);
    expect(veg?.complete).toBe(false);
  });

  it("nigdy nie przekracza 100 punktów", () => {
    const extreme = calculateEpigeneticScore(
      {
        date: "2026-07-20",
        sleep: { durationMin: 480 },
        nutrition: { vegetableServings: 50, waterMl: 9000, alcoholUnits: 0 },
        activity: { steps: 90_000, moderateVigorousMin: 400, walkMin: 400 },
        lifestyle: { meditationMin: 300, cigarettes: 0, screenBeforeBedMin: 0 },
      },
      profile,
    );
    expect(extreme.value).toBeLessThanOrEqual(100);
  });
});

describe("wiek biologiczny", () => {
  it("dobry styl życia daje wynik niższy od metrykalnego", () => {
    const history = historyOf(goodDay, 30);
    const result = estimateBiologicalAge(profile, history, buildBaseline(history));
    expect(result.deltaYears).toBeLessThan(0);
    expect(result.estimatedAge).toBeLessThan(profile.chronologicalAge);
    expect(result.confidence).toBe("high");
  });

  it("zły styl życia i palenie podnoszą wynik", () => {
    const history = historyOf(badDay, 30);
    const result = estimateBiologicalAge(
      { ...profile, smokingStatus: "current" },
      history,
      buildBaseline(history),
    );
    expect(result.deltaYears).toBeGreaterThan(5);
    expect(result.drivers.some((d) => d.key === "smoking")).toBe(true);
  });

  it("mieści się w realistycznych widełkach −10…+15 lat", () => {
    const good = estimateBiologicalAge(profile, historyOf(goodDay, 60), buildBaseline(historyOf(goodDay, 60)));
    const bad = estimateBiologicalAge(
      { ...profile, smokingStatus: "current" },
      historyOf(badDay, 60),
      buildBaseline(historyOf(badDay, 60)),
    );
    expect(good.deltaYears).toBeGreaterThanOrEqual(-10);
    expect(bad.deltaYears).toBeLessThanOrEqual(15);
  });

  it("brak danych obniża pewność i wskazuje braki", () => {
    const result = estimateBiologicalAge(profile, [{ date: "2026-07-20" }], buildBaseline([]));
    expect(result.confidence).toBe("low");
    expect(result.missingInputs.length).toBeGreaterThan(5);
  });
});

describe("układ nerwowy", () => {
  it("rozpoznaje regenerację przy wysokiej rezerwie i niskim pobudzeniu", () => {
    const history = historyOf(goodDay, 20);
    const baseline = buildBaseline(history);
    const panel = buildPanel(goodDay(), history, profile, baseline);
    expect(panel.nervousSystem.state).toBe("recovery");
  });

  it("rozpoznaje przeciążenie przy skumulowanym stresie", () => {
    const history = historyOf(badDay, 20);
    const baseline = buildBaseline(historyOf(goodDay, 20));
    const panel = buildPanel(badDay(), history, profile, baseline);
    expect(["overload", "fight"]).toContain(panel.nervousSystem.state);
    expect(panel.nervousSystem.rationale.length).toBeGreaterThan(0);
  });

  it("rozpoznaje zamrożenie: niska rezerwa i brak napędu", () => {
    const baseline = buildBaseline(historyOf(goodDay, 20));
    const frozen: DailyRecord = {
      date: "2026-07-22",
      cardio: { restingHeartRate: 55, hrvMs: 26 },
      activity: { steps: 900 },
      vendor: { bodyBattery: 22, trainingReadiness: 25, stressScore: 30 },
      subjective: { energy: 1, mood: 2, stress: 2 },
    };
    const result = assessNervousSystem(
      frozen,
      historyOf(goodDay, 10),
      baseline,
      { value: 25, confidence: "medium", drivers: [], inputsUsed: 3 },
      { value: 30, confidence: "medium", drivers: [], inputsUsed: 3 },
    );
    expect(result.state).toBe("freeze");
    expect(result.suggestedProtocols).toContain("energizing");
  });
});

describe("Garmin", () => {
  it("przy niskim Body Battery nie zaleca intensywnego treningu", () => {
    const record: DailyRecord = {
      date: "2026-07-22",
      cardio: { hrvMs: 30 },
      vendor: { bodyBattery: 32, trainingReadiness: 28, stressScore: 74, hrvStatus: "low", recoveryTimeH: 30 },
    };
    const baseline = buildBaseline(historyOf(goodDay, 20));
    const insight = buildGarminInsight(record, historyOf(badDay, 5), baseline);
    expect(["recovery", "rest"]).toContain(insight.recommendation);
    expect(insight.bullets.join(" ")).toContain("Body Battery wynosi 32/100");
    expect(insight.priorities.some((p) => p.includes("sen"))).toBe(true);
  });

  it("przy wysokiej gotowości dopuszcza mocny bodziec", () => {
    const record: DailyRecord = {
      date: "2026-07-22",
      cardio: { hrvMs: 64 },
      vendor: { bodyBattery: 88, trainingReadiness: 92, stressScore: 18, hrvStatus: "balanced", recoveryTimeH: 0 },
    };
    const insight = buildGarminInsight(record, historyOf(goodDay, 5), buildBaseline(historyOf(goodDay, 20)));
    expect(["hard", "moderate"]).toContain(insight.recommendation);
  });

  it("raport poranny zawiera fakty, wniosek i priorytety", () => {
    const record: DailyRecord = {
      date: "2026-07-22",
      cardio: { hrvMs: 30 },
      vendor: { bodyBattery: 32, trainingReadiness: 30, stressScore: 70, hrvStatus: "low" },
    };
    const report = buildGarminMorningReport(
      buildGarminInsight(record, historyOf(badDay, 5), buildBaseline(historyOf(goodDay, 20))),
    );
    expect(report).toContain("Body Battery");
    expect(report).toContain("Priorytet:");
  });

  it("bez danych Garmin zwraca instrukcję połączenia zamiast pustego raportu", () => {
    const insight = buildGarminInsight({ date: "2026-07-22" }, [], buildBaseline([]));
    expect(insight.available).toBe(false);
    expect(buildGarminMorningReport(insight)).toContain("Garmin Connect");
  });
});

describe("trendy i cyfrowy bliźniak", () => {
  it("wykrywa poprawę snu i ignoruje szum poniżej 3%", () => {
    const improving = historyOf((date) => ({ ...goodDay(date) }), 20).map((r, i) => ({
      ...r,
      sleep: { ...r.sleep!, durationMin: 380 + i * 6 },
    }));
    const trend = analyzeTrend(improving, "sleepMin", 30);
    expect(trend.direction).toBe("improving");
    expect(trend.changePct).toBeGreaterThan(3);

    const flat = historyOf((date) => ({ ...goodDay(date) }), 20).map((r, i) => ({
      ...r,
      sleep: { ...r.sleep!, durationMin: 450 + (i % 2) },
    }));
    expect(analyzeTrend(flat, "sleepMin", 30).direction).toBe("stable");
  });

  it("dla tętna spoczynkowego spadek oznacza poprawę", () => {
    const records = historyOf((date) => ({ ...goodDay(date) }), 20).map((r, i) => ({
      ...r,
      cardio: { ...r.cardio!, restingHeartRate: 70 - i },
    }));
    expect(analyzeTrend(records, "restingHeartRate", 30).direction).toBe("improving");
  });

  it("dojrzałość modelu rośnie wraz z liczbą dni", () => {
    const short = buildDigitalTwin(profile, historyOf(goodDay, 5), buildBaseline(historyOf(goodDay, 5)));
    const long = buildDigitalTwin(profile, historyOf(goodDay, 60), buildBaseline(historyOf(goodDay, 60)));
    expect(long.maturity).toBeGreaterThan(short.maturity);
    expect(long.maturity).toBeLessThanOrEqual(1);
  });

  it("prognozy mieszczą się w zakresach właściwych dla swojego typu", () => {
    const history = historyOf(badDay, 40);
    const twin = buildDigitalTwin(profile, history, buildBaseline(history));
    for (const prediction of twin.predictions) {
      if (prediction.kind === "probability") {
        expect(prediction.value).toBeGreaterThanOrEqual(0);
        expect(prediction.value).toBeLessThanOrEqual(1);
      }
      expect(prediction.explanation.length).toBeGreaterThan(10);
    }
  });

  it("wyznacza optymalną porę snu i okno treningowe", () => {
    const history = historyOf(goodDay, 30);
    const twin = buildDigitalTwin(profile, history, buildBaseline(history));
    expect(twin.optimalBedtimeMinOfDay).toBeDefined();
    expect(twin.optimalTrainingWindow?.startHour).toBeGreaterThan(6);
  });
});

describe("misje i gamifikacja", () => {
  it("dobiera misje do stanu użytkownika i zawsze podaje uzasadnienie", () => {
    const history = historyOf(badDay, 14);
    const panel = buildPanel(badDay(), history, profile, buildBaseline(history));
    const missions = generateDailyMissions(panel, history, profile);
    expect(missions).toHaveLength(5);
    for (const mission of missions) {
      expect(mission.reason.length).toBeGreaterThan(5);
      expect(mission.xp).toBeGreaterThan(0);
    }
  });

  it("przy przeciążeniu obniża próg kroków zamiast go podnosić", () => {
    const history = historyOf(badDay, 14);
    const panel = buildPanel(badDay(), history, profile, buildBaseline(historyOf(goodDay, 14)));
    const missions = generateDailyMissions(panel, history, profile);
    const steps = missions.find((m) => m.id === "steps");
    if (steps) expect(steps.target).toBeLessThanOrEqual(profile.targetSteps!);
  });

  it("misje typu „mniej znaczy lepiej” liczą postęp odwrotnie", () => {
    const history = historyOf(goodDay, 14);
    const panel = buildPanel(goodDay(), history, profile, buildBaseline(history));
    const missions = generateDailyMissions(panel, history, profile);
    const screenMission = missions.find((m) => m.metric === "screenBeforeBedMin");
    if (screenMission) {
      const done = evaluateMissions([screenMission], { date: "x", lifestyle: { screenBeforeBedMin: 0 } });
      const failed = evaluateMissions([screenMission], { date: "x", lifestyle: { screenBeforeBedMin: 90 } });
      expect(done[0].complete).toBe(true);
      expect(failed[0].complete).toBe(false);
    }
  });

  it("krzywa poziomów jest rosnąca i odwracalna", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(50_000).level).toBeGreaterThan(levelFromXp(5000).level);
    const state = levelFromXp(1234);
    expect(state.xpIntoLevel).toBeLessThan(state.xpForNextLevel);
  });

  it("seria wybacza jeden dzień, ale nie dwa z rzędu", () => {
    const base = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];
    const withOneGap = calculateStreak(
      base.map((date, i) => ({ date, active: i !== 2 })),
    );
    expect(withOneGap.current).toBe(4);

    const withTwoGaps = calculateStreak(
      base.map((date, i) => ({ date, active: i !== 2 && i !== 3 })),
    );
    expect(withTwoGaps.current).toBeLessThan(4);
  });
});

describe("dieta", () => {
  it("proponuje konkretne uzupełnienie braków, nie ogólniki", () => {
    const analysis = analyzeNutrition(badDay(), profile);
    expect(analysis.suggestions.length).toBeGreaterThan(0);
    expect(analysis.suggestions.some((s) => /g białka/.test(s))).toBe(true);
    expect(analysis.qualityScore).toBeLessThan(55);
  });

  it("dobry dzień nie generuje sztucznych zastrzeżeń", () => {
    const analysis = analyzeNutrition(goodDay(), profile);
    expect(analysis.qualityScore).toBeGreaterThan(80);
    expect(analysis.gaps.filter((g) => g.status === "off")).toHaveLength(0);
  });

  it("cel kaloryczny rośnie wraz z aktywnością", () => {
    const rest = analyzeNutrition({ date: "d", activity: { steps: 1500, moderateVigorousMin: 0 } }, profile);
    const active = analyzeNutrition({ date: "d", activity: { steps: 16_000, moderateVigorousMin: 90 } }, profile);
    expect(active.targets.kcal).toBeGreaterThan(rest.targets.kcal);
  });
});

describe("katalogi treści", () => {
  it("każdy protokół oddechowy ma dodatnią długość cyklu", () => {
    for (const protocol of BREATHING_PROTOCOLS) {
      expect(cycleSeconds(protocol)).toBeGreaterThan(0);
      expect(protocol.phases.length).toBeGreaterThan(0);
    }
  });

  it("faza oddechu jest wyznaczana deterministycznie w czasie", () => {
    const box = BREATHING_PROTOCOLS.find((p) => p.id === "box")!;
    expect(phaseAt(box, 0).phase.kind).toBe("inhale");
    expect(phaseAt(box, 5).phase.kind).toBe("hold");
    expect(phaseAt(box, 9).phase.kind).toBe("exhale");
    expect(phaseAt(box, 13).phase.kind).toBe("holdEmpty");
    expect(phaseAt(box, 16.1).cycleIndex).toBe(1);
  });

  it("skala animacji rośnie na wdechu i maleje na wydechu", () => {
    expect(scaleForPhase("inhale", 0)).toBeLessThan(scaleForPhase("inhale", 1));
    expect(scaleForPhase("exhale", 0)).toBeGreaterThan(scaleForPhase("exhale", 1));
  });

  it("protokół Wima Hofa wymaga zgody i ma ostrzeżenia", () => {
    const wimHof = BREATHING_PROTOCOLS.find((p) => p.id === "wim-hof")!;
    expect(wimHof.requiresConsent).toBe(true);
    expect(wimHof.cautions.length).toBeGreaterThan(2);
  });

  it("każda sesja ma scenariusz o sensownej długości", () => {
    for (const session of MEDITATION_SESSIONS) {
      expect(session.script.length).toBeGreaterThan(0);
      expect(scriptSeconds(session)).toBeGreaterThan(60);
      expect(session.purpose.length).toBeGreaterThan(20);
    }
  });

  it("rekomendacje sesji zależą od stanu układu nerwowego", () => {
    expect(recommendSessions("fight").length).toBeGreaterThan(0);
    expect(recommendSessions("freeze").every((s) => s.recommendedFor.includes("freeze"))).toBe(true);
  });

  it("Garmin jest integracją o najwyższym priorytecie", () => {
    const sorted = [...DEVICE_INTEGRATIONS].sort((a, b) => a.priority - b.priority);
    expect(sorted[0].id).toBe("garmin");
    expect(sorted[0].metrics).toContain("bodyBattery");
  });
});

describe("pełna analiza dnia", () => {
  it("składa spójny panel na danych demonstracyjnych", () => {
    const history = generateDemoHistory(90);
    const today = history[history.length - 1];
    const analysis = analyzeDay(today, history, DEMO_PROFILE);

    expect(analysis.panel.date).toBe(today.date);
    expect(analysis.panel.longevityIndex.value).toBeGreaterThan(0);
    expect(analysis.panel.longevityIndex.value).toBeLessThanOrEqual(100);
    expect(analysis.missions).toHaveLength(5);
    expect(analysis.missionProgress).toHaveLength(5);
    expect(analysis.gamification.level).toBeGreaterThanOrEqual(1);
    expect(analysis.report.insights.length).toBeGreaterThan(0);
    expect(analysis.report.disclaimer).toContain("nie diagnoza");
  });

  it("wszystkie wyniki mieszczą się w zakresie 0–100", () => {
    const history = generateDemoHistory(60);
    const analysis = analyzeDay(history[history.length - 1], history, DEMO_PROFILE);
    const { panel } = analysis;
    const scores = [
      panel.sleepScore.value,
      panel.stressIndex.value,
      panel.recoveryScore.value,
      panel.energyScore.value,
      panel.brainRecoveryScore.value,
      panel.cardiovascularScore.value,
      panel.metabolicScore.value,
      panel.longevityIndex.value,
      panel.epigeneticScore.value,
      panel.nervousSystem.balanceScore,
    ];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("działa dla użytkownika bez żadnych danych", () => {
    const analysis = analyzeDay({ date: "2026-07-28" }, [], profile);
    expect(analysis.panel.biologicalAge.confidence).toBe("low");
    expect(analysis.missions).toHaveLength(5);
    expect(analysis.report.headline.length).toBeGreaterThan(5);
  });

  it("generator demo jest deterministyczny", () => {
    const a = generateDemoHistory(30, "2026-07-20");
    const b = generateDemoHistory(30, "2026-07-20");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("raport zawsze niesie zastrzeżenie o braku diagnozy", () => {
    const history = generateDemoHistory(30);
    const analysis = analyzeDay(history[history.length - 1], history, DEMO_PROFILE);
    expect(analysis.report.disclaimer.length).toBeGreaterThan(40);
    expect(analysis.report.disclaimer.toLowerCase()).toContain("lekarz");
  });

  it("sygnały alarmowe podnoszą wskazówkę bezpieczeństwa na pierwszy priorytet", () => {
    const history = generateDemoHistory(30);
    const today: DailyRecord = { ...history[history.length - 1], cardio: { ...history[history.length - 1].cardio, spo2: 86 } };
    const analysis = analyzeDay(today, history, DEMO_PROFILE);
    expect(analysis.report.insights[0].category).toBe("safety");
  });
});
