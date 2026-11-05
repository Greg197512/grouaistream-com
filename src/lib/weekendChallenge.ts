// Wyzwanie weekendowe — „żywy algorytm” zamiast AI (Grok usunięty 5.11, zero kosztów).
// Patrzy na aktywność społeczności: ostatnie 7 dni vs poprzednie 7. Wybiera aktywność, która najbardziej
// słabnie (tę warto rozruszać), nie powtarza ostatniego wyzwania, a cel i nagrodę skaluje do realnego ruchu.
import { supabase } from "@/integrations/supabase/client";

export type Activity = "uploads" | "ratings" | "mood_sessions" | "studio_tracks" | "listens";

/** Tabela/kolumna czasu — tak samo jak liczy postęp funkcja bazy (migracja weekend_challenges). */
const SOURCES: Record<Activity, { table: string; at: string; extra?: (q: any) => any }> = {
  uploads: { table: "tracks", at: "created_at" },
  ratings: { table: "track_ratings", at: "created_at" },
  mood_sessions: { table: "mood_sessions", at: "detected_at" },
  studio_tracks: { table: "tracks", at: "created_at", extra: (q) => q.or("audio_url.ilike.%suno%,audio_url.ilike.%replicate%") },
  listens: { table: "stream_events", at: "streamed_at", extra: (q) => q.eq("counted", true) },
};

/** Zakres celu na osobę (min, max) i wartość nagrody za 1 „trudność”. */
const TARGETS: Record<Activity, [number, number]> = {
  uploads: [2, 5], ratings: [5, 15], mood_sessions: [3, 7], studio_tracks: [2, 4], listens: [20, 60],
};

const COPY: Record<Activity, { title: string; desc: (n: number) => string }[]> = {
  uploads: [
    { title: "Weekend premier 🎤", desc: (n) => `Wgraj ${n} nowe utwory do niedzieli i zgarnij nagrodę. Pokaż, co masz w szufladzie!` },
    { title: "Świeża krew na serwerze", desc: (n) => `Opublikuj ${n} utwory w ten weekend — każdy nowy kawałek trafia do rotacji radia.` },
  ],
  ratings: [
    { title: "Weekend krytyka 🎧", desc: (n) => `Oceń ${n} utworów innych twórców. Twoje gwiazdki pomagają algorytmom i artystom.` },
    { title: "Daj znać, co grają", desc: (n) => `Wystaw ${n} ocen w ten weekend — szczere opinie budują scenę.` },
  ],
  mood_sessions: [
    { title: "Weekend nastrojów 🧠", desc: (n) => `Zrób ${n} sesje wykrywania nastroju — Twój Muzyczny Mózg nauczy się Ciebie lepiej.` },
    { title: "Jak się dziś czujesz?", desc: (n) => `${n} razy pozwól GrouAI dobrać muzykę do nastroju i odbierz nagrodę.` },
  ],
  studio_tracks: [
    { title: "Weekend w Studiu 🎛️", desc: (n) => `Stwórz ${n} utwory w GrouAI Studio do niedzieli. Najlepsze trafią na antenę!` },
    { title: "Producent na weekend", desc: (n) => `Wyprodukuj ${n} kawałki w Studiu — gatunek dowolny, byle z pazurem.` },
  ],
  listens: [
    { title: "Maraton słuchania 🔊", desc: (n) => `Posłuchaj ${n} utworów twórców GrouAI w ten weekend i wesprzyj scenę.` },
    { title: "Odkrywca dźwięków", desc: (n) => `${n} odsłuchów do niedzieli — odkryj nowych artystów i zgarnij nagrodę.` },
  ],
};

async function countBetween(a: Activity, from: Date, to: Date): Promise<number> {
  const s = SOURCES[a];
  let q: any = supabase.from(s.table as never).select("id", { count: "exact", head: true }).gte(s.at, from.toISOString()).lt(s.at, to.toISOString());
  if (s.extra) q = s.extra(q);
  const { count } = await q;
  return count ?? 0;
}

export interface ChallengePlan {
  activity_type: Activity; title: string; description: string; target_count: number; reward_amount: number;
  starts_at: string; ends_at: string; reason: string;
}

/** Czysta logika wyboru (testowalna): trend aktywności → plan wyzwania. */
export function planChallenge(stats: Record<Activity, { last: number; prev: number }>, lastActivity: string | null, now = new Date()): ChallengePlan {
  const acts = Object.keys(stats) as Activity[];
  // Trend: <1 = słabnie. Brak ruchu w obu tygodniach = 0,9 (lekko do rozruszania).
  const trend = (a: Activity) => { const { last, prev } = stats[a]; return prev === 0 ? (last === 0 ? 0.9 : 2) : last / prev; };
  const ranked = acts.filter((a) => a !== lastActivity).sort((x, y) => trend(x) - trend(y));
  const pick = ranked[0] ?? acts[0];
  const [min, max] = TARGETS[pick];
  // Cel rośnie z realnym ruchem (dziennie), ale w rozsądnych granicach.
  const perDay = stats[pick].last / 7;
  const target = Math.max(min, Math.min(max, Math.round(min + Math.log2(1 + perDay) * (max - min) / 6)));
  const reward = Math.max(1, Math.min(5, Math.round(1 + ((target - min) / Math.max(1, max - min)) * 4)));
  const week = Math.floor(now.getTime() / (7 * 864e5));
  const copy = COPY[pick][week % COPY[pick].length];
  // Do najbliższej niedzieli 23:59 (min. 2 dni).
  const end = new Date(now); end.setDate(end.getDate() + ((7 - end.getDay()) % 7 || 7)); end.setHours(23, 59, 0, 0);
  if (end.getTime() - now.getTime() < 2 * 864e5) end.setDate(end.getDate() + 7);
  const t = trend(pick);
  return {
    activity_type: pick, title: copy.title, description: copy.desc(target), target_count: target, reward_amount: reward,
    starts_at: now.toISOString(), ends_at: end.toISOString(),
    reason: `${pick}: ${stats[pick].last} w 7 dni vs ${stats[pick].prev} tydzień wcześniej (trend ${t.toFixed(2)})`,
  };
}

/** Zbiera statystyki, planuje i zapisuje aktywne wyzwanie (admin, RLS). */
export async function generateWeekendChallenge(): Promise<ChallengePlan> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 864e5), d14 = new Date(now.getTime() - 14 * 864e5);
  const acts = Object.keys(SOURCES) as Activity[];
  const pairs = await Promise.all(acts.map(async (a) => [a, { last: await countBetween(a, d7, now), prev: await countBetween(a, d14, d7) }] as const));
  const stats = Object.fromEntries(pairs) as Record<Activity, { last: number; prev: number }>;
  const { data: lastRow } = await supabase.from("weekend_challenges").select("activity_type").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const plan = planChallenge(stats, (lastRow as { activity_type?: string } | null)?.activity_type ?? null, now);
  const { error } = await supabase.from("weekend_challenges").insert({
    activity_type: plan.activity_type, title: plan.title, description: plan.description,
    target_count: plan.target_count, reward_amount: plan.reward_amount,
    starts_at: plan.starts_at, ends_at: plan.ends_at, is_active: true, generated_by_ai: false,
  } as never);
  if (error) throw error;
  return plan;
}
