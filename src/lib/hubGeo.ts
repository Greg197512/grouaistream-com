import { supabase } from "@/integrations/supabase/client";

// Geo-capture działa na hubie GrouAI (Supabase udostępnia IP tylko w logach auth,
// niedostępnych z klienta). Hub weryfikuje JWT usera LIVE i geolokalizuje IP.
const HUB = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1";

async function hubPost(path: string, body: Record<string, unknown> = {}): Promise<any> {
  const { data: s } = await supabase.auth.getSession();
  const token = s?.session?.access_token;
  if (!token) return { ok: false, error: "no-session" };
  try {
    const r = await fetch(`${HUB}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Zapisz lokalizację usera (IP + miasto). Fire-and-forget, raz na sesję.
let geoTracked = false;
export function trackGeo() {
  if (geoTracked) return;
  geoTracked = true;
  hubPost("geo-track").catch(() => {});
}

export interface UserGeo {
  user_id: string;
  email: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  first_seen: string;
  last_seen: string;
  hits: number;
  user_agent?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  isp?: string | null;
  lat?: number | null;
  lng?: number | null;
}

// Lista lokalizacji userów — tylko admin (hub sprawdza has_role).
export async function fetchGeoList(): Promise<UserGeo[]> {
  const res = await hubPost("admin-geo-list");
  return res?.ok ? (res.rows as UserGeo[]) : [];
}

// ── Obecność (heartbeat) ─────────────────────────────────────────────────────
// Bijemy „serce” co ~60 s gdy apka otwarta → historia „ilu online w czasie”.
let presenceTimer: number | null = null;
export function startPresenceHeartbeat() {
  if (presenceTimer !== null) return;
  const beat = () => { hubPost("presence-ping").catch(() => {}); };
  beat();
  presenceTimer = setInterval(beat, 60_000) as unknown as number;
}
export function stopPresenceHeartbeat() {
  if (presenceTimer !== null) { clearInterval(presenceTimer); presenceTimer = null; }
}

export interface PresenceStats {
  online_now: number;
  peak_today: number;
  peak_at: string | null;
  series: { t: number; c: number }[]; // t = epoch (s), c = ilu online w kubełku 30 min
}

// Statystyki obecności — tylko admin.
export async function fetchPresenceStats(): Promise<PresenceStats | null> {
  const res = await hubPost("presence-stats");
  return res?.ok ? (res.stats as PresenceStats) : null;
}
