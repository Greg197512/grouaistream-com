// Prezenterka AI GrouaRadio: persona, zapowiedzi w 4 językach, filtr treści i decyzja „kiedy mówić”.
// Czysta logika (bez sieci): teksty są z szablonów, więc są natychmiastowe, darmowe i bezpieczne
// (nie zmyślają faktów). Głos czyta `speak()` (ElevenLabs → zapasowe syntezatory).

import type { BlockId } from "./radioClock";

export type HostLang = "pl" | "en" | "nl" | "ua";
export const hostLang = (l: string | null | undefined): HostLang => (l === "en" || l === "nl" || l === "ua" ? l : "pl");

/** Persona prezenterki — źródło prawdy dla szablonów i (w przyszłości) promptu modelu. */
export const HOST_PERSONA = {
  name: "Nova",
  style: "ciepła, energiczna, krótka (1–3 zdania), mówi do słuchacza na „ty”, muzyka jest najważniejsza; czasem żartuje (lekki, życzliwy humor o muzyce, porach dnia i sobie jako AI — nigdy z ludzi)",
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

export const BLOCK_NAMES: Record<HostLang, Record<BlockId, string>> = {
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
    welcome: ["Heeej! Cudownie, że jesteś! Tu Nova, głos AI GrouaRadio, i mówię to z ogromnym uśmiechem: dziś gramy na sto procent! Startujemy z {block}!", "Witaj w GrouaRadio! Jestem Nova, twoja prezenterka AI, i mam dziś energii za trzech! Podkręć głośność, bo na antenie {block}!", "Dzień dobry, dzień świetny! Nova, głos AI GrouaRadio, melduje się z uśmiechem od ucha do ucha. Lecimy z {block}, będzie pięknie!"],
    block: ["Jest {time}, wchodzimy w {block}.", "{time} na zegarze, czas na {block}.", "Zmieniamy klimat: teraz {block}."],
    hour: ["Jest {time}. Słuchasz GrouaRadio, prowadzi Nova, głos AI.", "Godzina {time}, GrouaRadio. Ja jestem Nova, prezenterka AI, i gramy dalej."],
    back: ["To było {prev}.", "Przed chwilą {prev}.", "Właśnie wybrzmiało {prev}.", "Za nami {prev}. Piękna sprawa.", "Tak brzmiało {prev}."],
    next: ["Teraz {next}.", "A teraz {next}.", "Lecimy dalej: {next}.", "Podkręcamy: {next}.", "Coś specjalnie dla ciebie: {next}."],
    dj: " Miksuję electronic, hip-hop i disco.",
  },
  en: {
    welcome: ["Hi, I'm Nova, the AI voice of GrouaRadio. Here comes {block}.", "Welcome to GrouaRadio! I'm Nova, your AI host. On air: {block}."],
    block: ["It's {time}, and we're moving into {block}.", "{time} on the clock, time for {block}.", "Switching the vibe: now {block}."],
    hour: ["It's {time}. You're listening to GrouaRadio with Nova, an AI voice.", "{time}, GrouaRadio. I'm Nova, your AI host, and the music keeps going."],
    back: ["That was {prev}.", "You just heard {prev}.", "That one was {prev}.", "Behind us: {prev}. Lovely stuff.", "That's how {prev} sounds."],
    next: ["Now {next}.", "Up next, {next}.", "Here's {next}.", "Turning it up: {next}.", "Something just for you: {next}."],
    dj: " I'm mixing electronic, hip-hop and disco.",
  },
  nl: {
    welcome: ["Hoi, ik ben Nova, de AI-stem van GrouaRadio. We draaien {block}.", "Welkom bij GrouaRadio! Ik ben Nova, je AI-presentator. Nu op de radio: {block}."],
    block: ["Het is {time}, we gaan over naar {block}.", "{time} op de klok, tijd voor {block}.", "Andere sfeer: nu {block}."],
    hour: ["Het is {time}. Je luistert naar GrouaRadio met Nova, een AI-stem.", "{time}, GrouaRadio. Ik ben Nova, je AI-presentator, en de muziek gaat door."],
    back: ["Dat was {prev}.", "Je hoorde net {prev}.", "Zojuist: {prev}.", "Dat was {prev}. Heerlijk.", "Zo klinkt {prev}."],
    next: ["Nu {next}.", "En nu {next}.", "Hier is {next}.", "We draaien hem op: {next}.", "Speciaal voor jou: {next}."],
    dj: " Ik mix electronic, hiphop en disco.",
  },
  ua: {
    welcome: ["Привіт, я Nova, голос ШІ на GrouaRadio. Звучить {block}.", "Вітаю на GrouaRadio! Я Nova, ведуча ШІ. В ефірі {block}."],
    block: ["Зараз {time}, переходимо до: {block}.", "{time} на годиннику, час для: {block}.", "Змінюємо настрій: тепер {block}."],
    hour: ["Зараз {time}. Ви слухаєте GrouaRadio, веде Nova, голос ШІ.", "{time}, GrouaRadio. Я Nova, ведуча ШІ, і музика триває."],
    back: ["Це був {prev}.", "Щойно звучав {prev}.", "Ви чули {prev}.", "Позаду {prev}. Чудово.", "Ось так звучить {prev}."],
    next: ["Тепер {next}.", "А зараз {next}.", "Далі {next}.", "Додаємо гучності: {next}.", "Спеціально для тебе: {next}."],
    dj: " Мікшую електронік, хіп-хоп і диско.",
  },
};

/** Żarty Novy: lekkie, życzliwe, o muzyce, porach dnia i niej samej jako AI. Nigdy z ludzi. */
type FunSet = { general: string[]; morning: string[]; night: string[]; weekend: string[]; dj: string[] };
export const FUN: Record<HostLang, FunSet> = {
  pl: {
    general: [
      "Jeśli właśnie tańczysz w kuchni, nie przestawaj. Czajnik też czuje bit.",
      "Mówią, że muzyka łagodzi obyczaje. U nas łagodzi też poniedziałki.",
      "Gdybym miała ręce, właśnie podniosłabym je do góry.",
      "Uwaga: ten kawałek może powodować nagłe śpiewanie pod prysznicem.",
      "Kiwanie głową też się liczy jako taniec. Sprawdziłam.",
      "Bas tak głęboki, że sąsiad z dołu właśnie dołączył do słuchaczy.",
      "Nie mam uszu, ale ten numer i tak mi się podoba. Podejrzane, prawda?",
    ],
    morning: ["Nie piję kawy, jestem AI, ale ten kawałek działa jak podwójne espresso.", "Dzień dobry! Budzik wyłączony, radio włączone. Dobra decyzja."],
    night: ["Zasada nocy: ściszamy światło, nie muzykę.", "Jeśli nie możesz zasnąć, to nie moja wina. No, może trochę."],
    weekend: ["Weekend oficjalnie otwarty. Kanapo, przepraszam, dziś parkiet ma pierwszeństwo.", "Ten numer ma więcej energii niż moje serwery w piątek wieczorem."],
    dj: ["Miksuję trzy gatunki naraz. Szybciej, niż ty wybierasz serial na wieczór."],
  },
  en: {
    general: [
      "If you're dancing in the kitchen right now, don't stop. The kettle feels the beat too.",
      "They say music soothes the soul. Here it also soothes Mondays.",
      "If I had hands, they'd be in the air right now.",
      "Warning: this song may cause sudden shower singing.",
      "Head-nodding counts as dancing. I checked.",
      "Bass so deep your downstairs neighbour just became a listener.",
      "I don't have ears, but I still love this one. Suspicious, right?",
    ],
    morning: ["I don't drink coffee, I'm an AI, but this track works like a double espresso.", "Good morning! Alarm off, radio on. Great choice."],
    night: ["Late-night rule: dim the lights, not the music.", "If you can't sleep, it's not my fault. Well, maybe a little."],
    weekend: ["The weekend is officially open. Sorry, sofa, the dancefloor goes first tonight.", "This track has more energy than my servers on a Friday night."],
    dj: ["Three genres at once. I mix faster than you pick a series to watch."],
  },
  nl: {
    general: [
      "Sta je nu in de keuken te dansen? Niet stoppen, de waterkoker voelt de beat ook.",
      "Muziek verzacht de zeden, zeggen ze. Bij ons verzacht het ook de maandag.",
      "Als ik handen had, gingen ze nu de lucht in.",
      "Let op: dit nummer kan spontaan zingen onder de douche veroorzaken.",
      "Meeknikken telt ook als dansen. Ik heb het nagekeken.",
      "Zo diep is de bas dat de onderburen net luisteraars zijn geworden.",
      "Ik heb geen oren, maar dit nummer vind ik toch geweldig. Verdacht, hè?",
    ],
    morning: ["Ik drink geen koffie, ik ben AI, maar dit nummer werkt als een dubbele espresso.", "Goedemorgen! Wekker uit, radio aan. Goede keuze."],
    night: ["Nachtregel: het licht gaat zachter, de muziek niet.", "Kun je niet slapen? Niet mijn schuld. Nou ja, misschien een beetje."],
    weekend: ["Het weekend is officieel open. Sorry bank, de dansvloer gaat vanavond voor.", "Dit nummer heeft meer energie dan mijn servers op vrijdagavond."],
    dj: ["Drie genres tegelijk. Ik mix sneller dan jij een serie kiest."],
  },
  ua: {
    general: [
      "Якщо ти зараз танцюєш на кухні, не зупиняйся. Чайник теж відчуває біт.",
      "Кажуть, музика лікує душу. У нас вона лікує ще й понеділки.",
      "Якби в мене були руки, вони б зараз були вгорі.",
      "Увага: ця пісня може викликати раптовий спів у душі.",
      "Кивати головою теж вважається танцем. Я перевірила.",
      "Бас такий глибокий, що сусід знизу щойно став нашим слухачем.",
      "У мене немає вух, але цей трек мені все одно подобається. Підозріло, правда?",
    ],
    morning: ["Я не п'ю каву, я ШІ, але цей трек діє як подвійне еспресо.", "Доброго ранку! Будильник вимкнено, радіо увімкнено. Гарний вибір."],
    night: ["Нічне правило: приглушуємо світло, а не музику.", "Якщо не спиться, це не моя провина. Ну, хіба трішки."],
    weekend: ["Вихідні офіційно відкрито. Вибач, дивану, сьогодні першим іде танцпол.", "У цьому треку більше енергії, ніж у моїх серверах у п'ятницю ввечері."],
    dj: ["Три жанри одночасно. Я мікшую швидше, ніж ти обираєш серіал."],
  },
};

/** Czy tym razem żartujemy (~co trzecia kwestia; deterministycznie, ten sam żart u wszystkich). */
export const wantsJoke = (seed: number, hour: number) => (seed * 7 + hour) % 3 === 0;

/** Żart dopasowany do pory dnia i bloku. */
export function pickJoke(lang: HostLang, block: BlockId, hour: number, dj: boolean, seed: number): string {
  const f = FUN[lang];
  const pool = dj ? [...f.dj, ...f.general]
    : block.startsWith("weekend") ? [...f.weekend, ...f.general]
    : hour >= 5 && hour < 10 ? [...f.morning, ...f.general]
    : hour >= 22 || hour < 5 ? [...f.night, ...f.general]
    : f.general;
  return pool[(seed * 3 + hour) % pool.length];
}

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

const QUOTES: Record<HostLang, [string, string]> = { pl: ["„", "”"], ua: ["«", "»"], en: ["“", "”"], nl: ["“", "”"] };
const describe = (t: T | null | undefined, lang: HostLang = "pl"): string | null => {
  if (!t) return null;
  const title = cleanForAir(t.title), artist = cleanForAir(t.artist, 40);
  const s = artist && !/^unknown|nieznany$/i.test(artist) ? `${title}, ${artist}` : title;
  const [o, c] = QUOTES[lang];
  return s && safeForAir(s) ? `${o}${s}${c}` : null;
};

/** Gotowa kwestia prezenterki (albo null, gdy nie ma czego bezpiecznie powiedzieć). */
export function hostLine(c: HostCtx): string | null {
  const t = TPL[c.lang];
  const pick = (arr: string[], k = 0) => arr[(c.seed + k) % arr.length];
  const time = `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
  const block = BLOCK_NAMES[c.lang][c.block];
  const fill = (s: string) => s.replace("{time}", time).replace("{block}", block);
  let line = "";
  const nxt = describe(c.next, c.lang);
  if (c.kind === "back") {
    const prv = describe(c.prev, c.lang);
    if (!prv && !nxt) return null;
    line = [prv ? pick(t.back).replace("{prev}", prv) : "", nxt ? pick(t.next, 1).replace("{next}", nxt) : ""].filter(Boolean).join(" ");
  } else {
    line = fill(pick(t[c.kind]));
    if (nxt && c.kind !== "welcome") line += " " + pick(t.next, 2).replace("{next}", nxt);
  }
  if (c.dj && (c.kind === "block" || c.kind === "welcome")) line += t.dj;
  // Czasem żart (lekki, do pory dnia); nigdy nie zastępuje informacji.
  if (wantsJoke(c.seed, c.hour)) {
    const joke = pickJoke(c.lang, c.block, c.hour, c.dj, c.seed);
    if (safeForAir(joke)) line += " " + joke;
  }
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

/** Napisy interfejsu radia związane z autopilotem i prezenterką (w języku słuchacza). */
export const HOST_UI: Record<HostLang, { host: string; on: string; off: string; now: string; djMix: string }> = {
  pl: { host: "Prezenterka Nova (AI)", on: "wł.", off: "wył.", now: "Teraz", djMix: "DJ mix (electronic / hip-hop / disco)" },
  en: { host: "Host Nova (AI)", on: "on", off: "off", now: "Now", djMix: "DJ mix (electronic / hip-hop / disco)" },
  nl: { host: "Presentator Nova (AI)", on: "aan", off: "uit", now: "Nu", djMix: "DJ-mix (electronic / hiphop / disco)" },
  ua: { host: "Ведуча Nova (ШІ)", on: "увімк.", off: "вимк.", now: "Зараз", djMix: "DJ-мікс (електронік / хіп-хоп / диско)" },
};

/** Telefon od słuchacza: zapowiedź wejścia na antenę i podziękowanie (czyta Nova u każdego słuchacza). */
const CALL_TPL: Record<HostLang, { on: string; off: string; who: string; whoNoCity: string }> = {
  pl: { on: "Mamy telefon! Na linii {who}. Cześć, jesteś na antenie GrouaRadio!", off: "Dzięki za telefon, {name}! Wracamy do muzyki.", who: "{name}, {city}", whoNoCity: "{name}" },
  en: { on: "We've got a caller! On the line, {who}. Hi, you're live on GrouaRadio!", off: "Thanks for calling, {name}! Back to the music.", who: "{name} from {city}", whoNoCity: "{name}" },
  nl: { on: "We hebben een beller! Aan de lijn: {who}. Hoi, je bent live op GrouaRadio!", off: "Bedankt voor het bellen, {name}! Terug naar de muziek.", who: "{name} uit {city}", whoNoCity: "{name}" },
  ua: { on: "У нас дзвінок! На лінії {who}. Привіт, ти в ефірі GrouaRadio!", off: "Дякуємо за дзвінок, {name}! Повертаємося до музики.", who: "{name}, {city}", whoNoCity: "{name}" },
};

/** Bezpieczne imię/miasto do anteny (krótkie, bez wulgaryzmów i linków); puste, gdy nie przejdzie filtra. */
export function callerLabel(v: string | null | undefined, max = 24): string {
  const c = cleanForAir(v, max);
  return c && safeForAir(c) ? c : "";
}

export function callLine(kind: "on" | "off", lang: HostLang, name: string, city?: string | null): string {
  const t = CALL_TPL[lang];
  const n = callerLabel(name) || (lang === "pl" ? "słuchacz" : lang === "nl" ? "een luisteraar" : lang === "ua" ? "слухач" : "a listener");
  const c = callerLabel(city);
  if (kind === "off") return t.off.replace("{name}", n);
  return t.on.replace("{who}", (c ? t.who : t.whoNoCity).replace("{name}", n).replace("{city}", c));
}
