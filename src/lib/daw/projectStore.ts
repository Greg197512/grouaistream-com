// Zapis i odczyt projektów DAW: układ i ustawienia w tabeli daw_projects, pliki klipów na R2.
import { rawDb } from "@/lib/untypedSupabase";
import { uploadToR2 } from "@/lib/r2Upload";
import { encodeWav16 } from "@/lib/releasePrep";
import type { Clip, Project, Track } from "./audio";

type StoredClip = Pick<Clip, "name" | "start" | "offset" | "duration" | "gain"> & { url: string };
type StoredTrack = Omit<Track, "clips"> & { clips: StoredClip[] };
export type StoredProject = { bpm: number; tracks: StoredTrack[] };
export type ProjectListItem = { id: string; title: string; updated_at: string };

const channels = (b: AudioBuffer) => Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c));

/** Wgrywa brakujące pliki klipów (nagrania jako oryginalny plik, reszta jako WAV) i zwraca projekt z adresami. */
async function uploadClips(project: Project, userId: string, onStep?: (s: string) => void): Promise<Project> {
  const pending = project.tracks.flatMap((t) => t.clips.filter((c) => !c.url));
  let done = 0;
  const urls = new Map<AudioBuffer, string>(); // ten sam bufor (powielone/podzielone klipy) wgrywamy raz
  const tracks: Track[] = [];
  for (const t of project.tracks) {
    const clips: Clip[] = [];
    for (const c of t.clips) {
      if (c.url) { clips.push(c); continue; }
      let url = urls.get(c.buffer);
      if (!url) {
        onStep?.(`Zapisuję pliki projektu ${++done}/${pending.length}…`);
        const file = c.blob
          ? new File([c.blob], `${c.id}.${c.blob.type.includes("mp4") ? "m4a" : "webm"}`, { type: c.blob.type || "audio/webm" })
          : new File([encodeWav16(channels(c.buffer), c.buffer.sampleRate)], `${c.id}.wav`, { type: "audio/wav" });
        url = (await uploadToR2({ file, folder: `daw/${userId}` })).publicUrl;
        urls.set(c.buffer, url);
      }
      clips.push({ ...c, url, blob: undefined });
    }
    tracks.push({ ...t, clips });
  }
  return { ...project, tracks };
}

const toStored = (p: Project): StoredProject => ({
  bpm: p.bpm,
  tracks: p.tracks.map(({ clips, ...t }) => ({
    ...t, armed: false,
    clips: clips.map((c) => ({ url: c.url!, name: c.name, start: c.start, offset: c.offset, duration: c.duration, gain: c.gain })),
  })),
});

/** Zapisuje projekt (nowy albo nadpisuje `id`). Zwraca id i projekt z adresami plików. */
export async function saveProject(project: Project, title: string, userId: string, id: string | null, onStep?: (s: string) => void) {
  const withUrls = await uploadClips(project, userId, onStep);
  const data = toStored(withUrls);
  if (id) {
    const { error } = await rawDb.from("daw_projects").update({ title, data, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    return { id, project: withUrls };
  }
  const { data: row, error } = await rawDb.from("daw_projects").insert({ user_id: userId, title, data }).select("id").maybeSingle();
  if (error || !row) throw new Error(error?.message || "Nie udało się zapisać projektu");
  return { id: (row as { id: string }).id, project: withUrls };
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const { data } = await rawDb.from("daw_projects").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(30);
  return (data as ProjectListItem[] | null) ?? [];
}

/** Wczytuje projekt; `decode` pobiera i dekoduje plik (przez proxy, bo R2 nie ma CORS). */
export async function loadProject(id: string, decode: (url: string) => Promise<AudioBuffer>, onStep?: (s: string) => void) {
  const { data, error } = await rawDb.from("daw_projects").select("title, data").eq("id", id).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Nie znaleziono projektu");
  const row = data as { title: string; data: StoredProject };
  const cache = new Map<string, Promise<AudioBuffer>>();
  const all = row.data.tracks.flatMap((t) => t.clips.map((c) => c.url));
  let n = 0;
  const get = (url: string) => {
    let p = cache.get(url);
    if (!p) { onStep?.(`Wczytuję pliki ${++n}/${new Set(all).size}…`); p = decode(url); cache.set(url, p); }
    return p;
  };
  const tracks: Track[] = [];
  for (const t of row.data.tracks) {
    const clips: Clip[] = [];
    for (const c of t.clips) clips.push({ ...c, id: Math.random().toString(36).slice(2, 10), buffer: await get(c.url) });
    tracks.push({ ...t, clips });
  }
  return { title: row.title, project: { bpm: row.data.bpm, tracks } as Project };
}
