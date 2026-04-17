import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearStoredAuthSession, restoreSessionSafely } from "@/lib/authSession";

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
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, role, subscription_status, first_login_completed")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
        return;
      }

      const nextProfile: UserProfile = {
        displayName: data?.display_name ?? null,
        role: (data?.role as ProfileRole | null) ?? "free",
        subscriptionStatus: data?.subscription_status ?? "free",
        firstLoginCompleted: Boolean(data?.first_login_completed),
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

        if (event === "SIGNED_IN") {
          setTimeout(async () => {
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("first_login_completed")
                .eq("user_id", session.user.id)
                .maybeSingle();

              if (profileData && !profileData.first_login_completed) {
                setIsFirstLogin(true);
                await supabase
                  .from("profiles")
                  .update({ first_login_completed: true })
                  .eq("user_id", session.user.id);
                await fetchProfile(session.user.id);
                console.log("First login completed - mood history reset");
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: displayName || email.split("@")[0],
          },
        },
      });
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
