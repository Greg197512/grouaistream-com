// Prezenterka AI GrouaRadio: persona, zapowiedzi w 4 językach, filtr treści i decyzja „kiedy mówić”.
// Czysta logika (bez sieci): teksty są z szablonów, więc są natychmiastowe, darmowe i bezpieczne
// (nie zmyślają faktów). Głos czyta `speak()` (ElevenLabs → zapasowe syntezatory).

import type { BlockId } from "./radioClock";

export type HostLang = "pl" | "en" | "nl" | "ua";
export const hostLang = (l: string | null | undefined): HostLang => (l === "en" || l === "nl" || l === "ua" ? l : "pl");

/** Persona prezenterki — źródło prawdy dla szablonów i (w przyszłości) promptu modelu. */
export const HOST_PERSONA = {
  name: "Nova",
  style: "ciepła, energiczna, krótka (1–2 zdania), mówi do słuchacza na „ty”, muzyka jest najważniejsza",
  values: ["szacunek dla słuchaczy i twórców", "pozytywny ton", "różnorodność", "uczciwość: zawsze przyznaje, że jest AI"],
  never: [
    "polityka, religia, tematy zdrowotne i finansowe porady",
    "wulgaryzmy, mowa nienawiści, treści dla dorosłych",
    "zmyślone fakty o artystach, podszywanie się pod prawdziwe osoby",
    "udawanie człowieka",
    "reklamy i linki",
  ],
} as const;

/** Ujawnienie AI (AI Act, art. 50) — pokazywane na stronie i wypowiadane w identyfikacji stacji. */
export const AI_DISCLOSURE: Record<HostLang, string> = {
  pl: "Prezenterka Nova to głos AI. Część muzyki powstaje z pomocą AI.",
  en: "Host Nova is an AI voice. Some of the music is made with AI.",
  nl: "Presentator Nova is een AI-stem. Een deel van de muziek is gemaakt met AI.",
  ua: "Ведуча Nova — це голос ШІ. Частина музики створена за допомогою ШІ.",
};

const BLOCK_NAMES: Record<HostLang, Record<BlockId, string>> = {
  pl: { night: "nocne chill i lo-fi", morning: "poranny pop i energię", day: "mix dnia", afternoon: "popołudniowy electronic i house", evening: "wieczorny hip-hop i R&B", "weekend-disco": "weekendowe disco", "weekend-electronic": "weekendowy electronic", "weekend-hiphop": "weekendowy hip-hop", sunday: "niedzielny spokój" },
  en: { night: "late-night chill and lo-fi", morning: "morning pop and energy", day: "the daytime mix", afternoon: "afternoon electronic and house", evening: "evening hip-hop and R&B", "weekend-disco": "weekend disco", "weekend-electronic": "weekend electronic", "weekend-hiphop": "weekend hip-hop", sunday: "Sunday chill" },
  nl: { night: "nachtelijke chill en lo-fi", morning: "ochtendpop en energie", day: "de dagmix", afternoon: "middag-electronic en house", evening: "avond-hiphop en R&B", "weekend-disco": "weekenddisco", "weekend-electronic": "weekend-electronic", "weekend-hiphop": "weekend-hiphop", sunday: "zondagse rust" },
  ua: { night: "нічний чил і лоу-фай", morning: "ранковий поп і енергію", day: "денний мікс", afternoon: "післяобідній електронік і хаус", evening: "вечірній хіп-хоп і R&B", "weekend-disco": "вихідне диско", "weekend-electronic": "вихідний електронік", "weekend-hiphop": "вихідний хіп-хоп", sunday: "недільний спокій" },
};

type T = { title: string; artist: string };
export type HostKind = "welcome" | "block" | "hour" | "back";
export interface HostCtx {
  kind: HostKind; lang: HostLang; hour: number; minute: number; block: BlockId; dj: boolean;
  prev?: T | null; next?: T | null; seed: number;
}

const TPL: Record<HostLang, Record<HostKind, string[]> & { dj: string; next: string[] }> = {
  pl: {
    welcome: ["Cześć, tu Nova, głos AI GrouaRadio. Gramy dla ciebie {block}.", "Witaj w GrouaRadio! Jestem Nova, prezenterka AI. Na antenie {block}."],
    block: ["Jest {time}, wchodzimy w {block}.", "{time} na zegarze, czas na {block}.", "Zmieniamy klimat: teraz {block}."],
    hour: ["Jest {time}. Słuchasz GrouaRadio, prowadzi Nova, głos AI.", "Godzina {time}, GrouaRadio. Ja jestem Nova, prezenterka AI, i gramy dalej."],
    back: ["To było {prev}.", "Przed chwilą {prev}.", "Właśnie wybrzmiało {prev}."],
    next: ["Teraz {next}.", "A teraz {next}.", "Lecimy dalej: {next}."],
    dj: " Miksuję electronic, hip-hop i disco.",
  },
  en: {
    welcome: ["Hi, I'm Nova, the AI voice of GrouaRadio. Here comes {block}.", "Welcome to GrouaRadio! I'm Nova, your AI host. On air: {block}."],
    block: ["It's {time}, and we're moving into {block}.", "{time} on the clock, time for {block}.", "Switching the vibe: now {block}."],
    hour: ["It's {time}. You're listening to GrouaRadio with Nova, an AI voice.", "{time}, GrouaRadio. I'm Nova, your AI host, and the music keeps going."],
    back: ["That was {prev}.", "You just heard {prev}.", "That one was {prev}."],
    next: ["Now {next}.", "Up next, {next}.", "Here's {next}."],
    dj: " I'm mixing electronic, hip-hop and disco.",
  },
  nl: {
    welcome: ["Hoi, ik ben Nova, de AI-stem van GrouaRadio. We draaien {block}.", "Welkom bij GrouaRadio! Ik ben Nova, je AI-presentator. Nu op de radio: {block}."],
    block: ["Het is {time}, we gaan over naar {block}.", "{time} op de klok, tijd voor {block}.", "Andere sfeer: nu {block}."],
    hour: ["Het is {time}. Je luistert naar GrouaRadio met Nova, een AI-stem.", "{time}, GrouaRadio. Ik ben Nova, je AI-presentator, en de muziek gaat door."],
    back: ["Dat was {prev}.", "Je hoorde net {prev}.", "Zojuist: {prev}."],
    next: ["Nu {next}.", "En nu {next}.", "Hier is {next}."],
    dj: " Ik mix electronic, hiphop en disco.",
  },
  ua: {
    welcome: ["Привіт, я Nova, голос ШІ на GrouaRadio. Звучить {block}.", "Вітаю на GrouaRadio! Я Nova, ведуча ШІ. В ефірі {block}."],
    block: ["Зараз {time}, переходимо до: {block}.", "{time} на годиннику, час для: {block}.", "Змінюємо настрій: тепер {block}."],
    hour: ["Зараз {time}. Ви слухаєте GrouaRadio, веде Nova, голос ШІ.", "{time}, GrouaRadio. Я Nova, ведуча ШІ, і музика триває."],
    back: ["Це був {prev}.", "Щойно звучав {prev}.", "Ви чули {prev}."],
    next: ["Тепер {next}.", "А зараз {next}.", "Далі {next}."],
    dj: " Мікшую електронік, хіп-хоп і диско.",
  },
};

// Filtr treści: słowa, których prezenterka nie wypowie (gdy są w tytule, pomija tytuł).
const BLOCKED = /\b(kurw\w*|chuj\w*|jeb\w*|pierdol\w*|fuck\w*|shit|bitch|cunt|nigg\w*|kanker\w*|kut\w*|hoer\w*|бля\w*|хуй\w*|сук\w*|nazi\w*|hitler|porn\w*|sex\w*)\b/i;

/** Czyści tytuł/wykonawcę do odczytu: bez dopisków „(Official Video)”, linków, emoji i nadmiaru znaków. */
export function cleanForAir(s: string | null | undefined, max = 60): string {
  let t = String(s ?? "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[([](official|lyric|lyrics|audio|video|visualizer|hd|4k|remaster(ed)?)[^)\]]*[)\]]/gi, "")
    .replace(/\.(mp3|wav|m4a|flac)$/i, "")
    .replace(/[\p{Extended_Pictographic}]/gu, "")
    .replace(/[_#*~|<>{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, "");
  return t;
}

export const safeForAir = (text: string) => !!text.trim() && !BLOCKED.test(text) && !/https?:\/\//i.test(text);

const describe = (t: T | null | undefined): string | null => {
  if (!t) return null;
  const title = cleanForAir(t.title), artist = cleanForAir(t.artist, 40);
  const s = artist && !/^unknown|nieznany$/i.test(artist) ? `${title}, ${artist}` : title;
  return s && safeForAir(s) ? `„${s}”` : null;
};

/** Gotowa kwestia prezenterki (albo null, gdy nie ma czego bezpiecznie powiedzieć). */
export function hostLine(c: HostCtx): string | null {
  const t = TPL[c.lang];
  const pick = (arr: string[], k = 0) => arr[(c.seed + k) % arr.length];
  const time = `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
  const block = BLOCK_NAMES[c.lang][c.block];
  const fill = (s: string) => s.replace("{time}", time).replace("{block}", block);
  let line = "";
  const nxt = describe(c.next);
  if (c.kind === "back") {
    const prv = describe(c.prev);
    if (!prv && !nxt) return null;
    line = [prv ? pick(t.back).replace("{prev}", prv) : "", nxt ? pick(t.next, 1).replace("{next}", nxt) : ""].filter(Boolean).join(" ");
  } else {
    line = fill(pick(t[c.kind]));
    if (nxt && c.kind !== "welcome") line += " " + pick(t.next, 2).replace("{next}", nxt);
  }
  if (c.dj && (c.kind === "block" || c.kind === "welcome")) line += t.dj;
  return safeForAir(line) ? line : null;
}

/** Stan prezenterki między utworami. */
export interface HostState { welcomed: boolean; lastBlock: BlockId | null; lastHour: number | null; tracksSince: number; lastSpokeAt: number }
export const initialHostState = (): HostState => ({ welcomed: false, lastBlock: null, lastHour: null, tracksSince: 0, lastSpokeAt: 0 });

/**
 * Czy prezenterka mówi przy starcie tego utworu i co. Zasady: powitanie raz; zmiana bloku;
 * pełna godzina (czas + identyfikacja z ujawnieniem AI); co 4 utwory zapowiedź; nie częściej niż co 6 min.
 */
export function decideHost(s: HostState, now: { block: BlockId; hour: number; ms: number }): { kind: HostKind | null; next: HostState } {
  const next: HostState = { ...s, tracksSince: s.tracksSince + 1 };
  let kind: HostKind | null = null;
  const gapOk = now.ms - s.lastSpokeAt >= 6 * 60_000;
  if (!s.welcomed) kind = "welcome";
  else if (s.lastBlock !== null && now.block !== s.lastBlock) kind = "block";
  else if (s.lastHour !== null && now.hour !== s.lastHour && gapOk) kind = "hour";
  else if (s.tracksSince + 1 >= 4 && gapOk) kind = "back";
  next.lastBlock = now.block;
  next.lastHour = now.hour;
  if (kind) { next.welcomed = true; next.tracksSince = 0; next.lastSpokeAt = now.ms; }
  return { kind, next };
}
