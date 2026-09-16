// Lekki healthcheck backendu: pinguje Supabase REST (anon, ten sam co przeglądarka)
// i zwraca zwięzły status + latencję. Służy do szybkiego sprawdzenia, czy baza żyje,
// gdy „piosenki się nie wgrywają". Bez ujawniania niczego ponad to, co widzi klient.
export const config = { runtime: "edge" };

const SUPABASE_URL = "https://bvstvawnigyczvofzhps.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";

export default async function handler(): Promise<Response> {
  const t0 = Date.now();
  const out = (code: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify({ ...body, ms: Date.now() - t0 }, null, 2), {
      status: code,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });

  // Minimalne zapytanie: policz utwory (count=exact, bez pobierania wierszy).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks?select=id&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: "count=exact" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const cr = r.headers.get("content-range") || "";
    const tracks = parseInt(cr.split("/")[1] || "-1", 10);
    if (!r.ok) {
      let body: unknown = null;
      try { body = await r.json(); } catch { /* */ }
      return out(503, { ok: false, db: "error", status: r.status, body });
    }
    return out(200, { ok: true, db: "up", tracks });
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as { name?: string })?.name === "AbortError";
    return out(503, { ok: false, db: aborted ? "timeout" : "unreachable", detail: String(e) });
  }
}
