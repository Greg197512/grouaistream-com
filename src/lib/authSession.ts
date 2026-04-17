import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/withTimeout";

const AUTH_RESTORE_TIMEOUT_MS = 5_000;

export const clearStoredAuthSession = () => {
  if (typeof window === "undefined") return;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const keysToRemove = Object.keys(window.localStorage).filter((key) => {
    if (projectId && key.startsWith(`sb-${projectId}`)) return true;
    return key.includes("supabase.auth") || key.includes("auth-token");
  });

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
};

export const restoreSessionSafely = async () => {
  try {
    const {
      data: { session },
    } = await withTimeout(supabase.auth.getSession(), AUTH_RESTORE_TIMEOUT_MS, "Auth session restore");

    return session;
  } catch (error) {
    console.warn("[Auth] Session restore failed, clearing persisted session:", error);
    clearStoredAuthSession();

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore local signout cleanup errors
    }

    return null;
  }
};