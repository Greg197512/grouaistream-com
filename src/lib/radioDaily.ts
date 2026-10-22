import { supabase } from "@/integrations/supabase/client";
import { loadTrackSnapshot, type SnapshotTrack } from "@/lib/trackSnapshot";
import { withTimeout } from "@/lib/withTimeout";

// Dzienne „radio z harmonogramem": co dzień inna, deterministyczna playlista
// (ten sam porządek dla wszystkich słuchaczy danego dnia — czas synchronizowany
// od północy UTC), z nastrojem zależnym od dnia tygodnia:
//   • czwartek/piątek/sobota → więcej hip-hop / rap / dance (weekendowa energia),
//   • niedziela → spokój i melancholia (lo-fi, ambient, chill, soul…),
//   • pon.–śr. → zrównoważony mix.
// Źródło: Supabase `tracks`, a gdy baza nie odpowiada → snapshot (/tracks.json)
// i granie prosto z R2. Dzięki temu radio nie milknie przy padniętej bazie.

export interface DailyRadioTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audio_url: string | null;
  cover_url: string | null;
  genre: string | null;
}

export interface DailyRadio {
  tracks: DailyRadioTrack[];
  startedAtISO: string; // dziś 00:00 UTC — kotwica synchronizacji
  stationName: string;
  dayKey: string;       // YYYY-MM-DD (UTC)
  mood: DayMood;
}

export type DayMood = "party" | "calm" | "mixed";

// Weekend (energia): czw(4) / pt(5) / sob(6).
const PARTY_KW = ["hip-hop", "hip hop", "hiphop", "rap", "trap", "dance", "edm", "house", "techno", "disco", "funk", "club", "bass", "electro", "dnb", "drum&bass", "drum and bass"];
// Niedziela (spokój/melancholia).
const CALM_KW = ["lo-fi", "lofi", "ambient", "chill", "chillout", "acoustic", "soul", "jazz", "classical", "piano", "melanchol", "sad", "slow", "downtempo", "soft", "ballad", "r&b", "rnb", "lounge"];

export function dayMood(dow: number): DayMood {
  if (dow === 4 || dow === 5 || dow === 6) return "party"; // czw/pt/sob
  if (dow === 0) return "calm";                            // niedziela
  return "mixed";                                          // pon–śr
}

const TZ = "Europe/Warsaw";
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Dzień tygodnia i data wg czasu polskiego (żeby „czwartek/sobota/niedziela"
// zgadzały się z lokalnym kalendarzem, nie z UTC).
function warsawDay(now: Date): { dow: number; dayKey: string; midnightISO: string } {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  const dow = WD[wd] ?? now.getUTCDay();
  // Moment polskiej północy = teraz minus przeszły czas zegarowy od północy.
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const secsSinceMidnight = (+p.hour || 0) * 3600 + (+p.minute || 0) * 60 + (+p.second || 0);
  const midnightISO = new Date(now.getTime() - secsSinceMidnight * 1000).toISOString();
  return { dow, dayKey, midnightISO };
}

export function stationNameFor(mood: DayMood): string {
  if (mood === "party") return "GrouaRadio · Weekend: Hip-Hop / Rap / Dance";
  if (mood === "calm") return "GrouaRadio · Niedziela: spokój i melancholia";
  return "GrouaRadio · Mix dnia";
}

// Deterministyczny PRNG (mulberry32) + hash tekstu na ziarno.
function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matchesKw = (genre: string | null, kws: string[]): boolean => {
  if (!genre) return false;
  const g = genre.toLowerCase();
  return kws.some((k) => g.includes(k));
};

/**
 * Buduje dzisiejszą playlistę radia dla stacji. Zwraca null, gdy nie ma z czego
 * (ani Supabase, ani snapshot nie dały utworów z audio).
 */
export async function buildDailyRadio(station: "public" | "vip", max = 140): Promise<DailyRadio | null> {
  const now = new Date();
  const { dow, dayKey, midnightISO } = warsawDay(now);
  const mood = dayMood(dow);
  const rand = mulberry32(seedFromString(`${dayKey}:${station}:${mood}`));

  // Pula: Supabase → fallback snapshot (R2).
  let pool: DailyRadioTrack[] = [];
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("tracks")
        .select("id,title,artist,duration,audio_url,cover_url,genre")
        .not("audio_url", "is", null)
        .limit(800),
      4000,
      "daily tracks",
    );
    if (!error && Array.isArray(data) && data.length) {
      pool = (data as DailyRadioTrack[]).filter((t) => t.audio_url);
    }
  } catch {
    /* baza offline → snapshot poniżej */
  }
  if (pool.length === 0) {
    const snap = await loadTrackSnapshot();
    pool = snap
      .filter((t: SnapshotTrack) => t.audio_url)
      .map((t) => ({
        id: t.id, title: t.title, artist: t.artist,
        duration: t.duration ?? 180, audio_url: t.audio_url ?? null,
        cover_url: t.cover_url ?? null, genre: t.genre ?? null,
      }));
  }
  if (pool.length === 0) return null;

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const kws = mood === "party" ? PARTY_KW : mood === "calm" ? CALM_KW : null;

  let ordered: DailyRadioTrack[];
  if (kws) {
    const pref = shuffle(pool.filter((t) => matchesKw(t.genre, kws)));
    const rest = shuffle(pool.filter((t) => !matchesKw(t.genre, kws)));
    if (pref.length < 4) {
      // Za mało pasujących gatunków w katalogu — nie rób pustej stacji, graj mix.
      ordered = shuffle(pool);
    } else if (mood === "calm") {
      // Niedziela: najpierw spokojne, energiczne dopiero na końcu (i mniej).
      ordered = [...pref, ...rest.slice(0, Math.ceil(pref.length * 0.3))];
    } else {
      // Weekend: przeplot 3:1 (preferowane:reszta) — energia + różnorodność.
      ordered = [];
      let pi = 0, ri = 0;
      while (pi < pref.length || ri < rest.length) {
        for (let k = 0; k < 3 && pi < pref.length; k++) ordered.push(pref[pi++]);
        if (ri < rest.length) ordered.push(rest[ri++]);
      }
    }
  } else {
    ordered = shuffle(pool);
  }

  // Lekki dedup kolejnych po artyście (chyba że katalog jedno/dwuartystowy — VIP).
  const artistSet = new Set(pool.map((t) => (t.artist || "").trim().toLowerCase()).filter(Boolean));
  const skipDedup = artistSet.size <= 2;
  const final: DailyRadioTrack[] = [];
  let lastArtist = "";
  for (const t of ordered) {
    const a = (t.artist || "").toLowerCase();
    if (!skipDedup && a && a === lastArtist) continue;
    final.push(t);
    lastArtist = a;
    if (final.length >= max) break;
  }

  return {
    tracks: final.length ? final : ordered.slice(0, max),
    startedAtISO: midnightISO,
    stationName: stationNameFor(mood),
    dayKey,
    mood,
  };
}
