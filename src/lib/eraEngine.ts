// GROUA ERA — Nostalgia Engine (warstwa frontendowa, bez zmian w backendzie).
// Epoka liczona po stronie przeglądarki z danych, które utwory JUŻ mają
// (gatunek, nastrój, tempo). Zero nowych tabel, zero tokenów, zero ingerencji
// w istniejący system — ERA tylko czyta katalog i grupuje go po klimacie.

export interface EraPalette {
  accent: string;      // główny akcent epoki
  accentSoft: string;  // tło akcentu
  glow: string;        // poświata
  bg: string;          // ciemne tło strony epoki
}

export interface Era {
  key: string;         // '1990s', 'y2k', 'now'
  label: string;       // '1990s'
  tagline: string;     // krótki klimat
  decade: string;
  yearStart: number;
  yearEnd: number;
  emoji: string;
  genres: string[];    // dopasowanie po gatunku (lowercase)
  moods: string[];     // dopasowanie po nastroju
  tempo: [number, number];
  instrumentation: string[];
  vibe: string;        // opis brzmienia (UI + baza promptu AI)
  visual: string;      // estetyka wizualna
  palette: EraPalette;
  // ── Warstwa wiedzy (edukacyjno-redakcyjna) ──
  description: string;              // narracja o epoce (2–3 zdania)
  artists: string[];               // znani twórcy epoki — KONTEKST/odniesienie, nie do naśladowania
  soundmarks: string[];            // co definiowało brzmienie
  culture: { label: string; value: string }[]; // moda / technologia / film / kultura
  didYouKnow: string;              // ciekawostka
}

// ── Taksonomia epok (docelowo tabela era_taxonomy; teraz statyczna w aplikacji) ──
export const ERAS: Era[] = [
  {
    key: "1970s", label: "1970s", tagline: "Analogowa dusza", decade: "1970s",
    yearStart: 1970, yearEnd: 1979, emoji: "🕺",
    genres: ["disco", "funk", "soul", "reggae", "folk", "rock"],
    moods: ["groovy", "warm", "happy", "romantic", "chill"],
    tempo: [100, 125],
    instrumentation: ["żywe smyczki", "gitara wah", "analogowy bas", "sekcja dęta"],
    vibe: "Ciepłe, analogowe granie na żywo — groove, funk i disco.",
    visual: "sepia, winyl, ziarno filmu, ciepłe złoto",
    palette: { accent: "#E0A24A", accentSoft: "#2A1F0C", glow: "#E0A24A55", bg: "#15100A" },
    description: "Złota era disco, funku i soulu — nagrania na żywo, orkiestrowe aranżacje i groove jako religia. To także rozkwit reggae i klasycznego rocka. Muzyka była ciepła, analogowa i taneczna.",
    artists: ["ABBA", "Bee Gees", "Donna Summer", "Bob Marley", "Stevie Wonder", "Led Zeppelin"],
    soundmarks: ["orkiestrowe disco", "gitara wah-wah", "slap bass", "chórki", "winyl"],
    culture: [
      { label: "Moda", value: "dzwony, afro, glam" },
      { label: "Technologia", value: "winyl, magnetofon kasetowy" },
      { label: "Film", value: "Gorączka sobotniej nocy" },
      { label: "Kultura", value: "kluby disco, Studio 54" },
    ],
    didYouKnow: "Studio 54 w Nowym Jorku stało się światowym symbolem nocnej kultury disco.",
  },
  {
    key: "1980s", label: "1980s", tagline: "Neonowy synth", decade: "1980s",
    yearStart: 1980, yearEnd: 1989, emoji: "🌆",
    genres: ["synth", "synth-pop", "new wave", "pop", "rock", "metal", "electronic"],
    moods: ["energetic", "romantic", "dreamy", "bold"],
    tempo: [110, 132],
    instrumentation: ["syntezatory", "gated reverb", "drum machine", "elektryczna gitara"],
    vibe: "Neonowe syntezatory, wielkie perkusje i romantyczny błysk.",
    visual: "neon, chrom, siatka retro, magenta i cyjan",
    palette: { accent: "#FF3E9A", accentSoft: "#2A0C1D", glow: "#FF3E9A55", bg: "#120A16" },
    description: "Dekada syntezatorów, automatów perkusyjnych i MTV. Synth-pop, new wave i glam metal rządzą listami, a hip-hop dopiero raczkuje. Wielkie brzmienie, gated reverb i romantyczny neonowy błysk.",
    artists: ["Michael Jackson", "Madonna", "Depeche Mode", "Prince", "Queen", "a-ha"],
    soundmarks: ["syntezatory analogowe", "gated reverb na werblu", "drum machine (LinnDrum)", "teledysk MTV"],
    culture: [
      { label: "Moda", value: "neon, ramoneska, big hair" },
      { label: "Technologia", value: "Walkman, debiut CD, pierwsze PC" },
      { label: "Film", value: "Blade Runner, Powrót do przyszłości" },
      { label: "Gry", value: "automaty arcade, NES" },
    ],
    didYouKnow: "Start MTV w 1981 zamienił muzykę w doświadczenie wizualne — teledysk stał się obowiązkiem.",
  },
  {
    key: "1990s", label: "1990s", tagline: "Surowo i na maksa", decade: "1990s",
    yearStart: 1990, yearEnd: 1999, emoji: "📼",
    genres: ["hip-hop", "rap", "grunge", "rock", "eurodance", "house", "r&b", "rnb", "techno", "trance"],
    moods: ["raw", "energetic", "rebellious", "nostalgic"],
    tempo: [118, 150],
    instrumentation: ["breakbeaty", "sample", "analogowy bas", "oldschoolowe synthy"],
    vibe: "Surowa energia — boom-bap, grunge, rave i eurodance.",
    visual: "VHS, CRT, kasety, saturowane barwy",
    palette: { accent: "#28C0B0", accentSoft: "#062220", glow: "#28C0B055", bg: "#0A1413" },
    description: "Grunge i hip-hop redefiniują mainstream, a w Europie eksplodują rave, techno i eurodance. Surowa energia, sample i breakbeaty, świat na kasetach i VHS. Muzyka stała się buntownicza i bezpośrednia.",
    artists: ["Nirvana", "Nas", "The Prodigy", "Radiohead", "Dr. Dre", "Backstreet Boys"],
    soundmarks: ["boom-bap sample", "acid 303", "breakbeaty", "gitara grunge", "eurodance synth"],
    culture: [
      { label: "Moda", value: "flanela, dresy, glany" },
      { label: "Technologia", value: "internet, CD, Discman" },
      { label: "Film", value: "Matrix, Pulp Fiction" },
      { label: "Gry", value: "PlayStation, Nintendo 64" },
    ],
    didYouKnow: "Kultura rave i wolnych imprez ukształtowała europejską scenę klubową na kolejne dekady.",
  },
  {
    key: "y2k", label: "Y2K", tagline: "Chromowy sen", decade: "2000s",
    yearStart: 2000, yearEnd: 2003, emoji: "💿",
    genres: ["pop", "r&b", "rnb", "trance", "dance", "electronic", "eurodance"],
    moods: ["shiny", "nostalgic", "energetic", "dreamy"],
    tempo: [120, 140],
    instrumentation: ["cyfrowe synthy", "auto-tune", "trance lead", "poler bas"],
    vibe: "Błyszczący pop przełomu tysiącleci i euforyczny trance.",
    visual: "chrom, srebro, wczesny internet, lodowaty błękit",
    palette: { accent: "#7FC8FF", accentSoft: "#0A1B2A", glow: "#7FC8FF55", bg: "#0A1017" },
    description: "Przełom tysiącleci — błyszczący pop, R&B i euforyczny trance. Estetyka chromu, srebra i wczesnego internetu, a auto-tune wchodzi do gry na dobre. Świat wierzył, że przyszłość właśnie się zaczęła.",
    artists: ["Britney Spears", "*NSYNC", "Eminem", "Destiny's Child", "ATB", "Darude"],
    soundmarks: ["cyfrowe synthy", "auto-tune", "trance lead (supersaw)", "poler bas"],
    culture: [
      { label: "Moda", value: "metaliczne tkaniny, niskie spodnie" },
      { label: "Technologia", value: "MP3, Napster, telefony z polifonią" },
      { label: "Film", value: "Matrix Reloaded, Gladiator" },
      { label: "Kultura", value: "MSN Messenger, fora, blogi" },
    ],
    didYouKnow: "Panika roku 2000 (błąd Y2K) nadała nazwę całej estetyce przełomu tysiącleci.",
  },
  {
    key: "2000s", label: "2000s", tagline: "Cyfrowy pop", decade: "2000s",
    yearStart: 2004, yearEnd: 2009, emoji: "🎧",
    genres: ["pop", "hip-hop", "rap", "indie", "electronic", "rock", "electro"],
    moods: ["bold", "energetic", "emotional", "party"],
    tempo: [100, 130],
    instrumentation: ["electro synthy", "cyfrowa perkusja", "gitara indie", "808"],
    vibe: "Śmiały cyfrowy pop, electro i wschodzące indie.",
    visual: "elektryczny fiolet, czerń, glossy, klubowy błysk",
    palette: { accent: "#B57BFF", accentSoft: "#170C2A", glow: "#B57BFF55", bg: "#0E0A16" },
    description: "Electro-pop, indie i hip-hop rządzą, a muzyka przenosi się do sieci — iPod, YouTube i MySpace zmieniają wszystko. Śmiałe cyfrowe brzmienie, klubowy błysk i pierwsze wielkie gwiazdy internetu.",
    artists: ["Kanye West", "The Killers", "Rihanna", "Justice", "Arctic Monkeys", "Amy Winehouse"],
    soundmarks: ["electro synthy", "808", "sidechain pompa", "gitara indie", "cyfrowa produkcja"],
    culture: [
      { label: "Moda", value: "skinny jeans, indie sleaze" },
      { label: "Technologia", value: "iPod, YouTube (2005), MySpace" },
      { label: "Film", value: "Mroczny Rycerz" },
      { label: "Gry", value: "Wii, Xbox 360" },
    ],
    didYouKnow: "MySpace wypromował całe pokolenie zespołów, zanim zrobiły to wytwórnie.",
  },
  {
    key: "2010s", label: "2010s", tagline: "Era streamingu", decade: "2010s",
    yearStart: 2010, yearEnd: 2019, emoji: "📱",
    genres: ["edm", "pop", "trap", "house", "indie", "electronic", "future bass", "hip-hop"],
    moods: ["festival", "energetic", "happy", "chill"],
    tempo: [100, 128],
    instrumentation: ["drop EDM", "hi-haty trap", "future bass", "wokalne chopy"],
    vibe: "Festiwalowe dropy, trap i pop pisany pod playlisty.",
    visual: "gradient różu i błękitu, festiwalowe światła",
    palette: { accent: "#FF7AC6", accentSoft: "#2A0C20", glow: "#FF7AC655", bg: "#120A11" },
    description: "EDM podbija stadiony, trap staje się językiem popu, a Spotify zmienia sposób słuchania muzyki. Festiwalowe dropy i utwory pisane pod playlisty — hit to coś, co zatrzymuje kciuk w scrollu.",
    artists: ["Avicii", "Daft Punk", "Drake", "Calvin Harris", "The Weeknd", "Lorde"],
    soundmarks: ["drop EDM / big-room", "future bass", "hi-haty trap", "wokalne chopy"],
    culture: [
      { label: "Moda", value: "streetwear, kultura hype" },
      { label: "Technologia", value: "smartfon, Spotify, koniec dekady: TikTok" },
      { label: "Film", value: "Marvel MCU" },
      { label: "Kultura", value: "memy, influencerzy, festiwale" },
    ],
    didYouKnow: "Streaming (Spotify) na nowo zdefiniował, co w ogóle znaczy słowo hit.",
  },
  {
    key: "now", label: "NOW", tagline: "Dziś", decade: "2020s",
    yearStart: 2020, yearEnd: 2026, emoji: "🔥",
    genres: [], // NOW = cały żywy katalog
    moods: [],
    tempo: [0, 400],
    instrumentation: ["wszystko, co gra dziś"],
    vibe: "Muzyka, którą ludzie tworzą teraz — cały żywy katalog GrouAI.",
    visual: "ciepły bursztyn GrouAI, nowoczesny minimalizm",
    palette: { accent: "#FF8A2A", accentSoft: "#2A1A0C", glow: "#FF8A2A55", bg: "#100C0A" },
    description: "Muzyka, którą ludzie tworzą teraz — gatunki mieszają się bez granic, a narzędzia AI otwierają tworzenie dla każdego. To cały żywy katalog GrouAI: Ty i społeczność.",
    artists: ["Twórcy GrouAI", "Ty", "społeczność"],
    soundmarks: ["hybrydy gatunków", "hyperpop", "drill", "afrobeats", "bedroom-pop"],
    culture: [
      { label: "Technologia", value: "AI, spatial audio, TikTok" },
      { label: "Kultura", value: "niezależni kreatorzy" },
      { label: "Narzędzia", value: "GrouAI Studio, generacja w minuty" },
    ],
    didYouKnow: "Po raz pierwszy w historii każdy może wyprodukować gotowy utwór w kilka minut.",
  },
  {
    key: "future", label: "FUTURE", tagline: "Jutro", decade: "202X+",
    yearStart: 2026, yearEnd: 2100, emoji: "🛸",
    genres: ["ambient", "experimental", "hyperpop", "electronic", "lo-fi", "idm"],
    moods: ["dreamy", "dark", "immersive", "chill"],
    tempo: [60, 160],
    instrumentation: ["tekstury AI", "spatial pady", "granularny bas", "generatywne warstwy"],
    vibe: "Immersyjne, przestrzenne brzmienie jutra — tworzone z AI.",
    visual: "holografia, przestrzeń 3D, fiolet i chłodne światło",
    palette: { accent: "#A98BFF", accentSoft: "#150C2A", glow: "#A98BFF55", bg: "#0B0A14" },
    description: "Immersyjne, przestrzenne brzmienie tworzone z AI — muzyka reaguje na nastrój, generatywne warstwy i dźwięk 3D. Tu GrouAI komponuje jutro, którego jeszcze nie słyszałeś.",
    artists: ["AI", "wizjonerzy jutra", "GrouAI Engine"],
    soundmarks: ["tekstury AI", "spatial audio", "generatywne pady", "granularny bas"],
    culture: [
      { label: "Technologia", value: "AI generatywne, VR/AR, spatial" },
      { label: "Kultura", value: "muzyka adaptacyjna" },
      { label: "Doświadczenie", value: "dźwięk reagujący na Ciebie" },
    ],
    didYouKnow: "Muzyka generatywna potrafi dostosować się do Twojego nastroju w czasie rzeczywistym.",
  },
];

// ── Grafika epoki (darmowa, AI: Pollinations/Flux) ──
// Klimatyczny obraz-tło dla kafelka/nagłówka danej epoki. Prompt po angielsku
// (najlepsze wyniki), bez tekstu. Seed stały = ten sam obraz (brak migotania).
const ERA_ART: Record<string, string> = {
  "1970s": "1970s disco and funk era, warm sepia and gold, mirror ball, vinyl records, groovy retro album poster, soft film grain, cinematic, no text no words",
  "1980s": "1980s synthwave neon city skyline at night, magenta and cyan grid, chrome, retro 80s poster art, glowing sunset, cinematic, no text no words",
  "1990s": "1990s rave and grunge era, VHS glitch aesthetic, CRT scanlines, teal and orange, cassette tapes, underground poster, cinematic, no text no words",
  "y2k": "Y2K aesthetic, liquid chrome and silver, early internet, icy blue, futuristic year 2000 poster, glossy metal, cinematic, no text no words",
  "2000s": "mid 2000s digital pop era, electric purple and black, glossy club lights, bold poster art, cinematic, no text no words",
  "2010s": "2010s EDM festival, pink and blue gradient, stage lights, festival crowd silhouette, modern poster art, cinematic, no text no words",
  "now": "modern music studio 2020s, warm amber glow, sleek minimal futuristic, glowing soundwaves, cinematic, no text no words",
  "future": "futuristic holographic music of tomorrow, 3D spatial, violet and cool light, AI generative abstract art, sci-fi poster, cinematic, no text no words",
};

function artSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (key.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h) % 100000;
}

/** Darmowy URL grafiki epoki (Pollinations/Flux). */
export function eraArtUrl(era: Era, width = 512, height = 512): string {
  const prompt = ERA_ART[era.key] || `${era.label} music era, cinematic album art, no text`;
  const enc = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${enc}?width=${width}&height=${height}&nologo=true&model=flux&seed=${artSeed(era.key)}`;
}

export function getEra(key: string | undefined | null): Era | undefined {
  if (!key) return undefined;
  const k = key.toLowerCase();
  return ERAS.find((e) => e.key.toLowerCase() === k);
}

// Utwór traktujemy jak "AI ERA", gdy pochodzi z naszego generatora.
export function isAiTrack(t: { artist?: string | null; album?: string | null }): boolean {
  const a = (t.artist || "").toLowerCase();
  const al = (t.album || "").toLowerCase();
  return a.includes("grouai") || al.includes("ai generated") || al.includes("ai era");
}

export interface EraTrackLike {
  genre?: string | null;
  mood?: string | null;
  bpm?: number | null;
}

// Dopasowanie utworu do epoki po brzmieniu (gatunek + nastrój + tempo).
// Zwraca wynik 0..100 — im wyżej, tym mocniej utwór pasuje do klimatu epoki.
export function matchEra(track: EraTrackLike, era: Era): number {
  if (era.key === "now") return track.genre || track.mood ? 40 : 20; // NOW bierze wszystko

  const genre = (track.genre || "").toLowerCase().trim();
  const mood = (track.mood || "").toLowerCase().trim();
  let score = 0;

  if (genre) {
    for (const g of era.genres) {
      if (genre === g || genre.includes(g) || g.includes(genre)) { score += 55; break; }
    }
  }
  if (mood) {
    for (const m of era.moods) {
      if (mood === m || mood.includes(m) || m.includes(mood)) { score += 25; break; }
    }
  }
  if (typeof track.bpm === "number" && track.bpm > 0) {
    if (track.bpm >= era.tempo[0] && track.bpm <= era.tempo[1]) score += 20;
  }
  return Math.min(100, score);
}

// Próg, powyżej którego uznajemy, że utwór "brzmi jak" ta epoka.
export const ERA_MATCH_THRESHOLD = 50;

// Stabilny hash (do deterministycznego rozrzutu remisów między epokami).
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}

export interface EraRank { era: Era; score: number }

// Ranking epok dla utworu. Remisy (np. "Pop" pasujący do kilku epok) rozrzucamy
// deterministycznie po id utworu — dzięki temu każda epoka ma własny, stabilny
// zestaw, a nie tę samą listę popu wszędzie.
export function rankEras(track: EraTrackLike & { id?: string | null }): EraRank[] {
  const id = track.id || `${track.genre}|${track.mood}`;
  return ERAS
    .map((era) => {
      let score = matchEra(track, era);
      if (score > 0 && era.key !== "now") {
        score += (hashId(`${id}::${era.key}`) % 9) * 0.4; // mikro-tiebreak 0..3.2
      }
      return { era, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Ile najlepszych epok bierze utwór (żeby nie zalewał wszystkich epok naraz).
export const ERA_TOP_N = 2;

// Czy dany utwór "należy" do epoki: musi ją mieć w TOP-N i przejść próg.
export function trackBelongsToEra(track: EraTrackLike & { id?: string | null }, eraKey: string): number {
  const ranked = rankEras(track);
  const idx = ranked.findIndex((r) => r.era.key === eraKey);
  if (idx < 0 || idx >= ERA_TOP_N) return 0;
  const r = ranked[idx];
  return r.score >= ERA_MATCH_THRESHOLD ? r.score : 0;
}

// Najlepsza epoka utworu (do liczenia Nostalgia DNA z historii odsłuchów).
export function bestEra(track: EraTrackLike & { id?: string | null }): Era | undefined {
  const ranked = rankEras(track);
  if (!ranked.length) return undefined;
  if (ranked[0].score < ERA_MATCH_THRESHOLD && ranked[0].era.key === "now") return getEra("now");
  return ranked[0].era;
}

// Mapowanie gatunku epoki na listę stylów Studia (Suno GENRES).
export function eraStudioGenre(era: Era): string {
  const STUDIO = ["Pop","Rock","Electronic","Hip-Hop","Jazz","Classical","R&B","Country","Reggae","Metal","Indie","Lo-fi","Ambient","Trap","House","Disco"];
  for (const g of era.genres) {
    const hit = STUDIO.find((s) => s.toLowerCase() === g || s.toLowerCase().includes(g) || g.includes(s.toLowerCase()));
    if (hit) return hit;
  }
  return "Electronic";
}

// Deep-link do Studia z presetem epoki (Studio może param zignorować — jest
// wstecznie zgodne; docelowo wczyta go jako preset "Create an Era").
export function eraStudioLink(era: Era): string {
  const genre = era.genres[0] ? era.genres[0] : "";
  const params = new URLSearchParams({
    era: era.key,
    genre,
    tempo: String(Math.round((era.tempo[0] + era.tempo[1]) / 2)),
  });
  return `/studio?${params.toString()}`;
}

// Baza promptu "Tak brzmiałby ten rok, gdyby istniało AI".
export function eraAiPrompt(era: Era): string {
  const bpm = Math.round((era.tempo[0] + era.tempo[1]) / 2);
  return [
    `${era.label} ${era.genres.slice(0, 3).join(" / ")} track`,
    `${bpm} BPM`,
    era.instrumentation.join(", "),
    era.vibe,
    "nowa produkcja inspirowana charakterem epoki, nie kopia konkretnego utworu, bez naśladowania konkretnego artysty",
  ].join(", ");
}
