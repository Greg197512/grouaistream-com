/**
 * Biblioteka sesji: medytacje prowadzone, muzyka i dźwięki natury.
 *
 * Każda pozycja ma pełny scenariusz (`script`) — sekwencję kroków z czasem
 * trwania i treścią prowadzenia. Dzięki temu sesja działa od razu:
 * UI odlicza kroki i wyświetla instrukcje, a warstwa audio dokłada
 * syntezowane tło (`soundscape`) lub — dla kont Premium — nagranie lektorskie
 * z platformy Grouaistream (`grouaistreamTag`).
 */

export type SessionCategory =
  | "sleep"
  | "focus"
  | "relax"
  | "anxiety"
  | "stress"
  | "music"
  | "nature";

export const SESSION_CATEGORY_LABEL: Record<SessionCategory, string> = {
  sleep: "Sen",
  focus: "Koncentracja",
  relax: "Relaks",
  anxiety: "Lęk",
  stress: "Stres",
  music: "Muzyka",
  nature: "Dźwięki natury",
};

export interface SessionStep {
  /** Czas trwania kroku w sekundach. */
  seconds: number;
  /** Instrukcja wyświetlana i czytana. */
  text: string;
}

export interface MeditationSession {
  id: string;
  title: string;
  category: SessionCategory;
  /** Długość w minutach. */
  minutes: number;
  /** Krótki opis pokazywany na karcie. */
  summary: string;
  /** Do czego ta sesja służy — konkretnie, bez ogólników. */
  purpose: string;
  /** Scenariusz prowadzenia. Suma czasów ≈ `minutes` × 60. */
  script: SessionStep[];
  /** Identyfikator tła dźwiękowego z silnika syntezy. */
  soundscape: SoundscapeId;
  /** Tag treści na platformie Grouaistream (nagranie lektorskie / muzyka). */
  grouaistreamTag?: string;
  /** Czy sesja wymaga konta Premium. */
  premium?: boolean;
  /** Stany układu nerwowego, w których silnik proponuje tę sesję. */
  recommendedFor: Array<"recovery" | "overload" | "fight" | "freeze">;
}

export type SoundscapeId =
  | "rain"
  | "ocean"
  | "forest"
  | "night"
  | "drone-warm"
  | "drone-deep"
  | "binaural-theta"
  | "binaural-alpha"
  | "binaural-delta"
  | "silence";

export const SOUNDSCAPE_LABEL: Record<SoundscapeId, string> = {
  rain: "Deszcz",
  ocean: "Fale oceanu",
  forest: "Las o poranku",
  night: "Noc i owady",
  "drone-warm": "Ciepły pad",
  "drone-deep": "Głęboki dron",
  "binaural-theta": "Fale theta 6 Hz",
  "binaural-alpha": "Fale alfa 10 Hz",
  "binaural-delta": "Fale delta 2,5 Hz",
  silence: "Cisza",
};

export const MEDITATION_SESSIONS: MeditationSession[] = [
  {
    id: "sleep-body-scan",
    title: "Skanowanie ciała przed snem",
    category: "sleep",
    minutes: 12,
    summary: "Sekwencja rozluźniania od stóp po szczękę, zakończona spowolnieniem oddechu.",
    purpose: "Skraca czas zasypiania przez świadome rozluźnienie napiętych grup mięśniowych.",
    soundscape: "rain",
    grouaistreamTag: "sleep-voice-pl",
    recommendedFor: ["overload", "fight"],
    script: [
      { seconds: 60, text: "Połóż się wygodnie. Nie zmieniaj jeszcze oddechu — tylko go zauważ." },
      { seconds: 90, text: "Skieruj uwagę na stopy. Napnij je na trzy sekundy i puść." },
      { seconds: 90, text: "Łydki i uda. Zauważ ciężar nóg opadających w materac." },
      { seconds: 90, text: "Miednica i brzuch. Pozwól brzuchowi unosić się przy wdechu." },
      { seconds: 90, text: "Klatka piersiowa i plecy. Wydech dłuższy niż wdech." },
      { seconds: 90, text: "Dłonie, przedramiona, barki. Opuść ramiona o centymetr niżej." },
      { seconds: 90, text: "Szyja, szczęka, język. Rozluźnij zęby — zostaw między nimi szczelinę." },
      { seconds: 120, text: "Oczy i czoło. Oddychaj w rytmie: wdech na cztery, wydech na osiem." },
      { seconds: 120, text: "Nic już nie musisz robić. Utrzymuj wydech i pozwól myślom przepływać." },
    ],
  },
  {
    id: "sleep-478-wind-down",
    title: "Wieczorne wyciszenie 4-7-8",
    category: "sleep",
    minutes: 8,
    summary: "Krótka sesja oddechowa dla osób, które kładą się z gonitwą myśli.",
    purpose: "Obniża tętno przed snem i oddziela dzień od nocy prostym rytuałem.",
    soundscape: "drone-deep",
    recommendedFor: ["fight", "overload"],
    script: [
      { seconds: 60, text: "Usiądź lub połóż się. Wypuść powietrze całkowicie przez usta." },
      { seconds: 120, text: "Wdech nosem na cztery, zatrzymanie na siedem, wydech na osiem. Cztery cykle." },
      { seconds: 120, text: "Kolejne cztery cykle. Jeśli zatrzymanie jest za długie, skróć je do czterech." },
      { seconds: 120, text: "Wróć do swobodnego oddechu. Zauważ, jak zmieniło się tętno." },
      { seconds: 60, text: "Ostatnie dwa cykle 4-7-8, wolniej niż wcześniej." },
    ],
  },
  {
    id: "focus-anchor",
    title: "Kotwica uwagi",
    category: "focus",
    minutes: 10,
    summary: "Trening powracania uwagi do jednego punktu — podstawa pracy głębokiej.",
    purpose: "Wzmacnia zdolność wracania do zadania po rozproszeniu.",
    soundscape: "binaural-alpha",
    recommendedFor: ["recovery", "freeze"],
    script: [
      { seconds: 60, text: "Usiądź prosto, stopy na podłodze. Zamknij oczy lub zmiękcz spojrzenie." },
      { seconds: 120, text: "Znajdź miejsce, w którym najwyraźniej czujesz oddech: nozdrza, klatka lub brzuch." },
      { seconds: 180, text: "Licz oddechy do dziesięciu, potem zacznij od nowa. Zgubione liczenie to część ćwiczenia." },
      { seconds: 180, text: "Gdy uwaga odpłynie, zauważ dokąd poszła i wróć bez oceniania." },
      { seconds: 120, text: "Ostatnie dwie minuty bez liczenia — tylko obecność przy oddechu." },
      { seconds: 60, text: "Otwórz oczy. Zanim wrócisz do zadania, zrób jeden świadomy wydech." },
    ],
  },
  {
    id: "focus-pre-work",
    title: "Pięć minut przed pracą głęboką",
    category: "focus",
    minutes: 5,
    summary: "Szybkie ustawienie uwagi przed blokiem pracy bez powiadomień.",
    purpose: "Zmniejsza koszt przełączania kontekstu na starcie sesji roboczej.",
    soundscape: "drone-warm",
    recommendedFor: ["recovery", "freeze"],
    script: [
      { seconds: 45, text: "Wypisz w myślach jedno zdanie: co ma być gotowe po tej sesji." },
      { seconds: 75, text: "Sześć oddechów w rytmie 4 sekundy wdech, 6 sekund wydech." },
      { seconds: 90, text: "Przejdź uwagą po ciele: barki, szczęka, dłonie. Rozluźnij to, co napięte." },
      { seconds: 60, text: "Wyobraź sobie pierwszy ruch: jaki plik otwierasz, od czego zaczynasz." },
      { seconds: 30, text: "Wycisz telefon. Zaczynasz." },
    ],
  },
  {
    id: "relax-evening-reset",
    title: "Reset po dniu",
    category: "relax",
    minutes: 15,
    summary: "Rozluźnienie progresywne połączone z krótkim przeglądem dnia.",
    purpose: "Zamyka dzień i obniża poziom pobudzenia przed wieczorem.",
    soundscape: "forest",
    recommendedFor: ["overload", "fight"],
    script: [
      { seconds: 90, text: "Usiądź wygodnie. Trzy powolne wydechy, dłuższe niż wdechy." },
      { seconds: 150, text: "Napnij i rozluźnij kolejno: dłonie, ramiona, barki. Po pięć sekund napięcia." },
      { seconds: 150, text: "To samo z twarzą, szyją i brzuchem." },
      { seconds: 180, text: "Przypomnij sobie jedną rzecz z dziś, która poszła dobrze. Zatrzymaj się przy niej." },
      { seconds: 180, text: "Zauważ jedną rzecz, która była trudna. Nie analizuj — po prostu ją nazwij." },
      { seconds: 150, text: "Wróć do oddechu. Wdech na cztery, wydech na sześć." },
      { seconds: 90, text: "Wieczór zaczyna się teraz. Zostaw dzień za sobą." },
    ],
  },
  {
    id: "anxiety-grounding",
    title: "Uziemienie 5-4-3-2-1",
    category: "anxiety",
    minutes: 6,
    summary: "Technika sensoryczna, która przerywa spiralę niepokojących myśli.",
    purpose: "Przenosi uwagę z myśli na bodźce zewnętrzne w chwili narastającego napięcia.",
    soundscape: "ocean",
    recommendedFor: ["fight", "overload"],
    script: [
      { seconds: 45, text: "Postaw obie stopy na podłodze. Poczuj podłoże pod piętami." },
      { seconds: 75, text: "Wymień w myślach pięć rzeczy, które widzisz. Nazwij je dokładnie." },
      { seconds: 75, text: "Cztery rzeczy, które słyszysz — od najgłośniejszej do najcichszej." },
      { seconds: 75, text: "Trzy rzeczy, które czujesz dotykiem: ubranie, krzesło, temperatura powietrza." },
      { seconds: 60, text: "Dwa zapachy albo dwa oddechy, jeśli zapachów nie ma." },
      { seconds: 60, text: "Jedna rzecz, którą możesz zrobić w ciągu najbliższej minuty." },
      { seconds: 30, text: "Trzy oddechy z długim wydechem. Wracasz." },
    ],
  },
  {
    id: "stress-sos",
    title: "SOS — dwie minuty",
    category: "stress",
    minutes: 2,
    summary: "Najkrótszy protokół: westchnienia fizjologiczne i rozluźnienie szczęki.",
    purpose: "Szybkie obniżenie pobudzenia między spotkaniami lub przed trudną rozmową.",
    soundscape: "silence",
    recommendedFor: ["fight"],
    script: [
      { seconds: 40, text: "Dwa wdechy nosem — drugi krótki, dobierający. Długi wydech ustami. Trzy razy." },
      { seconds: 40, text: "Rozluźnij szczękę i język. Opuść barki." },
      { seconds: 40, text: "Trzy oddechy w rytmie 4–8. Zauważ, co się zmieniło." },
    ],
  },
  {
    id: "stress-hrv-training",
    title: "Trening HRV — oddech rezonansowy",
    category: "stress",
    minutes: 20,
    summary: "Dwadzieścia minut oddechu 5,5 cyklu na minutę z prowadzeniem tempa.",
    purpose: "Regularna praktyka rezonansowa jest najlepiej udokumentowanym sposobem pracy nad zmiennością rytmu serca.",
    soundscape: "binaural-theta",
    premium: true,
    grouaistreamTag: "hrv-resonance",
    recommendedFor: ["recovery", "overload"],
    script: [
      { seconds: 120, text: "Usiądź prosto. Oddychaj nosem, przeponą — brzuch unosi się przed klatką." },
      { seconds: 300, text: "Wdech 5,5 sekundy, wydech 5,5 sekundy. Bez zatrzymań, płynnie." },
      { seconds: 300, text: "Utrzymuj rytm. Jeśli pojawi się napięcie, zmniejsz głębokość, nie tempo." },
      { seconds: 300, text: "Druga połowa sesji. Oddech powinien być już automatyczny." },
      { seconds: 180, text: "Ostatnie trzy minuty — nie zmieniaj niczego." },
      { seconds:   0, text: "Wróć do swobodnego oddechu." },
    ],
  },
  {
    id: "nature-rain-window",
    title: "Deszcz za oknem",
    category: "nature",
    minutes: 30,
    summary: "Ciągły szum deszczu bez prowadzenia głosowego — do pracy lub zasypiania.",
    purpose: "Maskuje nieregularne dźwięki otoczenia, które wybudzają w nocy.",
    soundscape: "rain",
    recommendedFor: ["recovery", "overload", "fight", "freeze"],
    script: [{ seconds: 1800, text: "Deszcz. Nic nie musisz robić." }],
  },
  {
    id: "nature-ocean",
    title: "Fale oceanu",
    category: "nature",
    minutes: 45,
    summary: "Wolno narastające i opadające fale w rytmie zbliżonym do spokojnego oddechu.",
    purpose: "Rytm fal (około 6 cykli na minutę) naturalnie spowalnia oddech słuchacza.",
    soundscape: "ocean",
    recommendedFor: ["recovery", "overload"],
    script: [{ seconds: 2700, text: "Fale. Jeśli chcesz, dopasuj oddech do ich rytmu." }],
  },
  {
    id: "nature-forest",
    title: "Las o poranku",
    category: "nature",
    minutes: 30,
    summary: "Ptaki i liście — tło do porannej pracy lub rozciągania.",
    purpose: "Neutralne tło akustyczne, które nie przeciąga uwagi na siebie.",
    soundscape: "forest",
    recommendedFor: ["freeze", "recovery"],
    script: [{ seconds: 1800, text: "Las o poranku." }],
  },
  {
    id: "music-deep-focus",
    title: "Deep Focus — pad i fale alfa",
    category: "music",
    minutes: 40,
    summary: "Utrzymany akord z delikatną modulacją i binauralną falą 10 Hz.",
    purpose: "Tło bez melodii i bez wokalu — nie konkuruje o zasoby uwagi.",
    soundscape: "binaural-alpha",
    grouaistreamTag: "deep-focus",
    premium: true,
    recommendedFor: ["recovery", "freeze"],
    script: [{ seconds: 2400, text: "Deep Focus. Słuchaj w słuchawkach — fale binauralne wymagają obu kanałów." }],
  },
  {
    id: "music-delta-sleep",
    title: "Delta — sen głęboki",
    category: "music",
    minutes: 60,
    summary: "Bardzo niski dron z falą delta 2,5 Hz, wygaszany po godzinie.",
    purpose: "Tło do pierwszej fazy nocy, gdy dominuje sen wolnofalowy.",
    soundscape: "binaural-delta",
    grouaistreamTag: "delta-sleep",
    premium: true,
    recommendedFor: ["overload", "fight"],
    script: [{ seconds: 3600, text: "Delta. Głośność zmniejsza się automatycznie po 45 minutach." }],
  },
];

export const sessionsByCategory = (category: SessionCategory): MeditationSession[] =>
  MEDITATION_SESSIONS.filter((s) => s.category === category);

export const getSession = (id: string): MeditationSession | undefined =>
  MEDITATION_SESSIONS.find((s) => s.id === id);

/** Sesje proponowane dla aktualnego stanu układu nerwowego, najkrótsze najpierw. */
export const recommendSessions = (
  state: "recovery" | "overload" | "fight" | "freeze",
  limit = 3,
): MeditationSession[] =>
  MEDITATION_SESSIONS.filter((s) => s.recommendedFor.includes(state))
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, limit);

/** Łączny czas scenariusza w sekundach — używany do paska postępu. */
export const scriptSeconds = (session: MeditationSession): number =>
  session.script.reduce((acc, s) => acc + s.seconds, 0) || session.minutes * 60;
