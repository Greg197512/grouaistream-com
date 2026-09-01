import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

const reelDb = supabase as unknown as SupabaseClient;

export type ReelWatch = {
  source: "youtube" | "track";
  videoId?: string;
  trackId?: string;
  title?: string;
  artist?: string;
  era?: string;
};

const LOCAL = "grouai-reel-history-v1";
let lastKey = "";

// Zapisz obejrzenie rolki: na koncie w Supabase (między urządzeniami) + lokalnie.
// Buduje historię/zainteresowania użytkownika. Dedup po ostatnim wpisie.
export async function logReelWatch(userId: string | null, e: ReelWatch): Promise<void> {
  const id = e.videoId || e.trackId || "";
  if (!id) return;
  const key = `${userId || "anon"}|${id}`;
  if (key === lastKey) return; // ten sam film pod rząd — nie dubluj
  lastKey = key;

  // Lokalnie (per urządzenie, także dla niezalogowanych).
  try {
    const raw = localStorage.getItem(LOCAL);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ user: userId || "anon", ts: Date.now(), ...e });
    localStorage.setItem(LOCAL, JSON.stringify(list.slice(0, 500)));
  } catch { /* */ }

  // Na koncie (Supabase) — best-effort; gdy tabela/uprawnienia nieobecne, milczy.
  if (userId) {
    try {
      await reelDb.from("reel_history").insert({
        user_id: userId,
        source: e.source,
        video_id: e.videoId ?? null,
        track_id: e.trackId ?? null,
        title: e.title ?? null,
        artist: e.artist ?? null,
        era: e.era ?? null,
      });
    } catch { /* tabela może nie być jeszcze wdrożona */ }
  }
}

// Ostatnio oglądane (konto, jeśli zalogowany; inaczej lokalnie).
export async function recentReelWatches(userId: string | null, limit = 50): Promise<ReelWatch[]> {
  if (userId) {
    try {
      const { data } = await reelDb
        .from("reel_history").select("source,video_id,track_id,title,artist,era")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (Array.isArray(data) && data.length) {
        return data.map((r) => ({
          source: (r.source as "youtube" | "track") || "youtube",
          videoId: r.video_id || undefined, trackId: r.track_id || undefined,
          title: r.title || undefined, artist: r.artist || undefined, era: r.era || undefined,
        }));
      }
    } catch { /* */ }
  }
  try {
    const raw = localStorage.getItem(LOCAL);
    const list = raw ? JSON.parse(raw) : [];
    return list.slice(0, limit);
  } catch { return []; }
}
