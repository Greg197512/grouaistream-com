// 📻 GrouAI Stream — publiczny, ciągły strumień radia dla CAŁEGO ŚWIATA.
// Liczy aktualną pozycję w rozkładzie po stronie serwera (ta sama logika co
// strona /radio-live), więc każdy słuchacz słyszy ten sam, zsynchronizowany
// program — niezależnie od urządzenia.
//
// Formaty (parametr ?f= lub ścieżka):
//   • domyślnie / playlist.m3u8  → strumień HLS (Tesla, CarPlay, Android Auto,
//     iOS/Safari natywnie, aplikacje radiowe, hls.js w przeglądarce)
//   • ?f=now                     → przekierowanie 302 do bieżącego pliku (proste odtwarzacze)
//   • ?f=info                    → JSON: co teraz leci + adresy strumienia
//   • ?f=pls / ?f=m3u            → klasyczne pliki playlist (import w autach/aplikacjach)
//
// Strumień jest ZAWSZE aktywny (24/7) — wymóg katalogów typu TuneIn i aut.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SELF = `${SUPABASE_URL}/functions/v1/radio-stream`;
const FIXED_ANCHOR = Date.parse("2020-01-01T00:00:00Z"); // gdy radio nigdy nie było włączone
const WINDOW = 6; // ile pozycji w oknie playlisty HLS

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

interface Item {
  id: string;
  item_type: string | null;
  custom_title: string | null;
  custom_duration: number | null;
  custom_audio_url: string | null;
  track: {
    title: string | null;
    artist: string | null;
    duration: number | null;
    audio_url: string | null;
    cover_url: string | null;
  } | null;
}

const isTrack = (i: Item) => (i.item_type || "track") === "track";
const dur = (i: Item) => i.track?.duration || 180;
const audioUrl = (i: Item) => i.track?.audio_url || null;
const title = (i: Item) => i.track?.title || "GrouAI Stream";
const artist = (i: Item) => i.track?.artist || "GrouAI Stream";

async function loadState() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: config } = await supabase
    .from("radio_config")
    .select("is_active, mode, started_at, station_name")
    .limit(1)
    .single();

  // Pełny rozkład (stronicowanie)
  const all: Item[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 10000; from += pageSize) {
    const { data, error } = await supabase
      .from("radio_schedule")
      .select(
        "id, item_type, custom_title, custom_duration, custom_audio_url, track:tracks(title, artist, duration, audio_url, cover_url)",
      )
      .eq("item_type", "track")
      .order("position", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) break;
    all.push(...((data || []) as unknown as Item[]));
    if (!data || data.length < pageSize) break;
  }

  // Radio ma grać wyłącznie muzykę: bez reklam, głosów, jingli i audycji.
  const playable = all.filter((i) => isTrack(i) && !!audioUrl(i));
  return { config, playable };
}

function position(playable: Item[], startedAt: string | null) {
  const N = playable.length;
  const durations = playable.map(dur);
  const total = durations.reduce((s, d) => s + d, 0);
  const anchor = startedAt ? Date.parse(startedAt) : FIXED_ANCHOR;
  const base = Number.isFinite(anchor) ? anchor : FIXED_ANCHOR;
  const elapsedTotal = (Date.now() - base) / 1000;
  const loops = Math.floor(elapsedTotal / total);
  let elapsed = elapsedTotal - loops * total;
  if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = 0;

  let cum = 0;
  let index = 0;
  let offset = 0;
  for (let i = 0; i < N; i++) {
    if (cum + durations[i] > elapsed) {
      index = i;
      offset = elapsed - cum;
      break;
    }
    cum += durations[i];
  }
  return { index, offset, loops, N, durations, total };
}

function buildM3U8(playable: Item[], startedAt: string | null): string {
  const { index, loops, N, durations } = position(playable, startedAt);
  const maxDur = Math.max(...durations, 10);
  const target = Math.min(1200, Math.ceil(maxDur) + 1);
  const mediaSeq = loops * N + index;

  const lines: string[] = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${target}`,
    `#EXT-X-MEDIA-SEQUENCE:${mediaSeq}`,
  ];

  for (let k = 0; k < Math.min(WINDOW, N); k++) {
    const idx = (index + k) % N;
    const it = playable[idx];
    const url = audioUrl(it)!;
    // Każdy utwór to osobne, niezależne kodowanie → sygnalizujemy nieciągłość.
    lines.push("#EXT-X-DISCONTINUITY");
    const label = `${title(it)} — ${artist(it)}`.replace(/[\r\n",]/g, " ").slice(0, 120);
    lines.push(`#EXTINF:${durations[idx].toFixed(3)},${label}`);
    lines.push(url);
  }

  // Brak #EXT-X-ENDLIST → playlista "na żywo", odtwarzacz dopytuje o kolejne.
  return lines.join("\n") + "\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const f = (url.searchParams.get("f") || "").toLowerCase();
  const wantsM3u8 = f === "m3u8" || f === "hls" || url.pathname.endsWith(".m3u8") || (!f && !url.pathname.endsWith(".pls") && !url.pathname.endsWith(".m3u"));

  try {
    const { config, playable } = await loadState();
    const stationName = config?.station_name || "GrouAI Stream Radio";

    if (playable.length === 0) {
      return new Response("Radio schedule is empty", {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "text/plain", "Retry-After": "60" },
      });
    }

    // ── JSON: co teraz gra + adresy ─────────────────────────────
    if (f === "info" || f === "json") {
      const { index, N } = position(playable, config?.started_at ?? null);
      const now = playable[index];
      const next = playable[(index + 1) % N];
      return new Response(
        JSON.stringify({
          station_name: stationName,
          is_active: config?.is_active ?? true,
          listeners_synced: true,
          now_playing: { title: title(now), artist: artist(now), cover_url: now.track?.cover_url || null, item_type: now.item_type || "track" },
          up_next: { title: title(next), artist: artist(next) },
          stream: {
            hls: `${SELF}?f=m3u8`,
            current_file: `${SELF}?f=now`,
            pls: `${SELF}?f=pls`,
            m3u: `${SELF}?f=m3u`,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache" } },
      );
    }

    // ── 302 do bieżącego pliku (proste odtwarzacze) ─────────────
    if (f === "now" || f === "current" || f === "mp3") {
      const { index } = position(playable, config?.started_at ?? null);
      const target = audioUrl(playable[index])!;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: target, "Cache-Control": "no-cache" },
      });
    }

    // ── Klasyczne playlisty (.pls / .m3u) wskazujące na strumień ─
    if (f === "pls") {
      const body = `[playlist]\nNumberOfEntries=1\nFile1=${SELF}?f=m3u8\nTitle1=${stationName}\nLength1=-1\nVersion=2\n`;
      return new Response(body, {
        headers: { ...corsHeaders, "Content-Type": "audio/x-scpls", "Cache-Control": "no-cache" },
      });
    }
    if (f === "m3u") {
      const body = `#EXTM3U\n#EXTINF:-1,${stationName}\n${SELF}?f=m3u8\n`;
      return new Response(body, {
        headers: { ...corsHeaders, "Content-Type": "audio/x-mpegurl", "Cache-Control": "no-cache" },
      });
    }

    // ── HLS (domyślnie) ─────────────────────────────────────────
    if (wantsM3u8) {
      const body = buildM3U8(playable, config?.started_at ?? null);
      return new Response(body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    return new Response("Not found", { status: 404, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(`radio-stream error: ${msg}`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
