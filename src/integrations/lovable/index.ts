// Lovable auth replaced — direct Supabase OAuth
import { supabase } from "../supabase/client";

type SignInOptions = { redirect_uri?: string; extraParams?: Record<string, string>; };

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft", opts?: SignInOptions) => {
      const p = provider === "microsoft" ? "azure" : provider;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: p as "google" | "azure",
        options: { redirectTo: opts?.redirect_uri ?? window.location.origin, queryParams: opts?.extraParams },
      });
      if (error) return { error };
      return { redirected: true, data };
    },
  },
};
