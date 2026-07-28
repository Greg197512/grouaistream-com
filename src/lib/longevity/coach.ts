/**
 * AI Coach — warstwa rekomendacji.
 *
 * Architektura jest dwuwarstwowa i to celowe:
 *
 *  1. WARSTWA REGUŁ (ten plik) — deterministyczna. Z danych powstaje zestaw
 *     `CoachInsight` z priorytetami. Działa offline, jest testowalna i zawsze
 *     zwraca to samo dla tych samych danych. To ona odpowiada za treść porady.
 *  2. WARSTWA JĘZYKOWA (edge function `stop-aging-coach`) — model językowy
 *     dostaje TE SAME wnioski w postaci ustrukturyzowanej i jedynie ubiera je
 *     w rozmowę. Model nie wymyśla liczb ani zaleceń zdrowotnych od zera.
 *
 * Dzięki temu awaria lub halucynacja modelu nie zmienia merytoryki porady,
 * a użytkownik bez internetu nadal dostaje sensowne wskazówki.
 */

import type {
  CoachInsight,
  CoachReport,
  DailyRecord,
  DigitalTwin,
  LongevityPanel,
  UserProfile,
} from "./types";
import { formatDuration, formatMinuteOfDay, round } from "./math";
import { NERVOUS_STATE_LABEL } from "./nervousSystem";
import { buildGarminInsight } from "./garmin";
import { analyzeTrend } from "./digitalTwin";
import { analyzeNutrition } from "./nutrition";
import { SLEEP_TARGET_MIN } from "./norms";

export const MEDICAL_DISCLAIMER =
  "To wskazówka oparta na Twoich danych, a nie diagnoza medyczna. Aplikacja nie zastępuje konsultacji z lekarzem ani badań. W razie niepokojących objawów skontaktuj się z lekarzem.";

/**
 * Sygnały, przy których aplikacja przestaje doradzać styl życia i kieruje
 * do lekarza. Świadomie konserwatywne — lepiej odesłać do specjalisty
 * o jeden raz za dużo niż zbagatelizować sygnał.
 */
export const buildSafetyInsights = (record: DailyRecord, history: DailyRecord[]): CoachInsight[] => {
  const insights: CoachInsight[] = [];

  const spo2 = record.cardio?.spo2 ?? record.sleep?.avgSpo2;
  if (spo2 !== undefined && spo2 < 90) {
    insights.push({
      id: "safety-spo2",
      priority: 1,
      title: "Niska saturacja w pomiarze z urządzenia",
      body: `Zarejestrowana saturacja to ${Math.round(spo2)}%. Pomiary z zegarków bywają zaniżone przy chłodnych dłoniach lub luźnym pasku, ale utrzymujący się taki wynik warto skonsultować.`,
      actions: [
        "Powtórz pomiar w spoczynku, z ciepłą dłonią i dobrze dopasowanym paskiem",
        "Jeśli wynik się powtarza — umów konsultację lekarską",
      ],
      basedOn: ["SpO₂"],
      category: "safety",
    });
  }

  const rhrSeries = history
    .slice(-7)
    .map((r) => r.cardio?.restingHeartRate)
    .filter((v): v is number => v !== undefined);
  if (rhrSeries.length >= 5 && rhrSeries.slice(-3).every((v) => v > 90)) {
    insights.push({
      id: "safety-rhr",
      priority: 1,
      title: "Utrzymujące się wysokie tętno spoczynkowe",
      body: "Tętno spoczynkowe przekracza 90 uderzeń na minutę przez trzy kolejne dni. Przyczyną bywa infekcja, odwodnienie lub przemęczenie, ale utrzymujący się stan wymaga oceny lekarskiej.",
      actions: ["Ogranicz intensywny wysiłek", "Zadbaj o nawodnienie i sen", "Skonsultuj się z lekarzem, jeśli stan się utrzymuje"],
      basedOn: ["Tętno spoczynkowe (7 dni)"],
      category: "safety",
    });
  }

  const temp = record.body?.bodyTempC;
  if (temp !== undefined && temp >= 38) {
    insights.push({
      id: "safety-fever",
      priority: 1,
      title: "Podwyższona temperatura ciała",
      body: `Zarejestrowano ${round(temp, 1)}°C. W takim stanie treningi i protokoły hormetyczne (zimno, sauna, hiperwentylacja) są wstrzymane.`,
      actions: ["Odpoczynek i nawodnienie", "Wstrzymaj treningi do ustąpienia objawów"],
      basedOn: ["Temperatura ciała"],
      category: "safety",
    });
  }

  return insights;
};

/**
 * Główny generator wniosków. Zwraca listę posortowaną wg priorytetu —
 * UI pokazuje zwykle 3 pierwsze, raport dzienny wszystkie.
 */
export const generateInsights = (
  panel: LongevityPanel,
  record: DailyRecord,
  history: DailyRecord[],
  twin: DigitalTwin,
  profile: UserProfile,
): CoachInsight[] => {
  const insights: CoachInsight[] = [...buildSafetyInsights(record, history)];

  // ── Sen ────────────────────────────────────────────────────────────────────
  const targetSleep = profile.targetSleepMin ?? SLEEP_TARGET_MIN;
  const sleepMin = record.sleep?.durationMin;
  if (sleepMin !== undefined && sleepMin < targetSleep - 30) {
    const deficit = Math.round((targetSleep - sleepMin) / 15) * 15;
    insights.push({
      id: "sleep-deficit",
      priority: 2,
      title: `Dziś połóż się ${deficit} minut wcześniej`,
      body: `Ostatniej nocy przespałeś ${formatDuration(sleepMin)} przy celu ${formatDuration(targetSleep)}.${
        twin.optimalBedtimeMinOfDay !== undefined
          ? ` Twoja optymalna pora zaśnięcia wyliczona z historii to ${formatMinuteOfDay(twin.optimalBedtimeMinOfDay)}.`
          : ""
      }`,
      actions: [
        `Ustaw przypomnienie o wyciszeniu 45 minut przed snem`,
        "Ostatnia kawa najpóźniej 8 godzin przed pójściem spać",
        "Wieczorem przygaś światło — to sygnał dla rytmu dobowego",
      ],
      basedOn: ["Długość snu", "Historia pór zaśnięcia"],
      category: "sleep",
    });
  }

  const sleepRegularityDriver = panel.sleepScore.drivers.find((d) => d.key === "regularity");
  if (sleepRegularityDriver && sleepRegularityDriver.normalized < 0.5) {
    insights.push({
      id: "sleep-regularity",
      priority: 3,
      title: "Nieregularne pory snu obniżają jakość regeneracji",
      body: "Twoje godziny zaśnięcia różnią się z dnia na dzień na tyle mocno, że rytm dobowy nie ma stałego punktu odniesienia. Regularność wpływa na regenerację silniej niż pojedyncza długa noc.",
      actions: [
        "Wybierz jedną porę pobudki i utrzymaj ją również w weekend",
        "15 minut światła dziennego w ciągu godziny od przebudzenia",
      ],
      basedOn: ["Rozrzut pór zaśnięcia"],
      category: "sleep",
    });
  }

  // ── Stres i układ nerwowy ──────────────────────────────────────────────────
  if (panel.stressLevel === "high" || panel.stressLevel === "critical") {
    insights.push({
      id: "stress-high",
      priority: panel.stressLevel === "critical" ? 1 : 2,
      title:
        panel.stressLevel === "critical"
          ? "Poziom obciążenia jest krytyczny — dziś priorytetem jest regeneracja"
          : "Podwyższony poziom stresu",
      body: `Indeks stresu wynosi ${panel.stressIndex.value}/100. Stan układu nerwowego: ${NERVOUS_STATE_LABEL[panel.nervousSystem.state].toLowerCase()}. ${panel.nervousSystem.rationale[0] ?? ""}`,
      actions: [
        "10 minut oddechu z wydłużonym wydechem (4 sekundy wdech, 8 sekund wydech)",
        "Spacer 30 minut w tempie rozmowy",
        "Przełóż wymagające rozmowy na jutro, jeśli to możliwe",
      ],
      basedOn: ["HRV względem bazy", "Tętno spoczynkowe", "Stress Score"],
      category: "stress",
    });
  }

  if (panel.nervousSystem.state === "freeze") {
    insights.push({
      id: "nervous-freeze",
      priority: 2,
      title: "Niska aktywacja przy niskiej rezerwie",
      body: "Organizm nie mobilizuje się, mimo że nie jest wypoczęty. W tym stanie intensywny trening zwykle pogłębia problem, a pomaga łagodny bodziec i światło.",
      actions: [
        "Wyjdź na 20 minut na światło dzienne, najlepiej przed południem",
        "Oddech aktywujący: wdech 6 sekund, wydech 2 sekundy, przez 3 minuty",
        "Zaplanuj jedną małą, konkretną rzecz do zrobienia",
      ],
      basedOn: ["HRV", "Aktywność", "Samopoczucie"],
      category: "nervous",
    });
  }

  if (panel.nervousSystem.state === "overload") {
    insights.push({
      id: "nervous-overload",
      priority: 2,
      title: "Obciążenie kumuluje się od kilku dni",
      body: panel.nervousSystem.rationale.join(" "),
      actions: [
        "Dzisiaj bez jednostki jakościowej — spacer lub joga",
        "Sen o godzinę dłuższy niż zwykle",
        "Sesja oddechu rezonansowego 10 minut",
      ],
      basedOn: ["HRV (5 dni)", "Stress Score (5 dni)", "Regeneracja"],
      category: "nervous",
    });
  }

  // ── Garmin ─────────────────────────────────────────────────────────────────
  const garmin = buildGarminInsight(record, history, twin.baseline);
  if (garmin.available) {
    insights.push({
      id: "garmin-training",
      priority: garmin.recommendation === "rest" || garmin.recommendation === "recovery" ? 2 : 3,
      title:
        garmin.recommendation === "hard"
          ? "Organizm jest gotowy na mocniejszy bodziec"
          : garmin.recommendation === "moderate"
            ? "Trening umiarkowany zamiast jednostki jakościowej"
            : garmin.recommendation === "easy"
              ? "Dziś lekki wysiłek"
              : garmin.recommendation === "recovery"
                ? "Dziś nie zalecamy intensywnego treningu"
                : "Dzień bez treningu",
      body: garmin.bullets.join(" "),
      actions: garmin.priorities,
      basedOn: ["Body Battery", "Training Readiness", "HRV Status", "Recovery Time"].filter(
        (_, i) =>
          [garmin.bodyBattery, garmin.trainingReadiness, garmin.hrvStatus, garmin.recoveryTimeH][i] !== undefined,
      ),
      category: "recovery",
    });
  }

  // ── Dieta ──────────────────────────────────────────────────────────────────
  if (record.nutrition) {
    const nutrition = analyzeNutrition(record, profile);
    if (nutrition.suggestions.length > 0) {
      insights.push({
        id: "nutrition",
        priority: 4,
        title: "Poprawki w diecie na dziś",
        body: `Jakość diety w tym dniu: ${nutrition.qualityScore}/100.`,
        actions: nutrition.suggestions.slice(0, 3),
        basedOn: nutrition.gaps.filter((g) => g.status !== "ok").map((g) => g.label),
        category: "nutrition",
      });
    }
  }

  // ── Aktywność ──────────────────────────────────────────────────────────────
  const steps = record.activity?.steps;
  const stepBase = twin.baseline.steps;
  if (steps !== undefined && stepBase !== undefined && steps < stepBase * 0.6 && panel.recoveryScore.value >= 55) {
    insights.push({
      id: "activity-low",
      priority: 4,
      title: "Dziś znacznie mniej ruchu niż zwykle",
      body: `${Math.round(steps).toLocaleString("pl-PL")} kroków przy Twojej typowej wartości ${Math.round(stepBase).toLocaleString("pl-PL")}. Regeneracja jest na poziomie ${panel.recoveryScore.value}/100, więc ciało uniesie spacer.`,
      actions: ["20 minut spaceru po pracy", "Wysiądź przystanek wcześniej", "Rozciąganie 10 minut wieczorem"],
      basedOn: ["Kroki", "Regeneracja"],
      category: "activity",
    });
  }

  // ── Trendy ─────────────────────────────────────────────────────────────────
  const sleepTrend = analyzeTrend(history, "sleepMin", 30);
  if (sleepTrend.coverage >= 10 && sleepTrend.direction === "improving") {
    insights.push({
      id: "trend-sleep-positive",
      priority: 5,
      title: `Sen poprawił się o ${Math.abs(sleepTrend.changePct)}% w ostatnich ${sleepTrend.coverage} dniach`,
      body: `Średnia długość snu w tym oknie to ${formatDuration(sleepTrend.mean)}. Szacowany wpływ na regenerację jest pozytywny — to trend, który warto utrzymać.`,
      actions: ["Utrzymaj obecną porę zaśnięcia", "Nie zwiększaj obciążenia treningowego skokowo"],
      basedOn: ["Trend snu 30 dni"],
      category: "sleep",
    });
  }

  const hrvTrend = analyzeTrend(history, "hrvMs", 30);
  if (hrvTrend.coverage >= 10 && hrvTrend.direction === "declining") {
    insights.push({
      id: "trend-hrv-negative",
      priority: 3,
      title: `HRV spada w trendzie 30-dniowym (${hrvTrend.changePct}%)`,
      body: "Spadek zmienności rytmu serca utrzymujący się przez kilka tygodni zwykle poprzedza spadek formy. Najczęstsze przyczyny to niedobór snu, kumulacja obciążeń i przewlekły stres.",
      actions: [
        "Zaplanuj tydzień z obniżoną objętością treningu",
        "Priorytet dla snu: stała pora, 7,5–8,5 godziny",
        "Codzienna 10-minutowa sesja oddechu rezonansowego",
      ],
      basedOn: ["Trend HRV 30 dni"],
      category: "recovery",
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
};

/** Nagłówek raportu — jedno zdanie, które użytkownik zobaczy jako pierwsze. */
const buildHeadline = (panel: LongevityPanel): string => {
  if (panel.stressLevel === "critical") return "Dziś priorytetem jest regeneracja, nie wyniki.";
  if (panel.nervousSystem.state === "overload") return "Organizm sygnalizuje przeciążenie — zejdź o stopień niżej.";
  if (panel.nervousSystem.state === "freeze") return "Niska energia i niska rezerwa — zacznij od światła i ruchu.";
  if (panel.recoveryScore.value >= 80 && panel.energyScore.value >= 75)
    return "Dobry dzień na wysiłek — regeneracja i energia są po Twojej stronie.";
  if (panel.sleepScore.value < 60) return "Sen z ostatniej nocy będzie dziś odczuwalny — zaplanuj lżejszy dzień.";
  return "Stabilny dzień — utrzymaj to, co działa.";
};

export const buildCoachReport = (
  panel: LongevityPanel,
  record: DailyRecord,
  history: DailyRecord[],
  twin: DigitalTwin,
  profile: UserProfile,
): CoachReport => {
  const insights = generateInsights(panel, record, history, twin, profile);

  const summary = [
    `Wiek biologiczny: ${panel.biologicalAge.estimatedAge} lat (${panel.biologicalAge.deltaYears > 0 ? "+" : ""}${panel.biologicalAge.deltaYears} względem metrykalnego).`,
    `Regeneracja ${panel.recoveryScore.value}/100, sen ${panel.sleepScore.value}/100, energia ${panel.energyScore.value}/100.`,
    `Indeks stresu ${panel.stressIndex.value}/100. Układ nerwowy: ${NERVOUS_STATE_LABEL[panel.nervousSystem.state].toLowerCase()}.`,
    `Epigenetic Lifestyle Score: ${panel.epigeneticScore.value}/100.`,
  ].join(" ");

  return {
    date: panel.date,
    headline: buildHeadline(panel),
    summary,
    insights,
    disclaimer: MEDICAL_DISCLAIMER,
  };
};

/**
 * Kontekst przekazywany modelowi językowemu. Zawiera wyłącznie liczby
 * i wnioski wyliczone lokalnie — model ma je przeformułować, nie wymyślić.
 * Nie wysyłamy tu żadnych danych identyfikujących użytkownika.
 */
export const buildCoachContext = (
  panel: LongevityPanel,
  twin: DigitalTwin,
  report: CoachReport,
  profile: UserProfile,
): Record<string, unknown> => ({
  locale: profile.locale ?? "pl",
  date: panel.date,
  profile: {
    ageBand: `${Math.floor(profile.chronologicalAge / 10) * 10}-${Math.floor(profile.chronologicalAge / 10) * 10 + 9}`,
    sex: profile.sex,
  },
  scores: {
    biologicalAge: panel.biologicalAge.estimatedAge,
    biologicalAgeDelta: panel.biologicalAge.deltaYears,
    recoveryAge: panel.recoveryAge,
    sleep: panel.sleepScore.value,
    stress: panel.stressIndex.value,
    stressLevel: panel.stressLevel,
    recovery: panel.recoveryScore.value,
    energy: panel.energyScore.value,
    epigenetic: panel.epigeneticScore.value,
    brain: panel.brainRecoveryScore.value,
    cardiovascular: panel.cardiovascularScore.value,
    metabolic: panel.metabolicScore.value,
    longevityIndex: panel.longevityIndex.value,
  },
  nervousSystem: {
    state: panel.nervousSystem.state,
    balance: panel.nervousSystem.balanceScore,
    rationale: panel.nervousSystem.rationale,
  },
  twin: {
    maturity: twin.maturity,
    baselineDays: twin.baseline.days,
    optimalBedtime: twin.optimalBedtimeMinOfDay,
    predictions: twin.predictions.map((p) => ({ key: p.key, label: p.label, value: p.value, unit: p.unit })),
  },
  insights: report.insights.map((i) => ({
    priority: i.priority,
    title: i.title,
    actions: i.actions,
    basedOn: i.basedOn,
    category: i.category,
  })),
});

/**
 * Systemowy prompt trenera. Jest tu, a nie w edge function, bo stanowi część
 * kontraktu produktowego — te same zasady obowiązują niezależnie od dostawcy
 * modelu (OpenAI, Claude, Gemini).
 */
export const COACH_SYSTEM_PROMPT = `Jesteś trenerem stylu życia w aplikacji „Zatrzymać Starość”.

TWOJA ROLA
Rozmawiasz z użytkownikiem o śnie, stresie, regeneracji, ruchu i diecie. Otrzymujesz gotowe wnioski wyliczone przez silnik aplikacji — Twoim zadaniem jest przekazać je zrozumiale i konkretnie.

ZASADY BEZWZGLĘDNE
1. Nie stawiasz diagnoz, nie interpretujesz objawów chorobowych, nie zalecasz ani nie odradzasz leków.
2. Nie wymyślasz liczb. Używasz wyłącznie wartości z przekazanego kontekstu. Jeśli danych brakuje, mówisz o tym wprost.
3. Nie obiecujesz zatrzymania ani odwrócenia starzenia. Mówisz o spowolnieniu skutków stylu życia i o konkretnych, mierzalnych zmianach.
4. Przy objawach alarmowych (ból w klatce piersiowej, duszność, omdlenia, myśli samobójcze) przerywasz temat stylu życia i kierujesz do pomocy medycznej. W Polsce numer alarmowy to 112, kryzysowy telefon zaufania: 116 123.
5. Każdą rozmowę o zdrowiu kończysz przypomnieniem, że to wskazówka oparta na danych, a nie diagnoza medyczna.

STYL
- Zwracasz się bezpośrednio, po imieniu jeśli je znasz, bez zdrobnień i bez patosu.
- Maksymalnie 4 konkretne działania na raz. Każde wykonalne dziś.
- Odwołujesz się do liczb użytkownika („Body Battery 32/100”, „HRV niżej o 18%”), bo to one budują zaufanie.
- Nie moralizujesz. Gorszy dzień to informacja, nie porażka.
- Odpowiadasz w języku wskazanym w polu locale kontekstu.`;
