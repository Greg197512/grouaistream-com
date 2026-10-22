import type { Track } from "@/contexts/PlayerContext";

// Fallback katalogu: gdy Supabase nie odpowiada (uśpiony/limit/awaria), gramy
// z ostatniego snapshotu `public|dist/tracks.json` — pliki audio i tak są na R2.
// Snapshot generuje build (scripts/export-tracks.mjs) przy każdym deployu.

export interface SnapshotTrack extends Track {
  created_at?: string;
  user_id?: string | null;
}

let cache: SnapshotTrack[] | null = null;
let inflight: Promise<SnapshotTrack[]> | null = null;

/** Wczytuje snapshot z /tracks.json (raz, z cache). Nigdy nie rzuca. */
export async function loadTrackSnapshot(): Promise<SnapshotTrack[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch("/tracks.json", { cache: "force-cache" });
      if (!r.ok) return [];
      const json = await r.json();
      const rows: SnapshotTrack[] = Array.isArray(json) ? json : (json?.tracks ?? []);
      const out = rows.filter((t) => t && (t.audio_url || t.video_url));
      cache = out;
      return out;
    } catch {
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export interface SnapshotShape {
  order?: "created_at";
  ascending?: boolean;
  limit?: number;
  genre?: string;
  filter?: (t: SnapshotTrack) => boolean;
}

/** Nakłada na snapshot typowe operacje zapytania (filtr/gatunek/sort/limit) po stronie klienta. */
export function shapeSnapshot(rows: SnapshotTrack[], opts: SnapshotShape = {}): SnapshotTrack[] {
  let out = rows.slice();
  if (opts.genre) {
    const g = opts.genre.toLowerCase();
    out = out.filter((t) => (t.genre || "").toLowerCase().includes(g));
  }
  if (opts.filter) out = out.filter(opts.filter);
  if (opts.order === "created_at") {
    out.sort((a, b) => {
      const av = a.created_at ? Date.parse(a.created_at) : 0;
      const bv = b.created_at ? Date.parse(b.created_at) : 0;
      return opts.ascending ? av - bv : bv - av;
    });
  }
  if (opts.limit != null) out = out.slice(0, opts.limit);
  return out;
}

/**
 * Uruchamia zapytanie Supabase, a gdy zwróci błąd LUB pustkę — sięga po snapshot.
 * Zwraca też `fromSnapshot`, żeby pominąć kroki wymagające żywej bazy
 * (profile uploaderów, generowanie okładek itp.).
 */
export async function resilientTracks<T extends SnapshotTrack>(
  primary: () => Promise<{ data: T[] | null; error: unknown }>,
  shape: SnapshotShape = {},
): Promise<{ rows: T[]; fromSnapshot: boolean }> {
  try {
    const { data, error } = await primary();
    if (!error && Array.isArray(data) && data.length > 0) {
      return { rows: data, fromSnapshot: false };
    }
  } catch {
    /* fallthrough → snapshot */
  }
  const snap = await loadTrackSnapshot();
  return { rows: shapeSnapshot(snap, shape) as T[], fromSnapshot: true };
}
