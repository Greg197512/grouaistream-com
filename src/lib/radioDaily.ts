import { supabase } from "@/integrations/supabase/client";
import { loadTrackSnapshot, type SnapshotTrack } from "@/lib/trackSnapshot";
import { omitRadioOnlyTracks } from "@/lib/catalogTracks";
import { withTimeout } from "@/lib/withTimeout";
import { BLOCKS, blockAt, planDay, type BlockId } from "@/lib/radioClock";

// Dzienne radio = AUTOPILOT: co dzień inna, deterministyczna playlista na całą dobę
// (ten sam porządek dla wszystkich słuchaczy — czas liczony od polskiej północy),
// ułożona przez ramówkę godzinową z `radioClock.ts` (bloki gatunkowe, weekend
// Disco/Electronic/Hip-Hop, bez powtórek w oknie kilku godzin, bramka jakości).
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
  /** Autopilot: blok ramówki każdego utworu (ta sama kolejność co `tracks`). */
  blocks?: BlockId[];
  starts?: number[];     // sekundy od północy
  djs?: boolean[];       // utwór z DJ-miksu klubowego (electronic/hip-hop/disco)
  windowSec?: number;    // okno bez powtórek
  rejected?: number;     // odrzucone przez bramkę jakości
}

export type DayMood = "party" | "calm" | "mixed";

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

// Filtr PostgREST: gatunki imprezowe (case-insensitive, częściowe dopasowanie).
const PARTY_GENRE_FILTER = ["techno", "disco", "hip-hop", "hip hop", "rap", "trap", "dance", "house", "edm"]
  .map((k) => `genre.ilike.%${k}%`)
  .join(",");


/**
 * Buduje dzisiejszą playlistę radia dla stacji. Zwraca null, gdy nie ma z czego
 * (ani Supabase, ani snapshot nie dały utworów z audio).
 */
export async function buildDailyRadio(station: "public" | "vip", max = 140): Promise<DailyRadio | null> {
  const now = new Date();
  const { dow, dayKey, midnightISO } = warsawDay(now);
  const mood = dayMood(dow);

  // Pula: Supabase → fallback snapshot (R2).
  let pool: DailyRadioTrack[] = [];
  try {
    const COLS = "id,title,artist,duration,audio_url,cover_url,genre";
    // Dwa zapytania: ogólna pula + wszystkie utwory gatunków imprezowych (techno/disco/hip-hop/rap/dance),
    // żeby weekendowy program nie tracił ich przez losowe ucięcie puli.
    const [general, party] = await Promise.all([
      withTimeout(
        supabase.from("tracks").select(COLS).not("audio_url", "is", null).limit(800),
        4000,
        "daily tracks",
      ),
      withTimeout(
        supabase.from("tracks").select(COLS).not("audio_url", "is", null).or(PARTY_GENRE_FILTER).limit(400),
        4000,
        "daily party tracks",
      ),
    ]);
    const seen = new Map<string, DailyRadioTrack>();
    for (const res of [general, party]) {
      if (!res.error && Array.isArray(res.data)) {
        for (const t of res.data as DailyRadioTrack[]) if (t.audio_url) seen.set(t.id, t);
      }
    }
    pool = omitRadioOnlyTracks([...seen.values()]);
  } catch {
    /* baza offline → snapshot poniżej */
  }
  if (pool.length === 0) {
    const snap = await loadTrackSnapshot();
    pool = omitRadioOnlyTracks(snap.filter((t: SnapshotTrack) => t.audio_url))
      .map((t) => ({
        id: t.id, title: t.title, artist: t.artist,
        duration: t.duration ?? 180, audio_url: t.audio_url ?? null,
        cover_url: t.cover_url ?? null, genre: t.genre ?? null,
      }));
  }
  if (pool.length === 0) return null;

  // Autopilot: pełna doba według ramówki godzinowej (radioClock.ts) — bloki gatunkowe,
  // weekend Disco/Electronic/Hip-Hop, bez powtórek w oknie kilku godzin, bramka jakości.
  void max;
  const plan = planDay(pool, dow, `${dayKey}:${station}`);
  if (!plan.items.length) return null;
  const hourNow = Math.floor((now.getTime() - new Date(midnightISO).getTime()) / 3600000);
  const current = blockAt(dow, Math.min(23, Math.max(0, hourNow)));
  return {
    tracks: plan.items.map((x) => ({ ...x.track, duration: x.track.duration || 180 })),
    blocks: plan.items.map((x) => x.block),
    starts: plan.items.map((x) => x.start),
    djs: plan.items.map((x) => !!x.dj),
    windowSec: plan.windowSec,
    rejected: plan.rejected,
    startedAtISO: midnightISO,
    stationName: `GrouaRadio · ${BLOCKS[current].label}`,
    dayKey,
    mood,
  };
}
