import { supabase } from "../supabase/client";

type Provider = "google" | "apple" | "microsoft";
type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: Provider, opts?: SignInOptions) => {
      const supabaseProvider =
        provider === "microsoft" ? "azure" : provider;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as "google" | "apple" | "azure",
        options: {
          redirectTo: opts?.redirect_uri ?? window.location.origin,
          queryParams: opts?.extraParams,
        },
      });

      if (error) return { error, redirected: false };
      return { redirected: true, error: null };
    },
  },
};
