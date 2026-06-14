import { supabase } from "@/integrations/supabase/client";
import { withTimeout, TimeoutError } from "@/lib/withTimeout";

const AUTH_RESTORE_TIMEOUT_MS = 15_000;

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
    // Timeout = wolny net / chwilowy lag. NIE kasujemy sesji — onAuthStateChange
    // i tak odzyska zapisaną sesję; kasowanie tu wylogowywało ludzi bez powodu.
    if (error instanceof TimeoutError) {
      console.warn("[Auth] Session restore timed out — zachowuję sesję do odzyskania:", error);
      return null;
    }

    // Realny błąd (np. uszkodzony token) — wtedy czyścimy.
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