import { supabase } from "@/integrations/supabase/client";

// Neuro-profil = „muzyczny mózg”. Liczony w przeglądarce z danych użytkownika (RLS: tylko własne):
// historia odsłuchów, polubienia, wykryte nastroje + cechy utworów (gatunek, nastrój, BPM, energia).
// Bez AI i bez kosztów (stary hub `neuro-profile` nie istnieje). Wynik w pamięci przeglądarki na 6 h;
// „Przeanalizuj” liczy od nowa i porównuje z poprzednim portretem (pamięć rośnie z każdą analizą).

export interface NeuroProfile {
  top_genres?: string[];
  energy?: string;
  moods?: string[];
  listening_times?: string[];
  dopamine_triggers?: string[];
  recommendation?: string;
  summary?: string;
  status?: string;
  hint?: string;
}

export interface NeuroResult {
  ok: boolean;
  profile?: NeuroProfile;
  summary?: string;
  cached?: boolean;
  fresh?: boolean;
  error?: string;
}

type TrackInfo = { id: string; title: string; artist: string; genre: string | null; mood: string | null; bpm: number | null; energy: number | null; duration: number | null };
type Play = { track_id: string; played_at: string; skipped: boolean | null; duration_played: number | null; mood_detected: string | null };

const CACHE_MS = 6 * 3600 * 1000;
const cacheKey = (uid: string) => `grouai-neuro-${uid}`;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const nice = (s: string) => s.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
const splitTags = (s: string | null) => (s ? s.split(/[,/|;]+/).map(norm).filter((x) => x && x.length < 30) : []);
const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
const add = (m: Map<string, number>, k: string, w: number) => m.set(k, (m.get(k) ?? 0) + w);

// Sąsiednie gatunki — do rekomendacji „spróbuj czegoś obok”.
const NEIGHBOURS: Record<string, string> = {
  pop: "indie pop", rock: "alternative", "hip-hop": "trap", "hip hop": "trap", rap: "drill", electronic: "house",
  house: "deep house", techno: "melodic techno", disco: "nu-disco", "lo-fi": "chillhop", lofi: "chillhop",
  ambient: "downtempo", jazz: "neo-soul", "r&b": "neo-soul", folk: "acoustic", dance: "electro pop", trap: "phonk",
};

const PL_MOODS: Record<string, string> = {
  happy: "radość", sad: "melancholia", calm: "spokój", energetic: "energia", relaxed: "relaks", angry: "złość",
  romantic: "romantyczność", chill: "chill", focused: "skupienie", neutral: "neutralny", excited: "ekscytacja",
};

async function loadTracks(ids: string[]): Promise<Map<string, TrackInfo>> {
  const out = new Map<string, TrackInfo>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("tracks").select("id,title,artist,genre,mood,bpm,energy,duration").in("id", ids.slice(i, i + 100));
    for (const t of (data ?? []) as TrackInfo[]) out.set(t.id, t);
  }
  return out;
}

export function build(plays: Play[], liked: string[], moodSessions: { mood: string }[], tracks: Map<string, TrackInfo>, prev?: NeuroProfile): NeuroProfile {
  const genres = new Map<string, number>();
  const moods = new Map<string, number>();
  const hours = new Map<string, number>();
  const perTrack = new Map<string, number>();
  const genreStats = new Map<string, { plays: number; full: number; skips: number }>();
  let eSum = 0, eW = 0, bSum = 0, bW = 0;

  const weigh = (t: TrackInfo | undefined, w: number) => {
    if (!t) return;
    for (const g of splitTags(t.genre)) add(genres, g, w);
    for (const m of splitTags(t.mood)) add(moods, PL_MOODS[m] ?? m, w * 0.7);
    if (t.energy != null) { eSum += (t.energy > 1 ? t.energy / 100 : t.energy) * w; eW += w; }
    if (t.bpm) { bSum += t.bpm * w; bW += w; }
  };

  for (const p of plays) {
    const t = tracks.get(p.track_id);
    const full = !!(t?.duration && p.duration_played && p.duration_played / t.duration >= 0.8);
    const w = p.skipped ? 0.2 : full ? 1.5 : 1;
    weigh(t, w);
    add(perTrack, p.track_id, 1);
    if (p.mood_detected) add(moods, PL_MOODS[norm(p.mood_detected)] ?? norm(p.mood_detected), 0.5);
    const h = new Date(p.played_at).getHours();
    add(hours, h < 6 ? "noc" : h < 12 ? "poranek" : h < 18 ? "popołudnie" : "wieczór", 1);
    for (const g of splitTags(t?.genre ?? null)) {
      const s = genreStats.get(g) ?? { plays: 0, full: 0, skips: 0 };
      s.plays++; if (full) s.full++; if (p.skipped) s.skips++;
      genreStats.set(g, s);
    }
  }
  for (const id of liked) weigh(tracks.get(id), 3);
  for (const s of moodSessions) add(moods, PL_MOODS[norm(s.mood)] ?? norm(s.mood), 1);

  const topGenres = top(genres, 5).map(nice);
  const topMoods = top(moods, 4);
  const totalPlays = plays.length || 1;
  const times = [...hours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${Math.round((v / totalPlays) * 100)}%`);

  const energyAvg = eW ? eSum / eW : null;
  const bpmAvg = bW ? Math.round(bSum / bW) : null;
  const energyLabel = energyAvg == null && bpmAvg == null ? undefined
    : `${energyAvg == null ? (bpmAvg! >= 120 ? "wysoka" : bpmAvg! >= 95 ? "zrównoważona" : "spokojna") : energyAvg >= 0.68 ? "wysoka" : energyAvg >= 0.42 ? "zrównoważona" : "spokojna"}${bpmAvg ? ` · ~${bpmAvg} BPM` : ""}`;

  // Dopamina = to, co słuchasz do końca, do czego wracasz i co lajkujesz.
  const triggers: string[] = [];
  const completion = [...genreStats.entries()].filter(([, s]) => s.plays >= 3)
    .map(([g, s]) => ({ g, rate: s.full / s.plays, skip: s.skips / s.plays })).sort((a, b) => b.rate - a.rate);
  if (completion[0] && completion[0].rate >= 0.4) triggers.push(`do końca: ${nice(completion[0].g)}`);
  const replay = [...perTrack.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0];
  if (replay) { const t = tracks.get(replay[0]); if (t) triggers.push(`powroty: ${t.title} (${replay[1]}×)`); }
  if (liked.length) triggers.push(`polubione: ${liked.length}`);
  if (bpmAvg && bpmAvg >= 120) triggers.push("mocny beat");
  if (topMoods[0]) triggers.push(`nastrój: ${topMoods[0]}`);
  const skippy = completion.filter((c) => c.skip >= 0.5).map((c) => nice(c.g))[0];

  const g0 = topGenres[0];
  const neighbour = g0 ? NEIGHBOURS[norm(g0)] : undefined;
  const recommendation = skippy
    ? `Często przewijasz ${skippy} — AI DJ może go rzadziej podsuwać. ${neighbour ? `Spróbuj za to ${neighbour}.` : ""}`.trim()
    : neighbour ? `Spróbuj ${neighbour} — leży tuż obok Twojego ${g0}.` : g0 ? `Włącz radio lub AI DJ — dobiorą więcej ${g0}.` : undefined;

  const parts: string[] = [];
  if (g0) parts.push(`Twój mózg najmocniej reaguje na ${topGenres.slice(0, 2).join(" i ")}`);
  if (topMoods[0]) parts.push(`najczęściej w nastroju „${topMoods[0]}”`);
  const WHEN: Record<string, string> = { noc: "nocą", poranek: "rano", "popołudnie": "po południu", "wieczór": "wieczorem" };
  if (times[0]) parts.push(`a słuchasz głównie ${WHEN[times[0].split(" ")[0]] ?? times[0]}`);
  let summary = parts.length ? parts.join(", ") + "." : "";
  if (prev?.top_genres?.[0] && g0 && norm(prev.top_genres[0]) !== norm(g0)) summary += ` Od ostatniej analizy na prowadzenie wyszedł ${g0} (wcześniej ${prev.top_genres[0]}).`;

  return { top_genres: topGenres, moods: topMoods, listening_times: times, energy: energyLabel, dopamine_triggers: triggers.slice(0, 5), recommendation, summary };
}

export async function fetchNeuroProfile(force = false): Promise<NeuroResult> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s?.session?.user?.id;
    if (!uid) return { ok: false, error: "Zaloguj się, aby zbudować swój muzyczny mózg." };

    let prev: { at: number; profile: NeuroProfile } | null = null;
    try { prev = JSON.parse(localStorage.getItem(cacheKey(uid)) || "null"); } catch { /* */ }
    if (!force && prev && Date.now() - prev.at < CACHE_MS) return { ok: true, profile: prev.profile, summary: prev.profile.summary, cached: true };

    const [hist, likes, moodS] = await Promise.all([
      supabase.from("listening_history").select("track_id,played_at,skipped,duration_played,mood_detected").eq("user_id", uid).order("played_at", { ascending: false }).limit(400),
      supabase.from("liked_songs").select("track_id").eq("user_id", uid).order("liked_at", { ascending: false }).limit(300),
      supabase.from("mood_sessions").select("mood").eq("user_id", uid).order("detected_at", { ascending: false }).limit(200),
    ]);
    const plays = (hist.data ?? []) as Play[];
    const liked = ((likes.data ?? []) as { track_id: string }[]).map((x) => x.track_id);
    const moodSessions = (moodS.data ?? []) as { mood: string }[];

    if (plays.length + liked.length < 5) {
      const profile: NeuroProfile = { status: "za mało danych", hint: "Posłuchaj jeszcze kilku utworów i polub ulubione — wtedy zbuduję Twój muzyczny mózg." };
      return { ok: true, profile, summary: profile.hint, fresh: true };
    }
    const tracks = await loadTracks([...new Set([...plays.map((p) => p.track_id), ...liked])]);
    const profile = build(plays, liked, moodSessions, tracks, prev?.profile);
    try { localStorage.setItem(cacheKey(uid), JSON.stringify({ at: Date.now(), profile })); } catch { /* */ }
    return { ok: true, profile, summary: profile.summary, fresh: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Błąd sieci" };
  }
}
