import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface UnlockContextType {
  isUnlocked: boolean;
  unlock: (password: string) => boolean;
  filterTracks: <T extends { artist?: string }>(tracks: T[]) => T[];
}

const UnlockContext = createContext<UnlockContextType>({
  isUnlocked: false,
  unlock: () => false,
  filterTracks: (t) => t,
});

const UNLOCK_PASSWORD = "222005";
const STORAGE_KEY = "grouai_unlocked";

export const UnlockProvider = ({ children }: { children: ReactNode }) => {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  const unlock = (password: string): boolean => {
    if (password === UNLOCK_PASSWORD) {
      setIsUnlocked(true);
      sessionStorage.setItem(STORAGE_KEY, "true");
      return true;
    }
    return false;
  };

  const filterTracks = <T extends { artist?: string }>(tracks: T[]): T[] => {
    if (isUnlocked) return tracks;
    return tracks.filter((t) => {
      const artist = (t.artist || "").toLowerCase().trim();
      return artist === "unknown artist" || artist === "unknown" || artist === "";
    });
  };

  return (
    <UnlockContext.Provider value={{ isUnlocked, unlock, filterTracks }}>
      {children}
    </UnlockContext.Provider>
  );
};

export const useUnlock = () => useContext(UnlockContext);
