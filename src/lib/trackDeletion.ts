import { supabase } from "@/integrations/supabase/client";

export interface DeletableTrack {
  id: string;
  audio_url?: string | null;
  video_url?: string | null;
  cover_url?: string | null;
}

// Wyciąga bucket + ścieżkę z publicznego/podpisanego URL Supabase Storage.
const parseStoragePath = (url?: string | null): { bucket: string; path: string } | null => {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2].split("?")[0]) };
};

const removeFromStorage = async (url?: string | null) => {
  const parsed = parseStoragePath(url);
  if (!parsed) return;
  try {
    await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  } catch {
    /* best-effort — jak plik zostanie w storage, i tak nie pokaże się w apce (wiersz w DB usunięty) */
  }
};

// Rozgłasza usunięcie utworu do CAŁEJ aplikacji:
//  - "grouai:track-deleted" → PlayerContext czyści kolejkę/odtwarzacz natychmiast,
//  - "track-list-changed"   → listy (np. MyTracks) przeładowują się.
export const broadcastTrackDeleted = (trackId: string) => {
  window.dispatchEvent(new CustomEvent("grouai:track-deleted", { detail: { trackId } }));
  window.dispatchEvent(new Event("track-list-changed"));
};

// Po usunięciu wiersza z tabeli `tracks`: skasuj pliki i rozgłoś zmianę.
// (Realtime DELETE na tabeli `tracks` dodatkowo czyści apkę u innych zalogowanych.)
export const finalizeTrackDeletion = async (track: DeletableTrack) => {
  await Promise.all([
    removeFromStorage(track.audio_url),
    removeFromStorage(track.video_url),
    removeFromStorage(track.cover_url),
  ]);
  broadcastTrackDeleted(track.id);
};
