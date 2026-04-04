import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UnlockContextType {
  isUnlocked: boolean;
  unlock: (password: string) => Promise<boolean>;
  filterTracks: <T extends { artist?: string }>(tracks: T[]) => T[];
  /** Apply artist filter at the Supabase query level for correct LIMIT behavior */
  applyUnlockFilter: (query: any) => any;
}

const UnlockContext = createContext<UnlockContextType>({
  isUnlocked: false,
  unlock: async () => false,
  filterTracks: (t) => t,
  applyUnlockFilter: (q) => q,
});

const STORAGE_KEY = "grouai_unlocked";

export const UnlockProvider = ({ children }: { children: ReactNode }) => {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  const unlock = async (password: string): Promise<boolean> => {
    // Verify code via secure RPC (codes are never exposed to client)
    const { data, error } = await supabase
      .rpc("verify_unlock_code", { candidate: password });

    if (!error && data === true) {
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
