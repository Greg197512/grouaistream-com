import type { Language } from "@/i18n/translations";

/**
 * Rozpoznawanie komend głosowych bez zależności od przeglądarki.
 * Ignoruje wielkość liter, polskie znaki, interpunkcję i drobne pomyłki
 * rozpoznawania mowy. Komenda zwraca intencję albo null (wtedy odpowiada AI).
 */

export type VoiceIntent =
  | { kind: "shutdown" }
  | { kind: "pause" }
  | { kind: "stop_dj" }
  | { kind: "resume" }
  | { kind: "next" }
  | { kind: "previous" }
  | { kind: "volume_up" }
  | { kind: "volume_down" }
  | { kind: "volume_set"; percent: number }
  | { kind: "mute" }
  | { kind: "unmute" }
  | { kind: "repeat" }
  | { kind: "shuffle" }
  | { kind: "restart" }
  | { kind: "seek_end" }
  | { kind: "seek"; deltaSec: number }
  | { kind: "radio" }
  | { kind: "studio" }
  | { kind: "party" }
  | { kind: "navigate"; route: string }
  | { kind: "play"; query: string; mood?: string; count?: number };

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, jeden: 1, jedna: 1, jedno: 1, one: 1, een: 1,
  dwa: 2, dwie: 2, two: 2, twee: 2,
  trzy: 3, three: 3, drie: 3,
  cztery: 4, four: 4, vier: 4,
  piec: 5, pieciu: 5, five: 5, vijf: 5,
  szesc: 6, szesciu: 6, six: 6, zes: 6,
  siedem: 7, siedmiu: 7, seven: 7, zeven: 7,
  osiem: 8, osmiu: 8, eight: 8, acht: 8,
  dziewiec: 9, dziewieciu: 9, nine: 9, negen: 9,
  dziesiec: 10, dziesieciu: 10, ten: 10, tien: 10,
  pietnascie: 15, fifteen: 15, vijftien: 15,
  dwadziescia: 20, twenty: 20, twintig: 20,
  trzydziesci: 30, thirty: 30, dertig: 30,
  piecdziesiat: 50, fifty: 50, vijftig: 50,
  sto: 100, hundred: 100,
};

const FUZZY_WORDS = [
  "nastepny", "poprzedni", "glosniej", "ciszej", "zatrzymaj", "wstrzymaj",
  "odtworz", "wycisz", "kontynuuj", "powtarzaj", "studio", "radio", "pauza",
  "zagraj", "impreza", "previous", "volume", "quieter", "louder",
];

const PAGES: Record<string, string> = {
  "strona glowna": "/",
  glowna: "/",
  home: "/",
  thuis: "/",
  szukaj: "/search",
  wyszukaj: "/search",
  search: "/search",
  zoeken: "/search",
  biblioteka: "/library",
  biblioteke: "/library",
  library: "/library",
  bibliotheek: "/library",
  ulubione: "/liked",
  polubione: "/liked",
  favorites: "/liked",
  favourites: "/liked",
  liked: "/liked",
  favorieten: "/liked",
  ustawienia: "/settings",
  settings: "/settings",
  instellingen: "/settings",
  filmy: "/movies",
  movies: "/movies",
  serwer: "/server",
  server: "/server",
  playlisty: "/playlist-manager",
  "mood history": "/mood-history",
  "historia nastroju": "/mood-history",
};

const MOODS: Array<[string, string]> = [
  ["smut", "sad"],
  ["melanch", "sad"],
  ["teskn", "sad"],
  ["wesol", "happy"],
  ["rados", "happy"],
  ["happy", "happy"],
  ["spokoj", "chill"],
  ["relaks", "chill"],
  ["chill", "chill"],
  ["energi", "energetic"],
  ["tanc", "energetic"],
  ["dance", "energetic"],
  ["imprezow", "energetic"],
  ["romant", "romantic"],
  ["milos", "romantic"],
  ["focus", "focus"],
  ["skup", "focus"],
  ["sen", "chill"],
  ["sleep", "chill"],
];

const GENRE_WORDS = [
  "rock", "pop", "punk", "disco", "jazz", "blues", "metal", "hip-hop", "hip hop",
  "hiphop", "rap", "electronic", "elektronika", "elektroniczna", "techno", "house",
  "classical", "klasyka", "klasyczna", "reggae", "soul", "funk", "country", "indie",
  "ambient", "latin", "latino", "folk", "rnb", "trance", "lofi", "lo-fi", "edm",
];

const PLAY_WORDS = [
  "graj", "zagraj", "odtworz", "odtworzyc", "pusc", "puscic", "wlacz", "odpal",
  "dawaj", "wrzuc", "play", "speel", "draai", "daj", "put", "give",
];

const FILLER = new Set([
  "mi", "mnie", "prosze", "no", "to", "ten", "ta", "te", "jakis", "jakas", "jakies",
  "cos", "muzyke", "muzyka", "muzyki", "utwor", "utworu", "piosenke", "piosenka",
  "song", "songs", "track", "tracks", "the", "a", "an", "some", "please", "me",
  "wat", "een", "troche", "teraz", "poprosze", "mozesz", "moze", "artysta",
  "artyste", "artist", "wykonawca", "gatunek", "genre", "nastroj", "nastroju",
  "mood", "of", "on", "for", "numery", "numer", "kawałki", "kawalki", "kawalkow",
]);

export function normalizeVoice(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[b.length];
}

const PROTECTED_TOKENS = new Set([
  "otworz", "pokaz", "przejdz", "wlacz", "wylacz", "start", "studio", "radio",
  "party", "pause", "pauza", "play", "graj", "pusc", "zagraj", "odtworz",
  "home", "next", "stop", "mute", "volume", "open", "show", "speel", "draai",
]);

function correctToken(token: string): string {
  if (token.length < 5 || PROTECTED_TOKENS.has(token)) return token;
  let best = token;
  let bestDistance = 2;
  for (const word of FUZZY_WORDS) {
    if (Math.abs(word.length - token.length) > 1) continue;
    const distance = levenshtein(token, word);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = word;
    }
  }
  return bestDistance <= 1 ? best : token;
}

function tokensOf(text: string): string[] {
  return text.split(" ").filter(Boolean).map(correctToken);
}

function hasToken(tokens: string[], words: string[]): boolean {
  return tokens.some((token) => words.includes(token));
}

function hasStem(tokens: string[], stems: string[]): boolean {
  return tokens.some((token) => stems.some((stem) =>
    token === stem || (stem.length >= 4 && token.startsWith(stem) && token.length <= stem.length + 6)
  ));
}

function hasPhrase(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text === phrase || ` ${text} `.includes(` ${phrase} `));
}

function parseNumber(text: string): number | undefined {
  const digit = text.match(/\b(\d{1,3})\b/);
  if (digit) return Math.min(100, parseInt(digit[1], 10));
  for (const token of text.split(" ")) {
    if (WORD_NUMBERS[token] != null) return WORD_NUMBERS[token];
  }
  return undefined;
}

function hasPlayVerb(tokens: string[]): boolean {
  return hasToken(tokens, PLAY_WORDS) || hasStem(tokens, ["odtworz", "zagraj", "pusc"]);
}

function hasImperative(text: string, tokens: string[]): boolean {
  return hasPlayVerb(tokens)
    || hasToken(tokens, ["pauza", "pause", "stop", "mute", "next", "skip", "radio", "studio", "party"])
    || hasStem(tokens, ["nastep", "kolejn", "poprzed", "glosn", "ciszej", "wycisz", "zatrzym", "wstrzym", "pauz"]);
}

export function isConversational(raw: string): boolean {
  const text = normalizeVoice(raw);
  if (!text) return false;
  const tokens = tokensOf(text);
  if (hasImperative(text, tokens)) return false;
  if (text.includes("?")) return true;
  return /^(co|kto|czym|czemu|jaki?e?a?|ile|kiedy|gdzie|dlaczego|czy|what|who|why|how|when|where|wat|wie|waarom|hoe|wanneer|що|хто|чому|як|коли|де)\b/.test(text)
    || hasPhrase(text, [
      "co tam", "co slychac", "co nowego", "jak tam", "whats up", "whats new",
      "hows it going", "hoe gaat het", "jak sie masz",
    ]);
}

export function isExplicitDjPhrase(raw: string): boolean {
  const text = normalizeVoice(raw);
  return hasPhrase(text, [
    "dj", "didzej", "disc jockey", "set muzyczny", "zrob set", "zrob dj",
    "postaw domowke", "haus party", "house party", "feestje", "peak time",
    "peak hour", "dawaj set", "tryb dj", "dj mode", "wlacz dj", "start dj",
  ]) || /\bdj\b/.test(text);
}

function stripName(text: string, assistantName?: string | null): string {
  if (!assistantName) return text;
  const name = normalizeVoice(assistantName);
  if (name.length < 2) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "g"), " ").replace(/\s+/g, " ").trim();
}

function isShutdown(text: string): boolean {
  return hasPhrase(text, [
    "wylacz sie", "zamknij sie", "shut down", "turn off", "go away",
    "schakel uit", "ga weg", "stop ermee", "wylacz asystenta", "zamknij asystenta",
  ]);
}

function wantsRadioOff(text: string, tokens: string[]): boolean {
  return /\bradio\b/.test(text) && (
    hasToken(tokens, ["stop", "pauza", "pause", "wylacz"]) || hasStem(tokens, ["zatrzym", "wstrzym"])
  );
}

function isRadio(text: string, tokens: string[]): boolean {
  if (!/\bradio\b/.test(text) || wantsRadioOff(text, tokens)) return false;
  if (["radio", "radio live", "radio na zywo", "groua radio", "live radio"].includes(text)) return true;
  return hasToken(tokens, [
    "wlacz", "odpal", "otworz", "uruchom", "start", "play", "graj", "pusc", "zagraj", "speel", "open", "show", "pokaz",
  ]) || hasPhrase(text, ["radio na zywo", "start radio", "turn on radio", "radio aan", "zet de radio"]);
}

function isStudio(text: string): boolean {
  if (text === "studio" || text === "suno" || text === "ai studio" || text === "music studio") return true;
  return /\bstudio\b/.test(text) && hasPhrase(text, [
    "otworz studio", "otworz ai studio", "wlacz studio", "open studio",
    "show studio", "pokaz studio", "idz do studio", "uruchom studio",
  ]);
}

function isParty(text: string, tokens: string[]): boolean {
  if (/tryb imprez|party mode|tryb party|parkiet|feestmodus|party modus|aktywuj parkiet/.test(text)) return true;
  if (hasPhrase(text, ["open party", "otworz party", "wlacz party", "start party", "wlacz impreze", "otworz impreze"])) return true;
  if (hasPlayVerb(tokens) || /\bmuzyk/.test(text)) return false;
  return tokens.some((token) => token === "party" || token.startsWith("imprez") || token.startsWith("domow"));
}

function matchVolumeSet(text: string, tokens: string[]): number | null {
  if (hasPhrase(text, ["na full", "na ful", "na maksa", "full volume", "max volume", "volume max", "glosnosc max"])) {
    return 100;
  }
  const aboutVolume = /\b(glosnosc|volume|geluid|gučn|гучн|громк)\b/.test(text)
    || hasStem(tokens, ["glosnosc"]);
  if (!aboutVolume) return null;
  if (hasToken(tokens, ["glosniej", "ciszej", "louder", "quieter", "up", "down"]) && !hasToken(tokens, ["na", "to", "op", "set", "ustaw"])) {
    return null;
  }
  const value = parseNumber(text);
  if (value == null) return null;
  return Math.max(0, Math.min(100, value));
}

function isUnmute(text: string): boolean {
  return hasPhrase(text, [
    "unmute", "wlacz dzwiek", "odcisz", "ze zvukiem", "z dzwiekiem", "geluid aan", "sound on",
  ]);
}

function isMute(text: string, tokens: string[]): boolean {
  if (isUnmute(text)) return false;
  return hasToken(tokens, ["mute", "wycisz", "dempen", "silent"])
    || hasPhrase(text, ["bez dzwieku", "wylacz dzwiek", "mute sound"]);
}

function isVolumeUp(text: string, tokens: string[]): boolean {
  return hasToken(tokens, ["glosniej", "podglos", "poglos", "louder", "harder", "luider", "гучніше", "голосніше"])
    || hasPhrase(text, ["volume up", "turn it up", "zwieksz glosnosc", "podnies glosnosc"]);
}

function isVolumeDown(text: string, tokens: string[]): boolean {
  return hasToken(tokens, ["ciszej", "scisz", "przycisz", "quieter", "softer", "zachter", "stiller", "тихіше"])
    || hasPhrase(text, ["volume down", "turn it down", "zmniejsz glosnosc"]);
}

function isNext(text: string, tokens: string[]): boolean {
  if (hasPhrase(text, ["graj dalej", "play on", "keep playing"])) return false;
  return hasStem(tokens, ["nastep", "kolejn", "volgend", "наступ"])
    || hasToken(tokens, ["next", "skip", "dalej", "pomin", "skipuj", "volgende", "overslaan", "далі", "наступний", "наступна"])
    || hasPhrase(text, ["nastepny utwor", "next track", "skip track"]);
}

function isPrevious(text: string, tokens: string[]): boolean {
  if (hasPhrase(text, ["cofnij", "przewin"]) && /\b(sekund|minut|second|minute|min)\b/.test(text)) return false;
  if (text === "back" || text === "go back") return true;
  return hasStem(tokens, ["poprzed", "поперед"])
    || hasToken(tokens, ["previous", "prev", "wstecz", "cofnij", "vorige", "назад"]);
}

function matchSeek(text: string): VoiceIntent | null {
  const timed = /\b(sekund|sekunt|second|minut|minute|min|sec)\b/.test(text)
    && /\b(przewin|cofnij|przodu|tylu|wstecz|forward|rewind|skip|spoel|terug|vooruit)\b/.test(text);
  if (!timed) {
    if (hasPhrase(text, ["na poczatek", "poczatek utworu", "from the start", "from the beginning", "start over", "od poczatku", "od nowa"])) {
      return { kind: "restart" };
    }
    if (hasPhrase(text, ["na koniec", "koniec utworu", "to the end"])) return { kind: "seek_end" };
    return null;
  }
  const back = /\b(cofnij|tylu|wstecz|rewind|back|terug)\b/.test(text);
  const minutes = /\b(minut|minute|min)\b/.test(text);
  const amount = parseNumber(text) ?? (minutes ? 1 : 30);
  const delta = amount * (minutes ? 60 : 1) * (back ? -1 : 1);
  return { kind: "seek", deltaSec: delta };
}

function isRepeat(tokens: string[]): boolean {
  return hasToken(tokens, ["repeat", "loop", "herhaal", "powtarzaj", "zapetl"])
    || hasStem(tokens, ["powtarz", "zapetl"]);
}

function isShuffle(tokens: string[], text: string): boolean {
  return hasToken(tokens, ["shuffle", "tasuj", "wymieszaj", "przetasuj", "husselen"])
    || hasPhrase(text, ["losowo", "random", "willekeurig"]);
}

function isPause(text: string, tokens: string[]): boolean {
  if (hasPlayVerb(tokens) || isVolumeDown(text, tokens) || isMute(text, tokens)) return false;
  if (hasPhrase(text, ["stop dj", "wylacz dj", "koniec setu", "zakoncz set"])) return false;
  return hasToken(tokens, [
    "stop", "stopp", "pauza", "pauzuj", "zapauzuj", "pause", "halt", "pauzeer", "pauzeren",
    "cisza", "ucisz", "silence", "quiet", "stilte", "пауза", "стоп", "зупини", "тиша",
  ]) || hasStem(tokens, ["zatrzym", "wstrzym", "pauz"])
    || hasPhrase(text, ["shut up", "wylacz muzyke", "wylacz player", "stop music"]);
}

function matchNavigate(text: string, tokens: string[]): VoiceIntent | null {
  if (PAGES[text]) return { kind: "navigate", route: PAGES[text] };
  const open = hasToken(tokens, ["otworz", "pokaz", "przejdz", "open", "show", "toon", "navigate", "wlacz", "idz"]);
  if (!open) return null;
  const entries = Object.entries(PAGES).sort((a, b) => b[0].length - a[0].length);
  for (const [key, route] of entries) {
    if (text === key || ` ${text} `.includes(` ${key} `)) return { kind: "navigate", route };
  }
  return null;
}

function detectMood(text: string): string | undefined {
  const hit = MOODS.find(([stem]) => text.includes(stem));
  return hit?.[1];
}

function matchPlay(text: string, tokens: string[]): VoiceIntent | null {
  const bareResume = [
    "graj", "play", "speel", "resume", "wznow", "wznów", "kontynuuj", "odpauzuj",
    "continue", "hervat", "graj dalej", "play on", "keep playing",
  ];
  if (hasPhrase(text, ["graj dalej", "play on", "keep playing", "wznow", "kontynuuj", "odpauzuj", "resume", "continue", "hervat"])) {
    return { kind: "resume" };
  }
  if (bareResume.includes(text)) return { kind: "resume" };

  const play = hasPlayVerb(tokens);
  const genre = GENRE_WORDS.find((word) => text === word || ` ${text} `.includes(` ${word} `));
  const mood = detectMood(text);
  const count = parseNumber(text);

  if (!play) {
    if (tokens.length <= 3 && genre && !mood) return { kind: "play", query: genre, count };
    if (tokens.length <= 4 && mood && !genre) return { kind: "play", query: mood, mood, count };
    return null;
  }

  if (/\b(how|what|why|dlaczego|kiedy|gdzie|czy|waarom|hoe)\b/.test(text) && !tokens.slice(0, 2).some((token) => PLAY_WORDS.includes(token))) {
    return null;
  }

  const cleanedTokens = tokens.filter((token) => {
    if (PLAY_WORDS.includes(token)) return false;
    if (FILLER.has(token)) return false;
    if (/^\d+$/.test(token)) return false;
    if (WORD_NUMBERS[token] != null) return false;
    return true;
  });
  const query = cleanedTokens.join(" ").trim();
  if (!query || query === "mix" || query === "music" || query === "muzyka") {
    return { kind: "play", query: "mix", count };
  }
  const queryMood = detectMood(query);
  const onlyMood = queryMood && cleanedTokens.every((token) => MOODS.some(([stem]) => token.startsWith(stem)) || ["muzyka", "music", "cos"].includes(token));
  if (onlyMood && queryMood) return { kind: "play", query: queryMood, mood: queryMood, count };
  return { kind: "play", query, mood: queryMood, count };
}

export function parseVoiceCommand(raw: string, opts?: { assistantName?: string | null }): VoiceIntent | null {
  const text = stripName(normalizeVoice(raw), opts?.assistantName);
  if (text.length < 2) return null;
  const tokens = tokensOf(text);
  const normalized = tokens.join(" ");

  if (isShutdown(normalized)) return { kind: "shutdown" };
  if (hasPhrase(normalized, ["stop dj", "wylacz dj", "koniec setu", "zakoncz set", "stop the dj"])) {
    return { kind: "stop_dj" };
  }
  if (wantsRadioOff(normalized, tokens) || (isPause(normalized, tokens) && /\bradio\b/.test(normalized))) {
    return { kind: "pause" };
  }
  if (isRadio(normalized, tokens)) return { kind: "radio" };
  if (isStudio(normalized)) return { kind: "studio" };
  if (isParty(normalized, tokens)) return { kind: "party" };

  if (isConversational(normalized)) return null;

  const volume = matchVolumeSet(normalized, tokens);
  if (volume != null) return { kind: "volume_set", percent: volume };
  if (isUnmute(normalized)) return { kind: "unmute" };
  if (isMute(normalized, tokens)) return { kind: "mute" };
  if (isVolumeUp(normalized, tokens)) return { kind: "volume_up" };
  if (isVolumeDown(normalized, tokens)) return { kind: "volume_down" };
  if (isNext(normalized, tokens)) return { kind: "next" };
  if (isPrevious(normalized, tokens)) return { kind: "previous" };

  const seek = matchSeek(normalized);
  if (seek) return seek;
  if (isRepeat(tokens)) return { kind: "repeat" };
  if (isShuffle(tokens, normalized)) return { kind: "shuffle" };
  if (isPause(normalized, tokens)) return { kind: "pause" };

  const nav = matchNavigate(normalized, tokens);
  if (nav) return nav;

  return matchPlay(normalized, tokens);
}

export function voiceMissedReply(lang: Language, heard: string): string {
  const clean = heard.replace(/\s+/g, " ").trim().slice(0, 140);
  const hint: Record<Language, string> = {
    pl: `Usłyszałem: „${clean}”. Powiedz na przykład: graj, pauza, następny, głośniej, puść rock, włącz radio.`,
    en: `I heard: “${clean}”. Try: play, pause, next, volume up, play rock, start radio.`,
    nl: `Ik hoorde: „${clean}”. Zeg bijvoorbeeld: speel, pauze, volgende, harder, start radio.`,
    ua: `Я почув: „${clean}”. Скажіть, наприклад: грай, пауза, наступний, гучніше, увімкни радіо.`,
  };
  return hint[lang] || hint.pl;
}

export function voiceConfirm(lang: Language, intent: VoiceIntent, detail?: string): string {
  const pack = (pl: string, en: string, nl: string, ua: string) =>
    ({ pl, en, nl, ua } as Record<Language, string>)[lang] || pl;
  switch (intent.kind) {
    case "shutdown": return pack("Wyłączam się. Do zobaczenia!", "Turning off. See you!", "Ik ga uit. Tot ziens!", "Вимикаюсь. До зустрічі!");
    case "pause": return pack("Zatrzymuję", "Pausing", "Pauzeren", "Зупиняю");
    case "stop_dj": return pack("Kończę set DJ", "Stopping the DJ set", "DJ-set stoppen", "Зупиняю DJ");
    case "resume": return pack("Odtwarzam", "Playing", "Afspelen", "Граю");
    case "next": return pack("Następny utwór", "Next track", "Volgend nummer", "Наступний трек");
    case "previous": return pack("Poprzedni utwór", "Previous track", "Vorig nummer", "Попередній трек");
    case "volume_up": return pack("Głośniej", "Louder", "Harder", "Гучніше");
    case "volume_down": return pack("Ciszej", "Quieter", "Zachter", "Тихіше");
    case "volume_set": return pack(`Głośność ${intent.percent} procent`, `Volume ${intent.percent} percent`, `Volume ${intent.percent} procent`, `Гучність ${intent.percent} відсотків`);
    case "mute": return pack("Wyciszono", "Muted", "Gedempt", "Без звуку");
    case "unmute": return pack("Włączam dźwięk", "Sound on", "Geluid aan", "Звук увімкнено");
    case "repeat": return pack("Zmieniam powtarzanie", "Toggling repeat", "Herhalen aangepast", "Повтор змінено");
    case "shuffle": return pack("Przełączam losowe odtwarzanie", "Toggling shuffle", "Shuffle aangepast", "Перемішування змінено");
    case "restart": return pack("Od początku", "From the start", "Vanaf het begin", "Спочатку");
    case "seek_end": return pack("Na koniec", "To the end", "Naar het einde", "У кінець");
    case "seek": return pack(intent.deltaSec < 0 ? "Cofam" : "Przewijam", intent.deltaSec < 0 ? "Rewinding" : "Fast forwarding", intent.deltaSec < 0 ? "Terugspoelen" : "Vooruitspoelen", intent.deltaSec < 0 ? "Назад" : "Вперед");
    case "radio": return pack("Włączam GrouaRadio", "Starting GrouaRadio", "GrouaRadio aan", "Вмикаю GrouaRadio");
    case "studio": return pack("Otwieram studio", "Opening the studio", "Studio openen", "Відкриваю студію");
    case "party": return pack("Otwieram tryb imprezy", "Opening party mode", "Feestmodus openen", "Відкриваю режим вечірки");
    case "navigate": return pack("Otwieram", "Opening", "Openen", "Відкриваю");
    case "play": return detail
      ? pack(`Odtwarzam ${detail}`, `Playing ${detail}`, `Afspelen: ${detail}`, `Граю ${detail}`)
      : pack("Odtwarzam", "Playing", "Afspelen", "Граю");
    default: return pack("Zrobione", "Done", "Klaar", "Готово");
  }
}
