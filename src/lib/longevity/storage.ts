/**
 * Warstwa trwałości modułu „Zatrzymać Starość”.
 *
 * Model local-first: źródłem prawdy dla UI jest pamięć lokalna, a Supabase
 * służy jako synchronizacja między urządzeniami i kopia zapasowa. Dzięki temu
 * aplikacja działa offline (samolot, trening w terenie), a brak połączenia
 * nigdy nie blokuje zapisu dziennika.
 *
 * Wszystkie operacje zdalne są „miękkie”: jeśli tabele nie zostały jeszcze
 * zmigrowane albo użytkownik nie jest zalogowany, funkcje zwracają `null`
 * i aplikacja działa dalej na danych lokalnych.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { DailyRecord, IsoDate, LongevityLocale, UserProfile } from "./types";

/** Klient bez wygenerowanych typów — tabele modułu dochodzą osobną migracją. */
const db = supabase as unknown as SupabaseClient;

const KEY_PROFILE = "stopaging.profile.v1";
const KEY_RECORDS = "stopaging.records.v1";
const KEY_SETTINGS = "stopaging.settings.v1";
const KEY_XP = "stopaging.xp.v1";

export interface LongevitySettings {
  /** Tryb demonstracyjny — dane poglądowe, nigdy nie trafiają do bazy. */
  demoMode: boolean;
  locale: LongevityLocale;
  /** Maksymalna liczba powiadomień dziennie (wymóg produktowy: nie więcej niż 4). */
  maxNotificationsPerDay: number;
  /** Godziny ciszy — powiadomienia wstrzymane. */
  quietHours: { from: number; to: number };
  /** Czy wysyłać zanonimizowany kontekst do modelu językowego. */
  aiCoachEnabled: boolean;
  /** Czy pokazywać wartości z niską pewnością danych. */
  showLowConfidence: boolean;
  units: "metric" | "imperial";
}

export const DEFAULT_SETTINGS: LongevitySettings = {
  demoMode: false,
  locale: "pl",
  maxNotificationsPerDay: 4,
  quietHours: { from: 22, to: 7 },
  aiCoachEnabled: true,
  showLowConfidence: true,
  units: "metric",
};

export const DEFAULT_PROFILE: UserProfile = {
  chronologicalAge: 35,
  sex: "unspecified",
  heightCm: 175,
  smokingStatus: "never",
  targetSleepMin: 465,
  targetSteps: 8000,
  targetWaterMl: 2000,
  targetBedtimeMinOfDay: 1380,
  locale: "pl",
};

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Prywatny tryb przeglądarki albo brak miejsca — pomijamy zapis lokalny.
  }
};

// ── Pamięć lokalna ───────────────────────────────────────────────────────────

export const loadProfile = (): UserProfile => readJson(KEY_PROFILE, DEFAULT_PROFILE);
export const saveProfile = (profile: UserProfile): void => writeJson(KEY_PROFILE, profile);

export const loadSettings = (): LongevitySettings => readJson(KEY_SETTINGS, DEFAULT_SETTINGS);
export const saveSettings = (settings: LongevitySettings): void => writeJson(KEY_SETTINGS, settings);

export const loadXp = (): number => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(KEY_XP);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};
export const saveXp = (xp: number): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_XP, String(Math.round(xp)));
};

export const loadRecords = (): DailyRecord[] => {
  const raw = readJson<{ records?: DailyRecord[] }>(KEY_RECORDS, {});
  const records = raw.records ?? [];
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
};

export const saveRecords = (records: DailyRecord[]): void => {
  // Trzymamy lokalnie maksymalnie 400 dni — rok z zapasem, resztę ma baza.
  const trimmed = [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
  writeJson(KEY_RECORDS, { records: trimmed });
};

/**
 * Scala rekord dnia z tym, co już jest w pamięci — dane z urządzenia i wpisy
 * ręczne uzupełniają się, zamiast nadpisywać cały dzień.
 */
export const mergeRecord = (records: DailyRecord[], incoming: DailyRecord): DailyRecord[] => {
  const index = records.findIndex((r) => r.date === incoming.date);
  if (index === -1) {
    return [...records, incoming].sort((a, b) => a.date.localeCompare(b.date));
  }
  const existing = records[index];
  const merged: DailyRecord = {
    ...existing,
    ...incoming,
    sleep: incoming.sleep ? { ...existing.sleep, ...incoming.sleep } : existing.sleep,
    cardio: incoming.cardio ? { ...existing.cardio, ...incoming.cardio } : existing.cardio,
    activity: incoming.activity ? { ...existing.activity, ...incoming.activity } : existing.activity,
    body: incoming.body ? { ...existing.body, ...incoming.body } : existing.body,
    vendor: incoming.vendor ? { ...existing.vendor, ...incoming.vendor } : existing.vendor,
    nutrition: incoming.nutrition ? { ...existing.nutrition, ...incoming.nutrition } : existing.nutrition,
    lifestyle: incoming.lifestyle ? { ...existing.lifestyle, ...incoming.lifestyle } : existing.lifestyle,
    subjective: incoming.subjective ? { ...existing.subjective, ...incoming.subjective } : existing.subjective,
    sources: Array.from(new Set([...(existing.sources ?? []), ...(incoming.sources ?? [])])),
  };
  const next = [...records];
  next[index] = merged;
  return next;
};

// ── Synchronizacja z Supabase ────────────────────────────────────────────────

/** Kształt wiersza `longevity_daily_records`. */
interface RemoteRecordRow {
  user_id: string;
  day: IsoDate;
  payload: DailyRecord;
}

export interface SyncResult {
  ok: boolean;
  /** Powód niepowodzenia — pokazywany w ustawieniach, nie w toastach. */
  reason?: string;
}

export const fetchRemoteRecords = async (userId: string, days = 400): Promise<DailyRecord[] | null> => {
  try {
    const { data, error } = await db
      .from("longevity_daily_records")
      .select("day, payload")
      .eq("user_id", userId)
      .order("day", { ascending: true })
      .limit(days);
    if (error || !data) return null;
    return (data as Array<{ day: IsoDate; payload: DailyRecord }>)
      .map((row) => ({ ...row.payload, date: row.day }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
};

export const pushRemoteRecord = async (userId: string, record: DailyRecord): Promise<SyncResult> => {
  try {
    const row: RemoteRecordRow = { user_id: userId, day: record.date, payload: record };
    const { error } = await db.from("longevity_daily_records").upsert(row, { onConflict: "user_id,day" });
    return error ? { ok: false, reason: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Błąd synchronizacji" };
  }
};

export const pushRemoteRecords = async (userId: string, records: DailyRecord[]): Promise<SyncResult> => {
  try {
    const rows: RemoteRecordRow[] = records.map((record) => ({
      user_id: userId,
      day: record.date,
      payload: record,
    }));
    // Porcjami po 100 — upsert całego roku w jednym żądaniu bywa odrzucany.
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await db
        .from("longevity_daily_records")
        .upsert(rows.slice(i, i + 100), { onConflict: "user_id,day" });
      if (error) return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Błąd synchronizacji" };
  }
};

export const fetchRemoteProfile = async (
  userId: string,
): Promise<{ profile: UserProfile; settings: LongevitySettings; xp: number } | null> => {
  try {
    const { data, error } = await db
      .from("longevity_profiles")
      .select("profile, settings, total_xp")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { profile: UserProfile; settings: LongevitySettings; total_xp: number };
    return {
      profile: { ...DEFAULT_PROFILE, ...row.profile },
      settings: { ...DEFAULT_SETTINGS, ...row.settings },
      xp: row.total_xp ?? 0,
    };
  } catch {
    return null;
  }
};

export const pushRemoteProfile = async (
  userId: string,
  profile: UserProfile,
  settings: LongevitySettings,
  xp: number,
): Promise<SyncResult> => {
  try {
    const { error } = await db.from("longevity_profiles").upsert(
      { user_id: userId, profile, settings, total_xp: Math.round(xp), updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    return error ? { ok: false, reason: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Błąd synchronizacji" };
  }
};

/**
 * Eksport wszystkich danych użytkownika (RODO, art. 20 — prawo do przenoszenia).
 * Format jest samodokumentujący: da się go wczytać z powrotem funkcją `importBundle`.
 */
export interface ExportBundle {
  version: 1;
  exportedAt: string;
  profile: UserProfile;
  settings: LongevitySettings;
  totalXp: number;
  records: DailyRecord[];
}

export const buildExportBundle = (
  profile: UserProfile,
  settings: LongevitySettings,
  records: DailyRecord[],
  xp: number,
): ExportBundle => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  profile,
  settings,
  totalXp: xp,
  records,
});

export const importBundle = (json: string): ExportBundle | null => {
  try {
    const parsed = JSON.parse(json) as ExportBundle;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) return null;
    return parsed;
  } catch {
    return null;
  }
};

/** Usunięcie wszystkich danych lokalnych (RODO, art. 17 — prawo do usunięcia). */
export const wipeLocalData = (): void => {
  if (typeof window === "undefined") return;
  [KEY_PROFILE, KEY_RECORDS, KEY_SETTINGS, KEY_XP].forEach((key) => window.localStorage.removeItem(key));
};

export const wipeRemoteData = async (userId: string): Promise<SyncResult> => {
  try {
    const records = await db.from("longevity_daily_records").delete().eq("user_id", userId);
    const profileRow = await db.from("longevity_profiles").delete().eq("user_id", userId);
    const error = records.error ?? profileRow.error;
    return error ? { ok: false, reason: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Błąd usuwania" };
  }
};
