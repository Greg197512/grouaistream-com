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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const unlock = async (password: string): Promise<boolean> => {
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
    // Authenticated users or unlocked guests see everything
    if (isUnlocked || isAuthenticated) return tracks;
    return tracks.filter((t) => {
      const artist = (t.artist || "").toLowerCase().trim();
      return artist === "unknown artist" || artist === "unknown" || artist === "";
    });
  };

  return (
    <UnlockContext.Provider value={{ isUnlocked: isUnlocked || isAuthenticated, unlock, filterTracks }}>
      {children}
    </UnlockContext.Provider>
  );
};

export const useUnlock = () => useContext(UnlockContext);
