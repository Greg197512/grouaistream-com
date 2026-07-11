// Offline biblioteka — pliki audio utworów w IndexedDB, żeby grały BEZ internetu.
//
// Świadomie NIE używamy Service Workera ani Cache API: src/main.tsx (kill-switch)
// wyrejestrowuje każdy SW i czyści CAŁY Cache Storage przy każdym starcie apki
// (żeby uniknąć pętli reloadów, która psuła produkcję). IndexedDB jest przez
// ten kill-switch nietknięty — więc to jedyne bezpieczne, trwałe miejsce na
// pobrane utwory. Player (PlayerContext) sprawdza tu kopię przed odtwarzaniem.

const DB_NAME = "grouai-offline";
const STORE = "tracks";
const DB_VERSION = 1;

export interface OfflineTrackMeta {
  id: string;
  title: string;
  artist: string;
  mime: string;
  size: number;
  savedAt: number;
}

interface OfflineRecord extends OfflineTrackMeta {
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no-indexeddb"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function store(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

// Cache object-URLi, żeby nie tworzyć ich w kółko (i nie przeciekać pamięci).
const urlCache = new Map<string, string>();

/** Pobierz plik utworu i zapisz do IndexedDB (dostępny offline). */
export async function saveOfflineTrack(
  id: string,
  url: string,
  meta: { title: string; artist: string },
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const blob = await res.blob();
  const db = await openDb();
  const rec: OfflineRecord = {
    id,
    title: meta.title,
    artist: meta.artist,
    mime: blob.type || "audio/mpeg",
    size: blob.size,
    savedAt: Date.now(),
    blob,
  };
  await new Promise<void>((resolve, reject) => {
    const r = store(db, "readwrite").put(rec);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

/** Zwróć lokalny blob-URL utworu jeśli jest offline, inaczej null. Nigdy nie rzuca. */
export async function getOfflineObjectUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id)!;
  try {
    const db = await openDb();
    const rec = await new Promise<OfflineRecord | undefined>((resolve, reject) => {
      const r = store(db, "readonly").get(id);
      r.onsuccess = () => resolve(r.result as OfflineRecord | undefined);
      r.onerror = () => reject(r.error);
    });
    if (!rec?.blob) return null;
    const objUrl = URL.createObjectURL(rec.blob);
    urlCache.set(id, objUrl);
    return objUrl;
  } catch {
    return null;
  }
}

/** Usuń utwór z trybu offline. */
export async function removeOfflineTrack(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const r = store(db, "readwrite").delete(id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  const u = urlCache.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    urlCache.delete(id);
  }
}

/** Zbiór id utworów zapisanych offline (do oznaczeń w UI). Nigdy nie rzuca. */
export async function getOfflineIds(): Promise<Set<string>> {
  try {
    const db = await openDb();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const r = store(db, "readonly").getAllKeys();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return new Set(keys.map(String));
  } catch {
    return new Set();
  }
}

/** Czy dany utwór jest offline. Nigdy nie rzuca. */
export async function isOffline(id: string): Promise<boolean> {
  const ids = await getOfflineIds();
  return ids.has(id);
}

/** Lista metadanych pobranych utworów (bez blobów), najnowsze pierwsze. */
export async function listOfflineMeta(): Promise<OfflineTrackMeta[]> {
  try {
    const db = await openDb();
    const recs = await new Promise<OfflineRecord[]>((resolve, reject) => {
      const r = store(db, "readonly").getAll();
      r.onsuccess = () => resolve(r.result as OfflineRecord[]);
      r.onerror = () => reject(r.error);
    });
    return recs
      .map(({ blob: _blob, ...m }) => m)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}
