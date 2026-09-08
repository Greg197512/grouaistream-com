// Personalizacja doboru muzyki „dla danej osoby" — wzmacnia to, co już żyje
// (listening_history, liked_songs, radio_likes) i dopina audio_features
// (energia/valence/taneczność), jeśli są. Wszystko z bezpiecznym fallbackiem:
// brak danych → neutralny wynik 0.5 (czyli zachowanie jak dotąd).
//
// Używane przez useDJMode (DJ = ciągłe, spersonalizowane radio danej osoby).
import { supabase } from "@/integrations/supabase/client";

export interface Taste {
  genres: Record<string, number>;
  moods: Record<string, number>;
  artists: Record<string, number>;
  energy?: number; valence?: number; dance?: number;
  hasData: boolean;
}
export interface AudioFeat { energy?: number; valence?: number; danceability?: number }

const EMPTY: Taste = { genres: {}, moods: {}, artists: {}, hasData: false };
const CACHE_KEY = (uid: string) => `grouai-taste-${uid}`;
const TTL = 10 * 60 * 1000; // 10 min — na tyle świeżo, by dobór „dostosował się" po nowych polubieniach/odsłuchach, a nie odpytywał bazy co chwilę

const lc = (s: string | null | undefined) => (s || "").toLowerCase().trim();

/** Profil gustu użytkownika z realnych sygnałów. Cache w localStorage (1h). */
export async function getTaste(userId: string | null): Promise<Taste> {
  if (!userId) return EMPTY;
  try {
    const raw = localStorage.getItem(CACHE_KEY(userId));
    if (raw) { const c = JSON.parse(raw); if (c.exp > Date.now()) return c.taste as Taste; }
  } catch { /* */ }
  try {
    const [hist, likes, rlikes] = await Promise.all([
      supabase.from("listening_history").select("track_id, played_at").eq("user_id", userId).order("played_at", { ascending: false }).limit(150),
      supabase.from("liked_songs").select("track_id").eq("user_id", userId).limit(300),
      supabase.from("radio_likes").select("track_id").eq("user_id", userId).limit(300),
    ]);
    const weight = new Map<string, number>();
    (hist.data || []).forEach((r: { track_id: string }, i: number) =>
      weight.set(r.track_id, (weight.get(r.track_id) || 0) + Math.max(0.3, 1 - i / 150)));      // świeższe = ważniejsze
    (likes.data || []).forEach((r: { track_id: string }) => weight.set(r.track_id, (weight.get(r.track_id) || 0) + 2));   // polubienie = mocny sygnał
    (rlikes.data || []).forEach((r: { track_id: string }) => weight.set(r.track_id, (weight.get(r.track_id) || 0) + 1.5)); // lajk w radiu

    const ids = [...weight.keys()].slice(0, 300);
    if (ids.length === 0) return EMPTY;

    const trk = await supabase.from("tracks").select("id,genre,mood,artist").in("id", ids);
    const taste: Taste = { genres: {}, moods: {}, artists: {}, hasData: true };
    for (const t of (trk.data || []) as { id: string; genre: string | null; mood: string | null; artist: string | null }[]) {
      const w = weight.get(t.id) || 1;
      if (t.genre) taste.genres[lc(t.genre)] = (taste.genres[lc(t.genre)] || 0) + w;
      if (t.mood) taste.moods[lc(t.mood)] = (taste.moods[lc(t.mood)] || 0) + w;
      if (t.artist) taste.artists[lc(t.artist)] = (taste.artists[lc(t.artist)] || 0) + w;
    }
    const norm = (m: Record<string, number>) => { const mx = Math.max(1, ...Object.values(m)); for (const k in m) m[k] /= mx; };
    norm(taste.genres); norm(taste.moods); norm(taste.artists);
    try { localStorage.setItem(CACHE_KEY(userId), JSON.stringify({ exp: Date.now() + TTL, taste })); } catch { /* */ }
    return taste;
  } catch { return EMPTY; }
}

/** 0..1 — jak bardzo utwór pasuje do gustu. Bez danych → 0.5 (neutralnie). */
export function tasteScore(
  t: { genre?: string | null; mood?: string | null; artist?: string | null },
  taste: Taste,
  af?: AudioFeat,
): number {
  if (!taste.hasData) return 0.5;
  let s = 0, n = 0;
  if (t.genre != null) { s += taste.genres[lc(t.genre)] || 0; n++; }
  if (t.mood != null) { s += (taste.moods[lc(t.mood)] || 0) * 0.8; n++; }
  if (t.artist != null) { s += (taste.artists[lc(t.artist)] || 0) * 0.6; n++; }
  let base = n > 0 ? s / n : 0.3;
  if (af && typeof af.energy === "number" && taste.energy != null) {
    const d = Math.abs((af.energy ?? 0.5) - taste.energy)
            + Math.abs((af.valence ?? 0.5) - (taste.valence ?? 0.5))
            + Math.abs((af.danceability ?? 0.5) - (taste.dance ?? 0.5));
    base += Math.max(0, 1 - d / 3) * 0.4;
  }
  return Math.max(0, Math.min(1, base));
}

/** Wyczyść cache gustu (np. po wielu polubieniach) — pobierze świeży. */
export function invalidateTaste(userId: string | null) {
  if (!userId) return;
  try { localStorage.removeItem(CACHE_KEY(userId)); } catch { /* */ }
}
