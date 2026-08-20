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
  },
];

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
