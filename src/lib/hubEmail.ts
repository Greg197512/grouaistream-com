import { supabase } from "@/integrations/supabase/client";

// Wysyłka maili: Vercel /api/admin-email (stary hub nie istnieje). Admin-only (serwer sprawdza has_role).
// Transport: send-transactional-email głównego projektu (noreply@grouaistream.com) albo Resend/Brevo, gdy ustawione.
const HUB_EMAIL_URL = "/api/admin-email";

export interface HubEmailResult {
  success: boolean;
  recipientCount?: number;
  sent?: number;
  errors?: number;
  skipped?: number;
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

/** Po złożeniu zlecenia B2B: powiadomienie dla zespołu + potwierdzenie dla klienta. Nigdy nie rzuca. */
export async function notifyB2BOrder(orderId: string): Promise<void> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token;
    if (!token) return;
    await fetch(HUB_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "b2b-order", orderId }),
    });
  } catch { /* powiadomienie opcjonalne */ }
}
