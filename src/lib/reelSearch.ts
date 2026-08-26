import { supabase } from "@/integrations/supabase/client";
import type { Track } from "@/contexts/PlayerContext";

const SEL = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

export type YtHit = { videoId: string; title: string; author: string };

// Oczyść zapytanie do filtra PostgREST (przecinki/nawiasy/% psują `or=`).
function clean(q: string): string {
  return q.replace(/[(),%*]/g, " ").replace(/\s{2,}/g, " ").trim();
}

// Szukaj w NASZYCH piosenkach (Supabase): tytuł / wykonawca / album / rok.
export async function searchOurSongs(query: string): Promise<Track[]> {
  const q = clean(query);
  if (!q) return [];
  const like = `%${q}%`;
  try {
    const { data } = await supabase
      .from("tracks").select(SEL)
      .or(`title.ilike.${like},artist.ilike.${like},album.ilike.${like}`)
      .or("audio_url.not.is.null,video_url.not.is.null")
      .limit(15);
    return Array.isArray(data) ? (data as unknown as Track[]) : [];
  } catch {
    return [];
  }
}

// Luźna propozycja, gdy dokładnie nic nie pasuje — bierzemy pierwsze słowo.
export async function looseSuggestion(query: string): Promise<Track | null> {
  const first = clean(query).split(" ")[0];
  if (!first || first.length < 2) return null;
  const list = await searchOurSongs(first);
  return list[0] || null;
}

// Szukaj w CAŁYM YouTube przez funkcję edge (tylko osadzalne filmy).
export async function searchYouTube(query: string): Promise<YtHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const { data, error } = await supabase.functions.invoke("youtube-search", { body: { q } });
    if (error) return [];
    const items = (data?.items || []) as YtHit[];
    return items.filter((x) => x.videoId);
  } catch {
    return [];
  }
}
