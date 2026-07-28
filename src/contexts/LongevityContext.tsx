/**
 * Kontekst modułu „Zatrzymać Starość”.
 *
 * Odpowiada za trzy rzeczy i nic więcej:
 *  1. trzyma stan (profil, ustawienia, rekordy dzienne, XP),
 *  2. utrzymuje synchronizację local-first ↔ Supabase,
 *  3. wystawia jeden zmemoizowany `analysis` z pełnego silnika.
 *
 * Komponenty nie liczą wskaźników samodzielnie — biorą gotowy `analysis`.
 * Dzięki temu ta sama liczba nigdy nie różni się między ekranami.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  buildExportBundle,
  fetchRemoteProfile,
  fetchRemoteRecords,
  loadProfile,
  loadRecords,
  loadSettings,
  loadXp,
  mergeRecord,
  pushRemoteProfile,
  pushRemoteRecord,
  pushRemoteRecords,
  saveProfile,
  saveRecords,
  saveSettings,
  saveXp,
  wipeLocalData,
  wipeRemoteData,
  type ExportBundle,
  type LongevitySettings,
} from "@/lib/longevity/storage";
import {
  DEMO_PROFILE,
  analyzeDay,
  generateDemoHistory,
  toIsoDate,
  type DailyRecord,
  type DayAnalysis,
  type UserProfile,
} from "@/lib/longevity";

type SyncStatus = "idle" | "syncing" | "synced" | "local-only" | "error";

interface LongevityContextValue {
  /** Profil użytkownika (w trybie demo — profil demonstracyjny). */
  profile: UserProfile;
  settings: LongevitySettings;
  /** Historia dni posortowana rosnąco, łącznie z dzisiejszym. */
  records: DailyRecord[];
  today: DailyRecord;
  todayDate: string;
  analysis: DayAnalysis;
  totalXp: number;
  syncStatus: SyncStatus;
  syncMessage?: string;
  /** Czy pracujemy na danych poglądowych. */
  demoMode: boolean;
  hasRealData: boolean;

  updateProfile: (patch: Partial<UserProfile>) => void;
  updateSettings: (patch: Partial<LongevitySettings>) => void;
  /** Dopisuje dane do wybranego dnia (domyślnie dziś), scalając z istniejącymi. */
  updateRecord: (patch: Partial<DailyRecord>, date?: string) => void;
  /** Import całej paczki (np. z eksportu RODO lub z pliku urządzenia). */
  importRecords: (bundle: ExportBundle) => void;
  setDemoMode: (enabled: boolean) => void;
  exportData: () => ExportBundle;
  deleteAllData: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const LongevityContext = createContext<LongevityContextValue | undefined>(undefined);

export const useLongevity = (): LongevityContextValue => {
  const ctx = useContext(LongevityContext);
  if (!ctx) throw new Error("useLongevity musi być użyte wewnątrz LongevityProvider");
  return ctx;
};

/** Dane demo generujemy raz na sesję — są deterministyczne, więc nie ma potrzeby liczyć ich ponownie. */
let demoCache: DailyRecord[] | null = null;
const getDemoHistory = (): DailyRecord[] => {
  if (!demoCache) demoCache = generateDemoHistory(180);
  return demoCache;
};

export const LongevityProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const [settings, setSettings] = useState<LongevitySettings>(() => loadSettings());
  const [records, setRecords] = useState<DailyRecord[]>(() => loadRecords());
  const [totalXp, setTotalXp] = useState<number>(() => loadXp());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string | undefined>();

  const todayDate = toIsoDate(new Date());
  const pendingSync = useRef<Set<string>>(new Set());

  // ── Pobranie danych z chmury po zalogowaniu ────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setSyncStatus("local-only");
      return;
    }
    let cancelled = false;

    void (async () => {
      setSyncStatus("syncing");
      const [remoteProfile, remoteRecords] = await Promise.all([
        fetchRemoteProfile(user.id),
        fetchRemoteRecords(user.id),
      ]);
      if (cancelled) return;

      if (remoteProfile) {
        setProfile(remoteProfile.profile);
        setSettings((current) => ({ ...remoteProfile.settings, demoMode: current.demoMode }));
        setTotalXp((current) => Math.max(current, remoteProfile.xp));
      }

      if (remoteRecords) {
        // Chmura i pamięć lokalna scalają się per dzień: świeższy wpis wygrywa
        // polami, których druga strona nie ma.
        setRecords((local) => {
          let merged = [...remoteRecords];
          for (const record of local) merged = mergeRecord(merged, record);
          saveRecords(merged);
          return merged;
        });
        setSyncStatus("synced");
        setSyncMessage(undefined);
      } else {
        setSyncStatus("local-only");
        setSyncMessage("Dane trzymane lokalnie — synchronizacja w chmurze nie jest jeszcze aktywna.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ── Zapis lokalny przy każdej zmianie ──────────────────────────────────────
  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveXp(totalXp), [totalXp]);

  // ── Odłożona synchronizacja zmienionych dni ────────────────────────────────
  const flushPending = useCallback(async () => {
    if (!user?.id || pendingSync.current.size === 0 || settings.demoMode) return;
    const dates = Array.from(pendingSync.current);
    pendingSync.current.clear();
    const toPush = records.filter((r) => dates.includes(r.date));
    if (toPush.length === 0) return;

    setSyncStatus("syncing");
    const result =
      toPush.length === 1
        ? await pushRemoteRecord(user.id, toPush[0])
        : await pushRemoteRecords(user.id, toPush);
    if (result.ok) {
      setSyncStatus("synced");
      setSyncMessage(undefined);
    } else {
      setSyncStatus("local-only");
      setSyncMessage(result.reason);
    }
  }, [records, settings.demoMode, user?.id]);

  useEffect(() => {
    // Zbieramy zmiany przez 2 sekundy — suwak nawodnienia nie powinien
    // generować żądania na każdy ruch palca.
    const timer = window.setTimeout(() => void flushPending(), 2000);
    return () => window.clearTimeout(timer);
  }, [flushPending, records]);

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      setProfile((current) => {
        const next = { ...current, ...patch };
        if (user?.id && !settings.demoMode) {
          void pushRemoteProfile(user.id, next, settings, totalXp);
        }
        return next;
      });
    },
    [settings, totalXp, user?.id],
  );

  const updateSettings = useCallback(
    (patch: Partial<LongevitySettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (user?.id && !next.demoMode) {
          void pushRemoteProfile(user.id, profile, next, totalXp);
        }
        return next;
      });
    },
    [profile, totalXp, user?.id],
  );

  const updateRecord = useCallback(
    (patch: Partial<DailyRecord>, date?: string) => {
      const targetDate = date ?? todayDate;
      setRecords((current) => {
        const next = mergeRecord(current, { ...patch, date: targetDate });
        pendingSync.current.add(targetDate);
        return next;
      });
    },
    [todayDate],
  );

  const importRecords = useCallback(
    (bundle: ExportBundle) => {
      setRecords((current) => {
        let merged = [...current];
        for (const record of bundle.records) merged = mergeRecord(merged, record);
        bundle.records.forEach((r) => pendingSync.current.add(r.date));
        return merged;
      });
      if (bundle.profile) setProfile((current) => ({ ...current, ...bundle.profile }));
      if (typeof bundle.totalXp === "number") setTotalXp((current) => Math.max(current, bundle.totalXp));
    },
    [],
  );

  const setDemoMode = useCallback((enabled: boolean) => {
    setSettings((current) => ({ ...current, demoMode: enabled }));
  }, []);

  const activeRecords = settings.demoMode ? getDemoHistory() : records;
  const activeProfile = settings.demoMode ? DEMO_PROFILE : profile;

  const today = useMemo(
    () => activeRecords.find((r) => r.date === todayDate) ?? { date: todayDate, sources: [] },
    [activeRecords, todayDate],
  );

  const analysis = useMemo(
    () => analyzeDay(today, activeRecords, activeProfile, { totalXp: settings.demoMode ? undefined : totalXp }),
    [today, activeRecords, activeProfile, settings.demoMode, totalXp],
  );

  // XP rośnie wraz z ukończonymi misjami — zapisujemy tylko wzrost,
  // żeby ponowne otwarcie ekranu nie naliczało punktów drugi raz.
  useEffect(() => {
    if (settings.demoMode) return;
    setTotalXp((current) => Math.max(current, analysis.gamification.xp));
  }, [analysis.gamification.xp, settings.demoMode]);

  const exportData = useCallback(
    () => buildExportBundle(profile, settings, records, totalXp),
    [profile, records, settings, totalXp],
  );

  const deleteAllData = useCallback(async () => {
    wipeLocalData();
    if (user?.id) await wipeRemoteData(user.id);
    setProfile(DEFAULT_PROFILE);
    setSettings(DEFAULT_SETTINGS);
    setRecords([]);
    setTotalXp(0);
  }, [user?.id]);

  const syncNow = useCallback(async () => {
    if (!user?.id) {
      setSyncStatus("local-only");
      setSyncMessage("Zaloguj się, aby synchronizować dane między urządzeniami.");
      return;
    }
    setSyncStatus("syncing");
    const result = await pushRemoteRecords(user.id, records);
    await pushRemoteProfile(user.id, profile, settings, totalXp);
    if (result.ok) {
      setSyncStatus("synced");
      setSyncMessage(undefined);
    } else {
      setSyncStatus("error");
      setSyncMessage(result.reason);
    }
  }, [profile, records, settings, totalXp, user?.id]);

  const value = useMemo<LongevityContextValue>(
    () => ({
      profile: activeProfile,
      settings,
      records: activeRecords,
      today,
      todayDate,
      analysis,
      totalXp,
      syncStatus,
      syncMessage,
      demoMode: settings.demoMode,
      hasRealData: records.length > 0,
      updateProfile,
      updateSettings,
      updateRecord,
      importRecords,
      setDemoMode,
      exportData,
      deleteAllData,
      syncNow,
    }),
    [
      activeProfile,
      activeRecords,
      analysis,
      deleteAllData,
      exportData,
      importRecords,
      records.length,
      setDemoMode,
      settings,
      syncMessage,
      syncNow,
      syncStatus,
      today,
      todayDate,
      totalXp,
      updateProfile,
      updateRecord,
      updateSettings,
    ],
  );

  return <LongevityContext.Provider value={value}>{children}</LongevityContext.Provider>;
};
