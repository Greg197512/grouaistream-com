import { createContext, useContext, ReactNode } from "react";

interface UnlockContextType {
  isUnlocked: boolean;
  unlock: (password: string) => Promise<boolean>;
  filterTracks: <T extends { artist?: string }>(tracks: T[]) => T[];
  applyUnlockFilter: (query: any) => any;
}

const UnlockContext = createContext<UnlockContextType>({
  isUnlocked: true,
  unlock: async () => true,
  filterTracks: (t) => t,
  applyUnlockFilter: (q) => q,
});

export const UnlockProvider = ({ children }: { children: ReactNode }) => {
  return (
    <UnlockContext.Provider value={{
      isUnlocked: true,
      unlock: async () => true,
      filterTracks: (t) => t,
      applyUnlockFilter: (q) => q,
    }}>
      {children}
    </UnlockContext.Provider>
  );
};

export const useUnlock = () => useContext(UnlockContext);
