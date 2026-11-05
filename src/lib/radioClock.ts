// Autopilot GrouaRadio: ramówka godzinowa (bloki gatunkowe), weekend Disco/Electronic/Hip-Hop,
// brak powtórek utworu w oknie kilku godzin, rozdzielanie artystów i bramka jakości przed anteną.
// Czysta logika (bez sieci) — deterministyczna: ten sam dzień + ta sama pula = ten sam plan
// u każdego słuchacza, więc wszyscy słyszą to samo w tym samym momencie.

export type BlockId =
  | "night" | "morning" | "day" | "afternoon" | "evening"
  | "weekend-disco" | "weekend-electronic" | "weekend-hiphop" | "sunday";

export interface ClockTrack {
  id: string;
  title: string;
  artist: string;
  duration: number | null;
  audio_url: string | null;
  cover_url: string | null;
  genre: string | null;
}

const CALM = ["lo-fi", "lofi", "ambient", "chill", "acoustic", "soul", "jazz", "classical", "piano", "melanchol", "sad", "slow", "downtempo", "soft", "ballad", "lounge", "r&b", "rnb"];
const POP = ["pop", "rock", "indie", "latin", "reggaeton", "funk", "dance", "upbeat", "folk", "country"];
const DISCO = ["disco", "funk", "boogie", "italo", "nu-disco"];
const ELECTRONIC = ["electronic", "electro", "house", "techno", "trance", "edm", "dance", "dnb", "drum", "dubstep", "synth", "bass", "club"];
const HIPHOP = ["hip-hop", "hip hop", "hiphop", "rap", "trap", "drill", "grime", "r&b", "rnb"];

export const BLOCKS: Record<BlockId, { label: string; kws: string[] | null }> = {
  night: { label: "Noc: chill i lo-fi", kws: CALM },
  morning: { label: "Poranek: pop i energia", kws: POP },
  day: { label: "Mix dnia", kws: null },
  afternoon: { label: "Popołudnie: electronic i house", kws: ELECTRONIC },
  evening: { label: "Wieczór: hip-hop i R&B", kws: HIPHOP },
  "weekend-disco": { label: "Weekend: Disco", kws: DISCO },
  "weekend-electronic": { label: "Weekend: Electronic", kws: ELECTRONIC },
  "weekend-hiphop": { label: "Weekend: Hip-Hop", kws: HIPHOP },
  sunday: { label: "Niedziela: spokój", kws: CALM },
};

/** Klubowa rodzina: gdy w bloku brakuje utworów, DJ miksuje electronic + hip-hop + disco. */
export const CLUB_KWS = [...new Set([...ELECTRONIC, ...HIPHOP, ...DISCO])];
const CLUB_BLOCKS = new Set<BlockId>(["weekend-disco", "weekend-electronic", "weekend-hiphop", "afternoon", "evening"]);

const WEEKEND_ROTATION: BlockId[] = ["weekend-disco", "weekend-electronic", "weekend-hiphop"];

/** Blok ramówki dla dnia tygodnia (0 = niedziela) i godziny (czas polski). */
export function blockAt(dow: number, hour: number): BlockId {
  const weekend = (dow === 5 && hour >= 18) || dow === 6 || (dow === 0 && hour < 6);
  if (weekend) return WEEKEND_ROTATION[hour % 3];
  if (dow === 0) return "sunday";
  if (hour < 6) return "night";
  if (hour < 10) return "morning";
  if (hour < 16) return "day";
  if (hour < 20) return "afternoon";
  return "evening";
}

/** Bramka jakości przed anteną: jest audio, długość 45 s – 15 min, host nie jest martwy, to muzyka (nie audycja). */
export function passesQualityGate(t: ClockTrack): boolean {
  if (!t.audio_url || !/^https?:\/\//i.test(t.audio_url)) return false;
  if (/cdn1\.suno\.ai/i.test(t.audio_url)) return false; // skasowane po stronie Suno (403)
  if (/nocna[\s-]*rozmowa/i.test(`${t.title} ${t.audio_url}`)) return false; // audycja, nie rotacja
  if (t.duration != null && (t.duration < 45 || t.duration > 900)) return false;
  return true;
}

export const matchesBlock = (t: ClockTrack, kws: string[] | null) =>
  !kws || (!!t.genre && kws.some((k) => t.genre!.toLowerCase().includes(k)));

export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `dj` = utwór dobrany z miksu klubowego (electronic/hip-hop/disco), bo w bloku zabrakło świeżych. */
export interface PlanItem { track: ClockTrack; start: number; block: BlockId; dj?: boolean }
export interface DayPlan { items: PlanItem[]; windowSec: number; poolSize: number; rejected: number }

const DAY = 86400;
const durOf = (t: ClockTrack) => Math.min(900, Math.max(45, t.duration || 180));

/**
 * Plan na całą dobę od północy. Okno bez powtórek = połowa długości puli (2–8 h).
 * Gdy blok ma za mało pasujących utworów (< 8), gra z całej puli, żeby nie było ciszy.
 */
export function planDay(rawPool: ClockTrack[], dow: number, seedKey: string): DayPlan {
  const pool = rawPool.filter(passesQualityGate).sort((a, b) => a.id.localeCompare(b.id));
  const rejected = rawPool.length - pool.length;
  if (!pool.length) return { items: [], windowSec: 0, poolSize: 0, rejected };
  const rand = mulberry32(seedFromString(seedKey));
  const shuffle = <T,>(arr: T[]) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const total = pool.reduce((s, t) => s + durOf(t), 0);
  const windowSec = Math.round(Math.min(8 * 3600, Math.max(2 * 3600, total * 0.5)));
  const artists = new Set(pool.map((t) => (t.artist || "").trim().toLowerCase()).filter(Boolean));
  const artistGap = artists.size <= 2 ? 0 : artists.size <= 5 ? 1 : 2;

  const order = new Map<BlockId, ClockTrack[]>();
  const cursor = new Map<BlockId, number>();
  const candidatesFor = (b: BlockId) => {
    if (!order.has(b)) {
      const m = pool.filter((t) => matchesBlock(t, BLOCKS[b].kws));
      // Za mało utworów gatunku: bloki klubowe biorą DJ-miks electronic/hip-hop/disco, reszta całą pulę.
      const clubM = CLUB_BLOCKS.has(b) ? pool.filter((t) => matchesBlock(t, CLUB_KWS)) : [];
      order.set(b, shuffle(m.length >= 8 ? m : clubM.length >= 8 ? clubM : pool));
      cursor.set(b, 0);
    }
    return order.get(b)!;
  };

  let clubCache: ClockTrack[] | null = null;
  const clubList = () => {
    if (!clubCache) { clubCache = shuffle(pool.filter((t) => matchesBlock(t, CLUB_KWS))); cursor.set("club" as BlockId, 0); }
    return clubCache.length ? clubCache : null;
  };
  const lastPlayed = new Map<string, number>();
  const recentArtists: string[] = [];
  const items: PlanItem[] = [];
  let t = 0;
  while (t < DAY) {
    const block = blockAt(dow, Math.floor(t / 3600));
    const list = candidatesFor(block);
    const fresh = (x: ClockTrack) => { const lp = lastPlayed.get(x.id); return lp === undefined || t - lp >= windowSec; };
    const artistOk = (x: ClockTrack) => !recentArtists.includes((x.artist || "").trim().toLowerCase());
    // Kolejność prób: blok → (bloki klubowe) DJ-miks electronic/hip-hop/disco → cała pula;
    // najpierw świeży utwór innego artysty, potem sam świeży. Lepiej miks niż powtórka.
    const all = candidatesFor("day");
    const club = CLUB_BLOCKS.has(block) ? clubList() : null;
    const tryPick = (from: ClockTrack[], key: BlockId, rule: (x: ClockTrack) => boolean): ClockTrack | null => {
      const s0 = cursor.get(key)!;
      for (let k = 0; k < from.length; k++) {
        const i = (s0 + k) % from.length;
        if (rule(from[i])) { cursor.set(key, (i + 1) % from.length); return from[i]; }
      }
      return null;
    };
    const strict = (x: ClockTrack) => fresh(x) && artistOk(x);
    let pick = tryPick(list, block, strict);
    if (!pick && club) {
      pick = tryPick(club, "club" as BlockId, strict) ?? tryPick(club, "club" as BlockId, fresh);
      // W bloku klubowym zostajemy przy electronic/hip-hop/disco: najdawniej grany z miksu, a nie inny gatunek.
      if (!pick) pick = club.reduce((best, x) => ((lastPlayed.get(x.id) ?? -1) < (lastPlayed.get(best.id) ?? -1) ? x : best), club[0]);
    }
    pick = pick ?? tryPick(all, "day", strict) ?? tryPick(list, block, fresh) ?? tryPick(all, "day", fresh);
    if (!pick) {
      // Cała pula grała w oknie (bardzo mały katalog) — najdawniej grany z bloku.
      const at = list.reduce((best, x, i) => ((lastPlayed.get(x.id) ?? -1) < (lastPlayed.get(list[best].id) ?? -1) ? i : best), 0);
      pick = list[at];
      cursor.set(block, (at + 1) % list.length);
    }
    const kws = BLOCKS[block].kws;
    const dj = CLUB_BLOCKS.has(block) && !!kws && !matchesBlock(pick, kws) && matchesBlock(pick, CLUB_KWS);
    items.push({ track: pick, start: t, block, ...(dj ? { dj: true } : {}) });
    lastPlayed.set(pick.id, t);
    if (artistGap) {
      recentArtists.push((pick.artist || "").trim().toLowerCase());
      while (recentArtists.length > artistGap) recentArtists.shift();
    }
    t += durOf(pick);
  }
  return { items, windowSec, poolSize: pool.length, rejected };
}
