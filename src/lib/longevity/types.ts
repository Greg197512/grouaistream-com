/**
 * Zatrzymać Starość (Stop Aging AI) — model danych.
 *
 * Wszystkie typy opisują dane STYLU ŻYCIA i pomiary z urządzeń konsumenckich.
 * Nie są to dane diagnostyczne — silnik nigdy nie stawia rozpoznania, a jedynie
 * szacuje wskaźniki stylu życia i formułuje wskazówki regeneracyjne.
 */

/** Data dzienna w formacie ISO `YYYY-MM-DD` (lokalna doba użytkownika). */
export type IsoDate = string;

export type Sex = "female" | "male" | "unspecified";

/** Źródło pomiaru — decyduje o zaufaniu do danych i o kolejności scalania. */
export type DataSource =
  | "manual"
  | "apple_health"
  | "health_connect"
  | "google_fit"
  | "garmin"
  | "fitbit"
  | "oura"
  | "whoop"
  | "polar"
  | "suunto"
  | "coros"
  | "samsung_health"
  | "huawei_health"
  | "withings"
  | "xiaomi"
  | "amazfit"
  | "strava"
  | "derived";

/** Fazy snu w minutach (jeśli urządzenie je raportuje). */
export interface SleepStages {
  deepMin?: number;
  remMin?: number;
  lightMin?: number;
  awakeMin?: number;
}

export interface SleepData {
  /** Czas snu netto (bez wybudzeń) w minutach. */
  durationMin?: number;
  /** Czas w łóżku w minutach — do wyliczenia efektywności snu. */
  timeInBedMin?: number;
  /** Godzina zaśnięcia jako minuty od północy (może przekraczać 24 h → 1500 = 01:00). */
  bedtimeMinOfDay?: number;
  /** Godzina pobudki jako minuty od północy. */
  wakeMinOfDay?: number;
  /** Liczba wybudzeń w nocy. */
  awakenings?: number;
  /** Sleep Score raportowany przez urządzenie (0–100), jeśli dostępny. */
  vendorScore?: number;
  stages?: SleepStages;
  /** Średnie tętno podczas snu (bpm). */
  avgHeartRate?: number;
  /** Średnie HRV nocne (RMSSD, ms). */
  avgHrvMs?: number;
  /** Średnia saturacja nocna (%). */
  avgSpo2?: number;
  /** Średnia liczba oddechów na minutę. */
  respirationRate?: number;
  /** Odchylenie temperatury skóry względem bazy użytkownika (°C). */
  skinTempDeltaC?: number;
  source?: DataSource;
}

export interface CardioData {
  /** Tętno spoczynkowe (bpm). */
  restingHeartRate?: number;
  /** HRV dobowe / poranne (RMSSD, ms). */
  hrvMs?: number;
  /** Saturacja w ciągu dnia (%). */
  spo2?: number;
  /** Liczba oddechów na minutę (dzień). */
  respirationRate?: number;
  vo2Max?: number;
  /** Ciśnienie skurczowe (mmHg) — tylko jeśli urządzenie/użytkownik je poda. */
  systolic?: number;
  /** Ciśnienie rozkurczowe (mmHg). */
  diastolic?: number;
  /** Zapis EKG wykonany danego dnia (flaga obecności, nie interpretacja). */
  ecgRecorded?: boolean;
  source?: DataSource;
}

export interface WorkoutEntry {
  type: string;
  durationMin: number;
  /** Średnie tętno treningu (bpm). */
  avgHeartRate?: number;
  /** Szacowany wysiłek 0–10 (RPE) lub przeliczony z tętna. */
  intensity?: number;
  kcal?: number;
  distanceKm?: number;
}

export interface ActivityData {
  steps?: number;
  activeKcal?: number;
  totalKcal?: number;
  distanceKm?: number;
  /** Minuty aktywności umiarkowanej do intensywnej. */
  moderateVigorousMin?: number;
  sedentaryMin?: number;
  walkMin?: number;
  stretchingMin?: number;
  workouts?: WorkoutEntry[];
  source?: DataSource;
}

export interface BodyData {
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
  waistCm?: number;
  /** Odchylenie temperatury skóry (°C) względem bazy. */
  skinTempDeltaC?: number;
  bodyTempC?: number;
  source?: DataSource;
}

/**
 * Metryki firmowe (proprietary) — nie da się ich policzyć samodzielnie,
 * pochodzą wprost z ekosystemu producenta. Garmin ma tu priorytet.
 */
export interface VendorMetrics {
  /** Garmin Body Battery 0–100. */
  bodyBattery?: number;
  /** Najniższy poziom Body Battery w ciągu doby. */
  bodyBatteryLow?: number;
  /** Najwyższy poziom Body Battery w ciągu doby. */
  bodyBatteryHigh?: number;
  /** Garmin Training Readiness 0–100. */
  trainingReadiness?: number;
  /** Garmin All-Day Stress 0–100 (wyżej = większy stres). */
  stressScore?: number;
  /** Garmin HRV Status. */
  hrvStatus?: "balanced" | "unbalanced" | "low" | "poor" | "no_status";
  /** Pozostały czas regeneracji w godzinach (Garmin Recovery Time). */
  recoveryTimeH?: number;
  /** Garmin Hill Score. */
  hillScore?: number;
  /** Garmin Endurance Score. */
  enduranceScore?: number;
  /** WHOOP Recovery / Oura Readiness 0–100. */
  readinessScore?: number;
  /** WHOOP Day Strain 0–21. */
  strain?: number;
  /** Sleep Score producenta 0–100. */
  sleepScore?: number;
  source?: DataSource;
}

export interface NutritionData {
  kcal?: number;
  proteinG?: number;
  fiberG?: number;
  addedSugarG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
  /** Porcje warzyw (1 porcja ≈ 80 g). */
  vegetableServings?: number;
  fruitServings?: number;
  /** Liczba jednostek alkoholu (1 j. ≈ 10 g etanolu). */
  alcoholUnits?: number;
  /** Posiłki wysokoprzetworzone (UPF) w ciągu dnia. */
  ultraProcessedMeals?: number;
  /** Godzina ostatniego posiłku jako minuty od północy. */
  lastMealMinOfDay?: number;
  micronutrients?: Partial<Record<Micronutrient, number>>;
  source?: DataSource;
}

export type Micronutrient =
  | "vitaminD"
  | "vitaminB12"
  | "magnesium"
  | "omega3"
  | "iron"
  | "zinc"
  | "potassium"
  | "calcium"
  | "folate";

export interface LifestyleData {
  /** Wypalone papierosy (0 = brak). */
  cigarettes?: number;
  /** Czy użytkownik pali regularnie — deklaracja z profilu, nadpisywana dziennie. */
  smokingStatus?: "never" | "former" | "current";
  meditationMin?: number;
  breathworkMin?: number;
  /** Czas na świeżym powietrzu (min). */
  outdoorMin?: number;
  /** Ekspozycja na światło poranne (min w ciągu 1 h od pobudki). */
  morningLightMin?: number;
  /** Ekran w godzinie przed snem (min). */
  screenBeforeBedMin?: number;
  /** Liczba powiadomień odebranych w ciągu dnia — proxy obciążenia uwagi. */
  notifications?: number;
  /** Kontakt społeczny — rozmowy/spotkania (min). */
  socialMin?: number;
  /** Sauna/zimno — minuty hormetyczne. */
  thermalMin?: number;
}

export interface SubjectiveData {
  /** Samopoczucie 1–5. */
  mood?: number;
  /** Energia 1–5. */
  energy?: number;
  /** Koncentracja 1–5. */
  focus?: number;
  /** Odczuwany stres 1–5 (5 = bardzo wysoki). */
  stress?: number;
  /** Odczuwana jakość snu 1–5. */
  sleepQuality?: number;
  /** Bolesność mięśniowa 1–5. */
  soreness?: number;
}

/** Kompletny rekord jednej doby po scaleniu wszystkich źródeł. */
export interface DailyRecord {
  date: IsoDate;
  sleep?: SleepData;
  cardio?: CardioData;
  activity?: ActivityData;
  body?: BodyData;
  vendor?: VendorMetrics;
  nutrition?: NutritionData;
  lifestyle?: LifestyleData;
  subjective?: SubjectiveData;
  /** Źródła, z których powstał rekord — pokazywane w UI („skąd to wiemy”). */
  sources?: DataSource[];
}

/** Statyczny profil użytkownika — zmienia się rzadko. */
export interface UserProfile {
  /** Wiek metrykalny w latach. */
  chronologicalAge: number;
  sex: Sex;
  heightCm: number;
  weightKg?: number;
  smokingStatus: "never" | "former" | "current";
  /** Lata od rzucenia palenia (dla `former`). */
  yearsSinceQuit?: number;
  /** Typowa liczba jednostek alkoholu tygodniowo. */
  weeklyAlcoholUnits?: number;
  /** Docelowa pora snu (minuty od północy). */
  targetBedtimeMinOfDay?: number;
  /** Docelowa długość snu w minutach. */
  targetSleepMin?: number;
  /** Docelowa liczba kroków. */
  targetSteps?: number;
  /** Docelowe nawodnienie (ml). */
  targetWaterMl?: number;
  locale?: LongevityLocale;
}

export type LongevityLocale = "pl" | "en" | "de" | "nl" | "es" | "it" | "ua" | "fr";

/** Poziom pewności wyniku — funkcja pokrycia danymi. */
export type Confidence = "low" | "medium" | "high";

export interface ScoreResult {
  /** Wynik 0–100 (wyżej = lepiej), z wyjątkiem `stressIndex`, gdzie wyżej = gorzej. */
  value: number;
  confidence: Confidence;
  /** Udział poszczególnych czynników — do wykresu „co złożyło się na wynik”. */
  drivers: ScoreDriver[];
  /** Liczba pól danych faktycznie użytych do obliczenia. */
  inputsUsed: number;
}

export interface ScoreDriver {
  key: string;
  /** Etykieta w języku polskim (tłumaczona w warstwie UI). */
  label: string;
  /** Wkład do wyniku w punktach (może być ujemny). */
  contribution: number;
  /** Znormalizowana wartość 0–1 opisująca „jak dobrze” wypada ten czynnik. */
  normalized: number;
}

export type StressLevel = "low" | "moderate" | "high" | "critical";

export type NervousSystemState =
  /** Regeneracja — przewaga przywspółczulna, dobra zmienność rytmu. */
  | "recovery"
  /** Przeciążenie — kumulacja obciążenia bez odpowiedniej regeneracji. */
  | "overload"
  /** Walka / mobilizacja — wysoka aktywacja współczulna. */
  | "fight"
  /** Zamrożenie — niska aktywacja i niska zmienność jednocześnie. */
  | "freeze";

export interface NervousSystemAssessment {
  state: NervousSystemState;
  confidence: Confidence;
  /** 0–100, gdzie 100 = pełna równowaga autonomiczna. */
  balanceScore: number;
  /** Krótkie uzasadnienie oparte wyłącznie na danych wejściowych. */
  rationale: string[];
  /** Rekomendowane protokoły oddechowe / regeneracyjne (identyfikatory). */
  suggestedProtocols: string[];
}

export interface BiologicalAgeResult {
  /** Szacowany wiek biologiczny w latach (zaokrąglony do 0,1). */
  estimatedAge: number;
  chronologicalAge: number;
  /** Różnica: ujemna = „młodziej” niż metrykalnie. */
  deltaYears: number;
  confidence: Confidence;
  drivers: ScoreDriver[];
  /** Pola danych, których brakuje, a które najbardziej poprawiłyby precyzję. */
  missingInputs: string[];
}

export interface LongevityPanel {
  date: IsoDate;
  biologicalAge: BiologicalAgeResult;
  recoveryAge: number;
  sleepScore: ScoreResult;
  stressIndex: ScoreResult;
  recoveryScore: ScoreResult;
  energyScore: ScoreResult;
  epigeneticScore: EpigeneticResult;
  nervousSystem: NervousSystemAssessment;
  brainRecoveryScore: ScoreResult;
  cardiovascularScore: ScoreResult;
  metabolicScore: ScoreResult;
  longevityIndex: ScoreResult;
  stressLevel: StressLevel;
}

export interface EpigeneticRule {
  key: string;
  label: string;
  /** Maksymalna liczba punktów za tę kategorię. */
  maxPoints: number;
  /** Opis warunku pełnej punktacji — pokazywany użytkownikowi. */
  target: string;
}

export interface EpigeneticAward {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  /** Czy warunek został spełniony w pełni. */
  complete: boolean;
  /** Konkretna wartość, którą osiągnął użytkownik (do wyświetlenia). */
  detail: string;
}

export interface EpigeneticResult {
  /** Suma punktów 0–100. */
  value: number;
  awards: EpigeneticAward[];
  confidence: Confidence;
}

/** Okna analizy. 14 dni używa wyłącznie cyfrowy bliźniak; wykresy w UI: 7/30/90/365. */
export type TrendWindow = 7 | 14 | 30 | 90 | 365;

export interface TrendPoint {
  date: IsoDate;
  value: number;
}

export interface TrendAnalysis {
  metric: string;
  window: TrendWindow;
  points: TrendPoint[];
  /** Średnia w oknie. */
  mean: number;
  /** Nachylenie regresji liniowej w jednostkach/dzień. */
  slopePerDay: number;
  /** Zmiana procentowa: pierwsza połowa okna vs druga. */
  changePct: number;
  direction: "improving" | "stable" | "declining";
  /** Liczba dni z danymi (nie każde okno jest pełne). */
  coverage: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  /** Metryka, po której mierzymy wykonanie. */
  metric: MissionMetric;
  target: number;
  unit: string;
  xp: number;
  category: "sleep" | "movement" | "nutrition" | "mind" | "recovery";
  /** Dlaczego akurat dziś ta misja — generowane z danych. */
  reason: string;
}

export type MissionMetric =
  | "steps"
  | "sleepMin"
  | "waterMl"
  | "meditationMin"
  | "breathworkMin"
  | "screenBeforeBedMin"
  | "vegetableServings"
  | "outdoorMin"
  | "alcoholUnits"
  | "walkMin"
  | "stretchingMin"
  | "morningLightMin";

export interface MissionProgress {
  mission: Mission;
  current: number;
  /** 0–1. */
  progress: number;
  complete: boolean;
}

export interface GamificationState {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** Aktualna seria dni z ukończoną co najmniej jedną misją. */
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  earnedAt?: IsoDate;
  /** 0–1 postępu do zdobycia. */
  progress: number;
}

export interface CoachInsight {
  id: string;
  /** Priorytet 1 (najwyższy) – 5. */
  priority: number;
  title: string;
  body: string;
  /** Konkretne działania na dziś. */
  actions: string[];
  /** Metryki, na których oparta jest wskazówka — transparentność. */
  basedOn: string[];
  category: "sleep" | "stress" | "nervous" | "nutrition" | "activity" | "recovery" | "safety";
}

export interface CoachReport {
  date: IsoDate;
  headline: string;
  summary: string;
  insights: CoachInsight[];
  /** Zawsze dołączane — wymóg produktowy i prawny. */
  disclaimer: string;
}

/** Prognoza cyfrowego bliźniaka. */
export interface TwinPrediction {
  key: string;
  label: string;
  /** Prawdopodobieństwo 0–1 lub wartość przewidywana (zależnie od `kind`). */
  value: number;
  kind: "probability" | "value";
  unit?: string;
  /** Horyzont w dniach. */
  horizonDays: number;
  confidence: Confidence;
  explanation: string;
}

export interface TwinBaseline {
  /** Mediana kroczącej bazy użytkownika dla kluczowych metryk. */
  hrvMs?: number;
  restingHeartRate?: number;
  sleepMin?: number;
  bedtimeMinOfDay?: number;
  steps?: number;
  bodyBattery?: number;
  /** Odchylenie standardowe HRV — szerokość „normy osobistej”. */
  hrvSd?: number;
  restingHeartRateSd?: number;
  sleepMinSd?: number;
  /** Liczba dni użytych do zbudowania bazy. */
  days: number;
}

export interface DigitalTwin {
  baseline: TwinBaseline;
  predictions: TwinPrediction[];
  /** Optymalna pora snu wyliczona z historii (minuty od północy). */
  optimalBedtimeMinOfDay?: number;
  /** Optymalne okno treningowe (godziny lokalne). */
  optimalTrainingWindow?: { startHour: number; endHour: number };
  /** Dojrzałość modelu 0–1 — rośnie z liczbą dni danych. */
  maturity: number;
}

export interface DeviceIntegration {
  id: DataSource;
  name: string;
  /** Priorytet w kreatorze — 1 = najwyższy (Garmin). */
  priority: number;
  transport: "oauth_cloud" | "native_sdk" | "webhook_push" | "file_import";
  /** Metryki, które realnie potrafimy pobrać z tego źródła. */
  metrics: string[];
  /** Czy dostawca wysyła push (webhook), czy trzeba odpytywać. */
  push: boolean;
  /** Typowe opóźnienie danych w minutach. */
  latencyMin: number;
  notes: string;
}
