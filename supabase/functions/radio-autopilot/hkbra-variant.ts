// 🤖 Groua Radio Autopilot — autonomiczny "bot pilnujący radia".
// Hostowany na projekcie hkbra (cron co 30 min). Sam sprawdza, czy strumień żyje,
// co aktualnie gra, i zapisuje status do tabeli radio_autopilot_log (hkbra).
// Czyta publiczny strumień radio-stream (?f=info). Nie wymaga logowania.
//
// Endpointy:
//   (domyślnie / GET / cron) -> wykonuje kontrolę, loguje, zwraca JSON status
//   ?f=status                -> ostatnie 20 wpisów z logu (podgląd zdrowia radia)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;            // hkbra
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // hkbra
const STREAM = "https://hkbraboqdsonekzxbntr.supabase.co/functions/v1/radio-stream";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Podgląd ostatnich kontroli
  if ((url.searchParams.get("f") || "") === "status") {
    const { data } = await supabase
      .from("radio_autopilot_log")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(20);
    return new Response(JSON.stringify({ ok: true, recent: data || [] }), {
      headers: { ...H, "Content-Type": "application/json" },
    });
  }

  // --- Kontrola zdrowia strumienia ---
  let streamOk = false;
  let httpStatus = 0;
  let nowTitle: string | null = null;
  let nowArtist: string | null = null;
  let station: string | null = null;
  let note = "";

  try {
    const r = await fetch(`${STREAM}?f=info`, { signal: AbortSignal.timeout(20000) });
    httpStatus = r.status;
    if (r.ok) {
      const j = await r.json();
      station = j?.station_name ?? null;
      nowTitle = j?.now_playing?.title ?? null;
      nowArtist = j?.now_playing?.artist ?? null;
      streamOk = !!nowTitle;
      note = streamOk ? "stream OK" : "stream odpowiada, brak now_playing";
    } else {
      note = `stream HTTP ${httpStatus}`;
    }
  } catch (e) {
    note = "stream error: " + (e instanceof Error ? e.message : "unknown");
  }

  // Drugi sygnał: czy playlista HLS się buduje (ma segmenty)
  let hlsSegments = 0;
  try {
    const m = await fetch(`${STREAM}?f=m3u8`, { signal: AbortSignal.timeout(20000) });
    if (m.ok) {
      const body = await m.text();
      hlsSegments = (body.match(/#EXTINF/g) || []).length;
    }
  } catch { /* ignore */ }

  const healthy = streamOk && hlsSegments > 0;

  // Zapis heartbeat do logu (hkbra)
  await supabase.from("radio_autopilot_log").insert({
    stream_ok: healthy,
    http_status: httpStatus,
    hls_segments: hlsSegments,
    station_name: station,
    now_title: nowTitle,
    now_artist: nowArtist,
    note,
  });

  // Sprzątanie: trzymaj log lekki (ostatnie ~500 wpisów)
  try {
    const { data: old } = await supabase
      .from("radio_autopilot_log")
      .select("id")
      .order("checked_at", { ascending: false })
      .range(500, 500);
    if (old && old.length) {
      await supabase
        .from("radio_autopilot_log")
        .delete()
        .lt("checked_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString());
    }
  } catch { /* ignore */ }

  return new Response(
    JSON.stringify({
      ok: true,
      healthy,
      station_name: station,
      now_playing: { title: nowTitle, artist: nowArtist },
      hls_segments: hlsSegments,
      http_status: httpStatus,
      note,
      checked_at: new Date().toISOString(),
    }),
    { headers: { ...H, "Content-Type": "application/json" } },
  );
});
