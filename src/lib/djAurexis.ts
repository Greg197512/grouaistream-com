// DJ Aurexis w studiu GrouAI: gdy właściciel jest zalogowany, studio samo robi dzisiejsze 2 utwory
// (serwer /api/dj-aurexis pilnuje limitu 2/dzień i dokańcza rozpoczęte zadanie — kilka kart naraz nic nie zepsuje).
import { supabase } from "@/integrations/supabase/client";

export const DJ_OWNER = "grzegorzkaron553@gmail.com";
/** Przemek = DJ Aurexis — u niego automat też działa (utwory na jego koncie). */
export const DJ_AUREXIS_USER_ID = "38461bf5-1ba0-4ef9-985a-ae5e9d2b7f72";
export type DjTrack = { id: string; title: string; cover_url: string | null; created_at: string };
export type DjRun = { ok: boolean; step: string; tracks?: { title: string; id?: string; error?: string; cover?: string | null; audio?: string }[]; error?: string; status?: string };

export async function djStatus(): Promise<{ today: DjTrack[]; latest: DjTrack[]; perDay: number; needsCovers?: number } | null> {
  try { const r = await fetch("/api/dj-aurexis?status=1"); return r.ok ? await r.json() : null; } catch { return null; }
}

export async function djRunNow(): Promise<DjRun> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, step: "auth", error: "zaloguj się" };
  const r = await fetch("/api/dj-aurexis?run=1", { method: "POST", headers: { authorization: `Bearer ${session.access_token}` }, keepalive: false });
  return (await r.json().catch(() => ({ ok: false, step: "http", error: `HTTP ${r.status}` }))) as DjRun;
}

const dayKey = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const LS = "grouai-djaurexis-day";
/** Raz dziennie (na urządzeniu) — w tle, z ponowieniem, gdy Suno jeszcze komponuje. */
export async function djDailyTick(onDone: (r: DjRun) => void) {
  const st = await djStatus();
  const mark = `${dayKey()}:${st?.perDay ?? 2}`; // cel dnia może wzrosnąć (dodatkowe utwory) — wtedy ruszamy ponownie
  try { if (localStorage.getItem(LS) === mark && !st?.needsCovers) return; } catch { /* */ }
  if (st && st.today.length >= st.perDay && !st.needsCovers) { try { localStorage.setItem(LS, mark); } catch { /* */ } return; }
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await djRunNow();
    if (r.step === "published" || r.step === "done-today") {
      try { localStorage.setItem(LS, mark); } catch { /* */ }
      onDone(r);
      return;
    }
    if (!r.ok && r.step !== "waiting") { onDone(r); return; }
    await new Promise((res) => setTimeout(res, 90_000)); // Suno komponuje — sprawdzimy za chwilę
  }
}
