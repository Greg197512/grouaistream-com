import { supabase } from "@/integrations/supabase/client";

// Klient gry „Wygraj swoją płytę" (backend na hubie GrouAI).
const GAME_URL = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/game-hub";

export interface GameState {
  ok: boolean;
  round: { id: string; title: string; ends_at: string; status: string } | null;
  players: number;
  leaderboard: { rank: number; name: string; tickets: number }[];
  me: { tickets: number; rank: number; is_winner: boolean } | null;
}

async function authToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

async function call(body: Record<string, unknown>, withAuth = true): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withAuth) {
    const t = await authToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const r = await fetch(GAME_URL, { method: "POST", headers, body: JSON.stringify(body) });
  return r.json().catch(() => null);
}

/** Stan gry: runda, czołówka, moje losy (auth opcjonalny — bez logowania widać czołówkę). */
export async function fetchGameState(): Promise<GameState> {
  const d = await call({ action: "state" }, true);
  return d ?? { ok: false, round: null, players: 0, leaderboard: [], me: null };
}

/** Dolicz losy za akcję. kind: listen | like | vote | daily. */
export async function gameVote(kind: "listen" | "like" | "vote" | "daily"): Promise<{ ok: boolean; added: number; tickets: number; error?: string; reason?: string }> {
  return call({ action: "vote", kind }, true);
}

/** Zwycięzca: zgłoś 10 utworów + nośnik + adres. */
export async function gameClaim(payload: {
  tracks: { id: string; title: string }[];
  medium: "vinyl" | "cd" | "nfc";
  ship_name: string;
  ship_address: string;
  ship_email: string;
}): Promise<{ ok: boolean; error?: string }> {
  return call({ action: "claim", ...payload }, true);
}

// ── Admin (PIN wspólny z panelami B2B) ──
export async function gameAdminList(pin: string): Promise<any> {
  return call({ action: "admin_list", pin }, false);
}
export async function gameAdminMarkShipped(pin: string, round_id: string, status: "shipped" | "submitted"): Promise<any> {
  return call({ action: "admin_mark_shipped", pin, round_id, status }, false);
}
