import { supabase } from "@/integrations/supabase/client";

// Wysyłka maili działa na HUBIE (Resend) — funkcje na LIVE (bvstv) były martwe.
// Admin-only (hub sprawdza has_role). Nadawca: hub_config.lead_from_email.
const HUB_EMAIL_URL = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/hub-email-send";

export interface HubEmailResult {
  success: boolean;
  recipientCount?: number;
  sent?: number;
  errors?: number;
  subject?: string;
  mode?: string;
  error?: string;
}

export async function sendHubEmail(body: {
  mode: "single" | "mass";
  subject: string;
  html: string;
  to?: string;
  audience?: string;
}): Promise<HubEmailResult> {
  const { data: s } = await supabase.auth.getSession();
  const token = s?.session?.access_token;
  if (!token) return { success: false, error: "Zaloguj się jako admin" };
  try {
    const r = await fetch(HUB_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return await r.json().catch(() => ({ success: false, error: `HTTP ${r.status}` }));
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
