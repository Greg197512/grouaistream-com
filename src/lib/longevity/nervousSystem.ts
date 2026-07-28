/**
 * Ocena stanu układu nerwowego (autonomicznego).
 *
 * Model opiera się na dwóch osiach, a nie na jednej skali „stres wysoki/niski”:
 *
 *   • POBUDZENIE (arousal)  — aktywacja współczulna: tętno spoczynkowe powyżej
 *     bazy, wysoki Stress Score, przyspieszony oddech, odczuwane napięcie.
 *   • REZERWA (vagal)       — pojemność przywspółczulna: HRV względem własnej
 *     bazy, gotowość z urządzenia, jakość snu.
 *
 * Dopiero kombinacja obu osi rozróżnia stany, które w prostych aplikacjach
 * zlewają się w jedno:
 *
 *   REGENERACJA  — niska aktywacja, wysoka rezerwa.
 *   WALKA        — wysoka aktywacja, rezerwa jeszcze obecna (mobilizacja).
 *   PRZECIĄŻENIE — wysoka aktywacja utrzymywana wiele dni, rezerwa spada.
 *   ZAMROŻENIE   — niska aktywacja ORAZ niska rezerwa i niska aktywność —
 *                  organizm nie mobilizuje się, mimo że nie jest wypoczęty.
 *
 * To interpretacja danych z urządzeń konsumenckich, a nie ocena neurologiczna.
 */

import type {
  Confidence,
  DailyRecord,
  NervousSystemAssessment,
  NervousSystemState,
  ScoreResult,
  TwinBaseline,
} from "./types";
import { clamp01, confidenceFromCoverage, mean, normalize, round, zScore } from "./math";

export const NERVOUS_STATE_LABEL: Record<NervousSystemState, string> = {
  recovery: "Regeneracja",
  overload: "Przeciążenie",
  fight: "Walka / mobilizacja",
  freeze: "Zamrożenie",
};

export const NERVOUS_STATE_DESCRIPTION: Record<NervousSystemState, string> = {
  recovery:
    "Organizm jest w trybie odbudowy. Rezerwa przywspółczulna jest dostępna — to dobry dzień na trening, naukę i wymagające zadania.",
  overload:
    "Wysokie pobudzenie utrzymuje się od kilku dni, a rezerwa regeneracyjna spada. Priorytetem jest sen i obniżenie obciążenia, nie kolejny bodziec.",
  fight:
    "Układ nerwowy jest zmobilizowany: podwyższone tętno i napięcie przy zachowanej rezerwie. Krótki wysiłek jest w porządku, ale wieczór zaplanuj wyciszająco.",
  freeze:
    "Niska aktywacja i jednocześnie niska rezerwa — typowy obraz po długim okresie obciążenia. Pomaga delikatny ruch i światło, nie intensywny trening.",
};

/** Protokoły oddechowe dobrane do stanu — identyfikatory z katalogu ćwiczeń. */
const PROTOCOLS: Record<NervousSystemState, string[]> = {
  recovery: ["coherent", "box"],
  overload: ["478", "coherent", "extended-exhale"],
  fight: ["extended-exhale", "478", "physiological-sigh"],
  freeze: ["energizing", "box", "wim-hof"],
};

export const assessNervousSystem = (
  record: DailyRecord,
  history: DailyRecord[],
  baseline: TwinBaseline,
  recovery: ScoreResult,
  stress: ScoreResult,
): NervousSystemAssessment => {
  const rationale: string[] = [];

  // ── Oś 1: pobudzenie ───────────────────────────────────────────────────────
  const rhr = record.cardio?.restingHeartRate ?? record.sleep?.avgHeartRate;
  const rhrBase = baseline.restingHeartRate;
  const rhrSd = baseline.restingHeartRateSd && baseline.restingHeartRateSd > 0 ? baseline.restingHeartRateSd : 4;
  const rhrArousal =
    rhr !== undefined && rhrBase !== undefined ? clamp01(zScore(rhr, rhrBase, rhrSd) / 2.5) : undefined;
  if (rhr !== undefined && rhrBase !== undefined && rhr - rhrBase >= 4) {
    rationale.push(`Tętno spoczynkowe ${Math.round(rhr)} bpm, o ${Math.round(rhr - rhrBase)} bpm powyżej Twojej bazy.`);
  }

  const vendorStress = record.vendor?.stressScore;
  const vendorArousal = vendorStress === undefined ? undefined : clamp01(vendorStress / 100);
  if (vendorStress !== undefined && vendorStress >= 60) {
    rationale.push(`Stress Score z urządzenia: ${Math.round(vendorStress)}/100.`);
  }

  const subjectiveArousal =
    record.subjective?.stress === undefined ? undefined : normalize(record.subjective.stress, 1, 5);

  const respiration = record.cardio?.respirationRate ?? record.sleep?.respirationRate;
  const respirationArousal = respiration === undefined ? undefined : normalize(respiration, 12, 20);

  const arousalParts = [rhrArousal, vendorArousal, subjectiveArousal, respirationArousal].filter(
    (v): v is number => v !== undefined,
  );
  const arousal = arousalParts.length ? mean(arousalParts) : stress.value / 100;

  // ── Oś 2: rezerwa przywspółczulna ──────────────────────────────────────────
  const hrv = record.cardio?.hrvMs ?? record.sleep?.avgHrvMs;
  const hrvBase = baseline.hrvMs;
  const hrvSd = baseline.hrvSd && baseline.hrvSd > 0 ? baseline.hrvSd : (hrvBase ?? 40) * 0.18;
  const hrvReserve =
    hrv !== undefined && hrvBase !== undefined ? clamp01(0.5 + zScore(hrv, hrvBase, hrvSd) / 3) : undefined;
  if (hrv !== undefined && hrvBase !== undefined) {
    const deltaPct = ((hrv - hrvBase) / hrvBase) * 100;
    if (deltaPct <= -12) rationale.push(`HRV niższe o ${Math.abs(Math.round(deltaPct))}% względem Twojej bazy.`);
    if (deltaPct >= 12) rationale.push(`HRV wyższe o ${Math.round(deltaPct)}% względem Twojej bazy.`);
  }

  const readiness = record.vendor?.trainingReadiness ?? record.vendor?.readinessScore;
  const readinessReserve = readiness === undefined ? undefined : clamp01(readiness / 100);

  const battery = record.vendor?.bodyBattery;
  const batteryReserve = battery === undefined ? undefined : clamp01(battery / 100);
  if (battery !== undefined && battery <= 35) {
    rationale.push(`Body Battery na poziomie ${Math.round(battery)}/100.`);
  }

  const reserveParts = [hrvReserve, readinessReserve, batteryReserve].filter(
    (v): v is number => v !== undefined,
  );
  const reserve = reserveParts.length ? mean(reserveParts) : recovery.value / 100;

  // ── Oś 3: napęd behawioralny (odróżnia „walkę” od „zamrożenia”) ────────────
  const steps = record.activity?.steps;
  const stepsBase = baseline.steps ?? 8000;
  const stepDrive = steps === undefined ? undefined : clamp01(steps / Math.max(stepsBase, 3000));
  const energyDrive =
    record.subjective?.energy === undefined ? undefined : normalize(record.subjective.energy, 1, 5);
  const moodDrive =
    record.subjective?.mood === undefined ? undefined : normalize(record.subjective.mood, 1, 5);
  const driveParts = [stepDrive, energyDrive, moodDrive].filter((v): v is number => v !== undefined);
  const drive = driveParts.length ? mean(driveParts) : 0.5;

  // ── Wymiar wielodniowy: czy obciążenie się kumuluje? ───────────────────────
  const recent = history.slice(-5);
  const hrvSeries = recent
    .map((r) => r.cardio?.hrvMs ?? r.sleep?.avgHrvMs)
    .filter((v): v is number => v !== undefined);
  const stressSeries = recent
    .map((r) => r.vendor?.stressScore ?? (r.subjective?.stress ? r.subjective.stress * 20 : undefined))
    .filter((v): v is number => v !== undefined);

  const hrvSuppressedDays =
    hrvBase === undefined ? 0 : hrvSeries.filter((v) => v < hrvBase * 0.9).length;
  const highStressDays = stressSeries.filter((v) => v >= 60).length;
  const cumulativeLoad = hrvSuppressedDays >= 3 || highStressDays >= 3;

  if (highStressDays >= 3) {
    rationale.push(`Podwyższony stres utrzymuje się od ${highStressDays} z ostatnich ${recent.length} dni.`);
  }
  if (hrvSuppressedDays >= 3) {
    rationale.push(`HRV poniżej bazy przez ${hrvSuppressedDays} z ostatnich ${recent.length} dni.`);
  }

  // ── Klasyfikacja ───────────────────────────────────────────────────────────
  let state: NervousSystemState;
  if (arousal >= 0.55 && (cumulativeLoad || reserve < 0.35)) {
    state = "overload";
  } else if (arousal >= 0.55) {
    state = "fight";
  } else if (reserve < 0.42 && drive < 0.45) {
    state = "freeze";
  } else if (reserve >= 0.55 && arousal < 0.45) {
    state = "recovery";
  } else if (reserve < 0.42) {
    state = "overload";
  } else {
    // Strefa pośrednia: rozstrzyga to, która oś jest bliżej swojego krańca.
    state = arousal > 1 - reserve ? "fight" : "recovery";
  }

  const balanceScore = round(
    clamp01(reserve * 0.5 + (1 - arousal) * 0.35 + (1 - Math.abs(drive - 0.6)) * 0.15) * 100,
  );

  if (rationale.length === 0) {
    rationale.push(
      reserve >= 0.55
        ? "Rezerwa regeneracyjna mieści się w Twoim typowym zakresie."
        : "Dane mieszczą się w Twoim typowym zakresie — brak wyraźnych odchyleń.",
    );
  }

  const confidence: Confidence = confidenceFromCoverage(
    arousalParts.length * 1.5 + reserveParts.length * 2 + driveParts.length,
    4 * 1.5 + 3 * 2 + 3,
  );

  return {
    state,
    confidence,
    balanceScore,
    rationale,
    suggestedProtocols: PROTOCOLS[state],
  };
};
