// Diagnostyczny, TYLKO-ODCZYT endpoint: zwraca ostatnie utwory (opcjonalnie
// filtr po wykonawcy). Używa publicznego klucza anon (ten sam, co przeglądarka),
// więc nie odsłania niczego, czego klient już nie czyta. Służy do weryfikacji
// hostingu audio_url (R2 / Suno / Supabase Storage) i szybkiego podglądu.
export const config = { runtime: "edge" };

const SUPABASE_URL = "https://bvstvawnigyczvofzhps.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";

function hostOf(u: string | null): string {
  if (!u) return "—";
  try { return new URL(u).host; } catch { return "?"; }
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const artist = url.searchParams.get("artist");
  const limit = Math.min(Number(url.searchParams.get("limit") || 12), 50);

  const params = new URLSearchParams();
  params.set("select", "id,title,artist,created_at,duration,audio_url,video_url");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));
  if (artist) params.set("artist", `ilike.*${artist}*`);

  const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks?${params.toString()}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const status = r.status;
  let rows: unknown[] = [];
  try { rows = await r.json(); } catch { /* */ }

  const summary = Array.isArray(rows)
    ? rows.map((t) => {
        const row = t as Record<string, unknown>;
        return {
          title: row.title,
          artist: row.artist,
          created_at: row.created_at,
          duration: row.duration,
          audio_host: hostOf(row.audio_url as string | null),
          video_host: hostOf(row.video_url as string | null),
          audio_url: row.audio_url,
          video_url: row.video_url,
        };
      })
    : rows;

  return new Response(JSON.stringify({ status, count: Array.isArray(rows) ? rows.length : 0, rows: summary }, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
}
