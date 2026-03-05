import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UnlockContextType {
  isUnlocked: boolean;
  unlock: (password: string) => Promise<boolean>;
  filterTracks: <T extends { artist?: string }>(tracks: T[]) => T[];
}

const UnlockContext = createContext<UnlockContextType>({
  isUnlocked: false,
  unlock: async () => false,
  filterTracks: (t) => t,
});

const STORAGE_KEY = "grouai_unlocked";

export const UnlockProvider = ({ children }: { children: ReactNode }) => {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  const unlock = async (password: string): Promise<boolean> => {
    // Check against database codes
    const { data } = await supabase
      .from("unlock_codes")
      .select("id")
      .eq("code", password)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
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
