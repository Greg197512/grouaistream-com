/**
 * Odcinki radiowe (Nocna Rozmowa i pliki wrzucone tylko po URL do R2)
 * nie są muzyką. Trzymamy je z dala od Nowych, wyszukiwarki, gatunków,
 * rekomendacji i „Moich utworów". Po migracji robi to też RLS
 * (`tracks.catalog_hidden`); ten filtr działa od razu, zanim SQL wejdzie
 * na produkcję, i na snapshotcie /tracks.json.
 */
export function isRadioOnlyTrack(track: {
  title?: string | null;
  audio_url?: string | null;
  catalog_hidden?: boolean | null;
} | null | undefined): boolean {
  if (!track) return false;
  if (track.catalog_hidden) return true;
  const title = track.title || "";
  const url = track.audio_url || "";
  if (/nocna[\s-]*rozmowa/i.test(title)) return true;
  if (/nocna-rozmowa/i.test(url)) return true;
  return false;
}

export function omitRadioOnlyTracks<T extends { title?: string | null; audio_url?: string | null; catalog_hidden?: boolean | null }>(
  rows: T[] | null | undefined,
): T[] {
  if (!rows?.length) return [];
  return rows.filter((row) => !isRadioOnlyTrack(row));
}
