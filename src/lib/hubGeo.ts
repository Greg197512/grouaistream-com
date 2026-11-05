
// Geo i obecność działały na hubie GrouAI (bmwtydwpevzhbdplilbr), który już nie istnieje.
// Bez zapytań w eter (wcześniej każdy zalogowany co 60 s wysyłał nieudany ping) — panele admina pokazują pusto.
async function hubPost(_path: string, _body: Record<string, unknown> = {}): Promise<any> {
  return { ok: false, error: "hub-offline" };
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
  // Hub nie istnieje — brak bicia serca (nie budzimy telefonu co minutę na darmo).
  presenceTimer = 0;
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
