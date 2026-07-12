import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearStoredAuthSession, restoreSessionSafely } from "@/lib/authSession";
import { trackGeo } from "@/lib/hubGeo";

export type ProfileRole = "free" | "artist" | "pro";

interface UserProfile {
  displayName: string | null;
  role: ProfileRole;
  subscriptionStatus: string;
  firstLoginCompleted: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isFirstLogin: boolean;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  clearFirstLogin: () => void;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const clearFirstLogin = () => setIsFirstLogin(false);

  const fetchProfile = useCallback(async (userId?: string) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_my_profile");

      if (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;

      const nextProfile: UserProfile = {
        displayName: row?.display_name ?? null,
        role: (row?.role as ProfileRole | null) ?? "free",
        subscriptionStatus: row?.subscription_status ?? "free",
        firstLoginCompleted: Boolean(row?.first_login_completed),
      };

      console.log("[Auth] active profile role:", {
        userId,
        role: nextProfile.role,
        subscriptionStatus: nextProfile.subscriptionStatus,
      });

      setProfile(nextProfile);
    } catch (err) {
      console.error("Profile fetch failed:", err);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(user?.id);
  }, [fetchProfile, user?.id]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (!session?.user) {
          setProfile(null);
          return;
        }

        void fetchProfile(session.user.id);

        // Zapisz lokalizację (IP/miasto) usera — raz na sesję (hub geo-track).
        trackGeo();

        if (event === "SIGNED_IN") {
          // Program poleceń: jeśli user przyszedł z linku ?ref=KOD,
          // przypisz kod polecającego (RPC pilnuje: tylko raz, nie self,
          // tylko świeże konta — patrz migracja referral_program).
          const pendingRefCode = localStorage.getItem("grouai-ref-code");
          if (pendingRefCode) {
            (supabase.rpc as any)("apply_referral_code", { _code: pendingRefCode })
              .then(({ data, error }: { data: any; error: any }) => {
                if (!error && data?.ok) {
                  console.log("[Referral] kod polecający przypisany:", pendingRefCode);
                }
                // Niezależnie od wyniku — kod jednorazowy
                localStorage.removeItem("grouai-ref-code");
              })
              .catch(() => localStorage.removeItem("grouai-ref-code"));
          }

          setTimeout(async () => {
            try {
              const { data: profileData } = await supabase.rpc("get_my_profile");
              const row = Array.isArray(profileData) ? profileData[0] : profileData;

              if (row && !row.first_login_completed) {
                setIsFirstLogin(true);
                await supabase
                  .from("profiles")
                  .update({ first_login_completed: true })
                  .eq("user_id", session.user.id);
                await fetchProfile(session.user.id);
                console.log("First login completed - mood history reset");

                // Fire welcome webhook for first-time logins that bypassed signUp()
                // (Google OAuth, Apple, magic link, etc.) so the new email shows up
                // in the system and n8n welcome flow — same as email/password signup.
                const provider =
                  (session.user.app_metadata as any)?.provider ?? "email";
                if (provider !== "email" && session.user.email) {
                  const N8N_WELCOME_WEBHOOK =
                    "https://gregorypeek.app.n8n.cloud/webhook/grouai-signup";
                  const displayName =
                    (session.user.user_metadata as any)?.display_name ||
                    (session.user.user_metadata as any)?.full_name ||
                    (session.user.user_metadata as any)?.name ||
                    session.user.email.split("@")[0];
                  fetch(N8N_WELCOME_WEBHOOK, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: session.user.email,
                      displayName,
                      provider,
                      source: "oauth_first_login",
                    }),
                    keepalive: true,
                  }).catch((err) => {
                    console.warn("[Auth] OAuth welcome webhook failed:", err);
                  });
                  console.log(`[Auth] OAuth first login (${provider}) — welcome webhook sent`);
                }
              }
            } catch (err) {
              console.error("Error checking first login:", err);
            }
          }, 100);
        }
      }
    );

    restoreSessionSafely().then(async (session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const finalDisplayName = displayName || email.split("@")[0];
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: finalDisplayName,
          },
        },
      });

      // Fire-and-forget welcome email via n8n (non-blocking, errors silently ignored)
      if (!error) {
        const N8N_WELCOME_WEBHOOK =
          "https://gregorypeek.app.n8n.cloud/webhook/grouai-signup";
        fetch(N8N_WELCOME_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, displayName: finalDisplayName }),
          keepalive: true,
        }).catch((err) => {
          console.warn("[Auth] welcome email webhook failed:", err);
        });
      }

      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsFirstLogin(false);

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.error("Sign out failed:", error);
      }
    } finally {
      clearStoredAuthSession();
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isFirstLogin, profile, refreshProfile, clearFirstLogin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
