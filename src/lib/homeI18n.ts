// Krótkie teksty strony głównej w 4 językach + poprawna odmiana liczebników (pl/ua: 1 / 2–4 / 5+).
export type HomeLang = "pl" | "en" | "nl" | "ua";

export const asHomeLang = (l: string): HomeLang => (l === "en" || l === "nl" || l === "ua" ? l : "pl");

/** Liczba utworów z poprawną końcówką. */
export function tracksLabel(n: number, lang: string): string {
  const L = asHomeLang(lang);
  if (L === "en") return `${n} ${n === 1 ? "track" : "tracks"}`;
  if (L === "nl") return `${n} ${n === 1 ? "nummer" : "nummers"}`;
  const mod10 = n % 10, mod100 = n % 100;
  const few = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14);
  if (L === "ua") return `${n} ${n === 1 ? "трек" : few ? "треки" : "треків"}`;
  return `${n} ${n === 1 ? "utwór" : few ? "utwory" : "utworów"}`;
}

export const HOME_TXT = {
  pl: { playAll: "Graj wszystko", jumpBack: "Wróć do słuchania", radioTitle: "GrouaRadio na żywo", radioDesc: "Radio 24/7 z prezenterką Novą — muzyka twórców GrouAI Stream", tuneIn: "Słuchaj", forYouHint: "Kliknij, a algorytm dobierze utwory z katalogu do nastroju" },
  en: { playAll: "Play all", jumpBack: "Jump back in", radioTitle: "GrouaRadio live", radioDesc: "24/7 radio with host Nova — music by GrouAI Stream artists", tuneIn: "Tune in", forYouHint: "Tap and the algorithm picks catalog tracks for the mood" },
  nl: { playAll: "Alles afspelen", jumpBack: "Verder luisteren", radioTitle: "GrouaRadio live", radioDesc: "24/7 radio met presentator Nova — muziek van GrouAI Stream-artiesten", tuneIn: "Luister", forYouHint: "Tik en het algoritme kiest nummers bij de stemming" },
  ua: { playAll: "Грати все", jumpBack: "Продовжити слухати", radioTitle: "GrouaRadio наживо", radioDesc: "Радіо 24/7 з ведучою Новою — музика артистів GrouAI Stream", tuneIn: "Слухати", forYouHint: "Натисни — алгоритм підбере треки під настрій" },
} as const;

export const homeTxt = (lang: string) => HOME_TXT[asHomeLang(lang)];
