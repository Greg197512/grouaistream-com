// Osobiste, inteligentne radio zalogowanego słuchacza. Buduje kolejkę z JEGO
// danych: najczęściej słuchane (listening_history), utwory z jego playlist i
// polubione (liked_songs) — dobrane do wybranego nastroju po cechach audio i
// gatunku. Wszystko po stronie klienta (RLS: użytkownik widzi swoje dane),
// bez globalnego zapisu — nie rusza wspólnej anteny.
import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/contexts/PlayerContext";

export type Mood = "chill" | "energetic" | "focus" | "party";

interface TrackRow {
  id: string; title: string | null; artist: string | null; duration: number | null;
  audio_url: string | null; video_url: string | null; cover_url: string | null;
  energy: number | null; valence: number | null; danceability: number | null;
  bpm: number | null; genre: string | null;
}

function moodScore(t: TrackRow, mood: Mood): number {
  const e = t.energy ?? 0.5, v = t.valence ?? 0.5, d = t.danceability ?? 0.5, bpm = t.bpm ?? 110;
  const g = (t.genre || "").toLowerCase();
  const gm = (re: RegExp) => (re.test(g) ? 1.2 : 0);
  let s: number;
  if (mood === "energetic") s = 2 * e + d + bpm / 200 + gm(/rock|edm|electro|hip.?hop|rap|metal|punk|dance|techno|house/);
  else if (mood === "party") s = 2 * d + e + v + gm(/dance|house|pop|disco|edm|hip.?hop|funk|techno/);
  else if (mood === "chill") s = 2 * (1 - e) + (1 - d) + gm(/ambient|lo.?fi|acoustic|jazz|folk|chill|soul|r&b|indie|classical/);
  else s = (1 - e) + 0.5 * (1 - v) + gm(/lo.?fi|ambient|classical|instrumental|post.?rock|electro|piano/);
  return s + Math.random() * 0.4;
}

/** Zbierz identyfikatory utworów z trzech źródeł użytkownika. */
async function gatherIds(userId: string): Promise<string[]> {
  const ids = new Set<string>();
  const [hist, liked, pls] = await Promise.all([
    supabase.from("listening_history").select("track_id").eq("user_id", userId).eq("skipped", false).order("played_at", { ascending: false }).limit(600),
    supabase.from("liked_songs").select("track_id").eq("user_id", userId).limit(300),
    supabase.from("playlists").select("id").eq("user_id", userId).limit(50),
  ]);
  // Najczęściej słuchane: policz wystąpienia, weź najpopularniejsze.
  const counts = new Map<string, number>();
  for (const r of (hist.data as { track_id: string | null }[] | null) || []) {
    if (r.track_id) counts.set(r.track_id, (counts.get(r.track_id) || 0) + 1);
  }
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 150).forEach(([id]) => ids.add(id));
  for (const r of (liked.data as { track_id: string | null }[] | null) || []) if (r.track_id) ids.add(r.track_id);
  const playlistIds = ((pls.data as { id: string }[] | null) || []).map((p) => p.id);
  if (playlistIds.length) {
    const { data: pt } = await supabase.from("playlist_tracks").select("track_id").in("playlist_id", playlistIds).limit(400);
    for (const r of (pt as { track_id: string | null }[] | null) || []) if (r.track_id) ids.add(r.track_id);
  }
  return [...ids];
}

/** Zbuduj osobistą kolejkę (~60 utworów) dobraną do nastroju. */
export async function buildPersonalQueue(userId: string, mood: Mood, max = 60): Promise<Track[]> {
  const ids = await gatherIds(userId);
  if (!ids.length) return [];
  // Pobierz utwory partiami (IN ma limit długości) — tylko z grywalnym audio.
  const rows: TrackRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await supabase
      .from("tracks")
      .select("id,title,artist,duration,audio_url,video_url,cover_url,energy,valence,danceability,bpm,genre")
      .in("id", chunk);
    for (const t of (data as TrackRow[] | null) || []) if (t.audio_url) rows.push(t);
  }
  if (!rows.length) return [];
  rows.sort((a, b) => moodScore(b, mood) - moodScore(a, mood));
  return rows.slice(0, max).map((t) => ({
    id: t.id,
    title: t.title || "Utwór",
    artist: t.artist || "GrouAI",
    audio_url: t.audio_url,
    cover_url: t.cover_url,
    duration: t.duration,
  } as Track));
}
