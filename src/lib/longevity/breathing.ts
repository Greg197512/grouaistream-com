/**
 * Protokoły oddechowe z parametrami animacji.
 *
 * Każdy protokół to sekwencja faz o określonym czasie trwania. UI odtwarza je
 * w pętli i skaluje okrąg oddechu proporcjonalnie do fazy, dzięki czemu jedna
 * implementacja animacji obsługuje wszystkie ćwiczenia.
 */

export type BreathPhaseKind = "inhale" | "hold" | "exhale" | "holdEmpty";

export interface BreathPhase {
  kind: BreathPhaseKind;
  seconds: number;
  /** Tekst wyświetlany i czytany lektorem. */
  cue: string;
}

export interface BreathingProtocol {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  /** Efekt fizjologiczny — opisany bez obietnic terapeutycznych. */
  effect: string;
  phases: BreathPhase[];
  /** Domyślna długość sesji w minutach. */
  defaultMinutes: number;
  /** Dla kogo i kiedy. */
  bestFor: string[];
  /** Ostrzeżenia — pokazywane przed startem, jeśli niepuste. */
  cautions: string[];
  /** Kolor akcentu w UI. */
  accent: "teal" | "gold" | "white";
  /** Poziom trudności. */
  level: "podstawowy" | "średni" | "zaawansowany";
  /** Czy wymaga potwierdzenia bezpieczeństwa przed startem. */
  requiresConsent?: boolean;
}

export const BREATHING_PROTOCOLS: BreathingProtocol[] = [
  {
    id: "box",
    name: "Box Breathing",
    subtitle: "4 – 4 – 4 – 4",
    description:
      "Równe fazy wdechu, zatrzymania, wydechu i pauzy. Prosty rytm, który łatwo utrzymać nawet przy dużym napięciu, bo nie wymaga liczenia różnych długości.",
    effect:
      "Wyrównuje rytm oddechu i obniża jego częstotliwość do około 4 cykli na minutę, co sprzyja stabilizacji tętna.",
    phases: [
      { kind: "inhale", seconds: 4, cue: "Wdech nosem" },
      { kind: "hold", seconds: 4, cue: "Zatrzymaj" },
      { kind: "exhale", seconds: 4, cue: "Wydech ustami" },
      { kind: "holdEmpty", seconds: 4, cue: "Pauza" },
    ],
    defaultMinutes: 5,
    bestFor: ["Przed wymagającym zadaniem", "Przy rozproszeniu", "Reset w środku dnia"],
    cautions: [],
    accent: "teal",
    level: "podstawowy",
  },
  {
    id: "478",
    name: "Oddech 4-7-8",
    subtitle: "4 – 7 – 8",
    description:
      "Wydech dwa razy dłuższy od wdechu, z zatrzymaniem pośrodku. Klasyczny protokół wieczorny — dominującym elementem jest długi wydech.",
    effect:
      "Wydłużony wydech zwiększa udział aktywności przywspółczulnej, co u większości osób obniża tętno w ciągu 2–3 minut.",
    phases: [
      { kind: "inhale", seconds: 4, cue: "Wdech nosem" },
      { kind: "hold", seconds: 7, cue: "Zatrzymaj" },
      { kind: "exhale", seconds: 8, cue: "Powolny wydech ustami" },
    ],
    defaultMinutes: 4,
    bestFor: ["Przed snem", "Po stresującej sytuacji", "Przy trudnościach z zasypianiem"],
    cautions: ["Przy zawrotach głowy skróć zatrzymanie do 4 sekund."],
    accent: "gold",
    level: "podstawowy",
  },
  {
    id: "coherent",
    name: "Coherent Breathing",
    subtitle: "5,5 – 5,5",
    description:
      "Oddech o częstotliwości około 5,5 cyklu na minutę, bez zatrzymań. Najlepiej przebadany protokół pod kątem wpływu na zmienność rytmu serca.",
    effect:
      "Rytm zbliżony do rezonansu układu krążenia — u większości dorosłych maksymalizuje amplitudę zmienności rytmu serca podczas sesji.",
    phases: [
      { kind: "inhale", seconds: 5.5, cue: "Wdech" },
      { kind: "exhale", seconds: 5.5, cue: "Wydech" },
    ],
    defaultMinutes: 10,
    bestFor: ["Codzienna praktyka", "Praca nad HRV", "Sesje 10–20 minut"],
    cautions: [],
    accent: "teal",
    level: "podstawowy",
  },
  {
    id: "extended-exhale",
    name: "Wydłużony wydech",
    subtitle: "4 – 8",
    description:
      "Najprostsza wersja regulacji: wdech na 4, wydech na 8, bez zatrzymań. Działa nawet wtedy, gdy złożone protokoły są zbyt wymagające.",
    effect: "Sam stosunek wydechu do wdechu 2:1 wystarcza, aby spowolnić tętno.",
    phases: [
      { kind: "inhale", seconds: 4, cue: "Wdech nosem" },
      { kind: "exhale", seconds: 8, cue: "Długi wydech" },
    ],
    defaultMinutes: 6,
    bestFor: ["Wysoki stres", "Stan mobilizacji", "Wyciszenie po treningu"],
    cautions: [],
    accent: "teal",
    level: "podstawowy",
  },
  {
    id: "physiological-sigh",
    name: "Westchnienie fizjologiczne",
    subtitle: "2 wdechy + długi wydech",
    description:
      "Podwójny wdech nosem (drugi krótki, „dobierający”) i pełny, powolny wydech ustami. Najszybszy protokół — działa już po 3 powtórzeniach.",
    effect:
      "Podwójny wdech rozpręża pęcherzyki płucne, a długi wydech szybko obniża pobudzenie.",
    phases: [
      { kind: "inhale", seconds: 3, cue: "Wdech nosem" },
      { kind: "inhale", seconds: 1.5, cue: "Dobierz powietrze" },
      { kind: "exhale", seconds: 7, cue: "Pełny wydech ustami" },
    ],
    defaultMinutes: 2,
    bestFor: ["Nagły stres", "Przed rozmową", "Gdy masz tylko minutę"],
    cautions: [],
    accent: "white",
    level: "podstawowy",
  },
  {
    id: "energizing",
    name: "Oddech aktywujący",
    subtitle: "6 – 2",
    description:
      "Odwrotność protokołów wyciszających: dłuższy wdech niż wydech. Do zastosowania rano lub w stanie zamrożenia, gdy brakuje napędu.",
    effect: "Przewaga fazy wdechowej podnosi tętno i poziom pobudzenia.",
    phases: [
      { kind: "inhale", seconds: 6, cue: "Głęboki wdech" },
      { kind: "exhale", seconds: 2, cue: "Krótki wydech" },
    ],
    defaultMinutes: 3,
    bestFor: ["Rano", "Stan zamrożenia", "Spadek energii po południu"],
    cautions: ["Nie stosuj bezpośrednio przed snem."],
    accent: "gold",
    level: "średni",
  },
  {
    id: "wim-hof",
    name: "Oddech w stylu Wima Hofa",
    subtitle: "30 oddechów + zatrzymanie",
    description:
      "Cykl 30 głębokich oddechów, po nim zatrzymanie na wydechu, następnie wdech z zatrzymaniem na 15 sekund. Protokół hiperwentylacyjny — wymaga świadomej decyzji.",
    effect:
      "Wywołuje przejściową hipokapnię i silne pobudzenie współczulne. Odczucia takie jak mrowienie są typowe dla tej techniki.",
    phases: [
      { kind: "inhale", seconds: 1.6, cue: "Wdech pełny" },
      { kind: "exhale", seconds: 1.4, cue: "Wydech swobodny" },
    ],
    defaultMinutes: 11,
    bestFor: ["Osoby z doświadczeniem w pracy z oddechem"],
    cautions: [
      "Wykonuj wyłącznie na siedząco lub leżąco, nigdy w wodzie ani podczas prowadzenia pojazdu.",
      "Nie stosuj w ciąży, przy padaczce, chorobach serca ani przy nadciśnieniu bez konsultacji z lekarzem.",
      "Przerwij ćwiczenie przy zawrotach głowy lub dyskomforcie.",
    ],
    accent: "white",
    level: "zaawansowany",
    requiresConsent: true,
  },
];

export const getProtocol = (id: string): BreathingProtocol | undefined =>
  BREATHING_PROTOCOLS.find((p) => p.id === id);

/** Długość jednego pełnego cyklu w sekundach. */
export const cycleSeconds = (protocol: BreathingProtocol): number =>
  protocol.phases.reduce((acc, p) => acc + p.seconds, 0);

/** Liczba cykli mieszcząca się w sesji o zadanej długości. */
export const cyclesInSession = (protocol: BreathingProtocol, minutes: number): number =>
  Math.max(1, Math.floor((minutes * 60) / cycleSeconds(protocol)));

/**
 * Zwraca fazę i postęp w jej obrębie dla podanego czasu sesji.
 * Używane przez animację — pozwala renderować dokładnie ten sam stan
 * niezależnie od częstotliwości klatek.
 */
export const phaseAt = (
  protocol: BreathingProtocol,
  elapsedSeconds: number,
): { phase: BreathPhase; phaseIndex: number; phaseProgress: number; cycleIndex: number } => {
  const cycle = cycleSeconds(protocol);
  const cycleIndex = Math.floor(elapsedSeconds / cycle);
  let t = elapsedSeconds % cycle;
  for (let i = 0; i < protocol.phases.length; i += 1) {
    const phase = protocol.phases[i];
    if (t < phase.seconds) {
      return { phase, phaseIndex: i, phaseProgress: t / phase.seconds, cycleIndex };
    }
    t -= phase.seconds;
  }
  const last = protocol.phases[protocol.phases.length - 1];
  return { phase: last, phaseIndex: protocol.phases.length - 1, phaseProgress: 1, cycleIndex };
};

/**
 * Docelowa skala okręgu oddechu dla danej fazy (0,55–1,0).
 * Wdech rośnie, wydech maleje, zatrzymania utrzymują poziom.
 */
export const scaleForPhase = (kind: BreathPhaseKind, progress: number): number => {
  const min = 0.55;
  const max = 1;
  switch (kind) {
    case "inhale":
      return min + (max - min) * progress;
    case "hold":
      return max;
    case "exhale":
      return max - (max - min) * progress;
    case "holdEmpty":
      return min;
    default:
      return min;
  }
};
