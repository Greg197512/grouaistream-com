import { supabase } from "@/integrations/supabase/client";

// Neuro-profil = „muzyczny mózg". Hub analizuje zachowania usera (odsłuchy, lajki,
// nastroje) przez jego JWT i buduje profil dopaminowy. Wynik trzymany w bazie
// (neuro_profiles) — pamięć, która rośnie z każdą analizą.
const NEURO_URL = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/neuro-profile";

export interface NeuroProfile {
  top_genres?: string[];
  energy?: string;
  moods?: string[];
  listening_times?: string[];
  dopamine_triggers?: string[];
  recommendation?: string;
  summary?: string;
  status?: string;
  hint?: string;
}

export interface NeuroResult {
  ok: boolean;
  profile?: NeuroProfile;
  summary?: string;
  cached?: boolean;
  fresh?: boolean;
  error?: string;
}

export async function fetchNeuroProfile(force = false): Promise<NeuroResult> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token;
    if (!token) return { ok: false, error: "Zaloguj się, aby zbudować swój muzyczny mózg." };
    const r = await fetch(NEURO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ force }),
    });
    const data = await r.json().catch(() => null);
    if (!data) return { ok: false, error: `Błąd ${r.status}` };
    return data as NeuroResult;
  } catch (e: any) {
    return { ok: false, error: e?.message || "Błąd sieci" };
  }
}
