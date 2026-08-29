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

// ── Opowiadania: osobna szuflada od muzyki, grana o stałych porach ──
// (czas polski, niezależnie od strefy serwera). Poza tym oknem radio
// gra normalną rotację muzyki jak dotychczas.
const STORY_SLOTS: { key: "morning_kids" | "evening_horror"; startSec: number }[] = [
  { key: "morning_kids", startSec: 8 * 3600 },   // 08:00 — dla dzieci
  { key: "evening_horror", startSec: 21 * 3600 }, // 21:00 — horror na wieczór
];

function warsawNow(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value])) as Record<string, string>;
  const secondsOfDay = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
  const dayIndex = Math.floor(Date.parse(`${p.year}-${p.month}-${p.day}T00:00:00Z`) / 86400000);
  return { secondsOfDay, dayIndex };
}

interface StoryRow {
  id: string;
  slot: string;
  title: string;
  audio_url: string;
  duration_sec: number | null;
}

async function loadStoryOverride(supabase: ReturnType<typeof createClient>) {
  const { secondsOfDay, dayIndex } = warsawNow();
  for (const slot of STORY_SLOTS) {
    const dur0 = 60 * 60; // zakładany max czas trwania przed sprawdzeniem realnego duration_sec
    if (secondsOfDay < slot.startSec || secondsOfDay >= slot.startSec + dur0) continue;

    const { data: stories } = await supabase
      .from("radio_story_slots")
      .select("id, slot, title, audio_url, duration_sec")
      .eq("slot", slot.key)
      .eq("is_active", true)
      .order("id", { ascending: true });

    const rows = (stories || []) as StoryRow[];
    if (!rows.length) continue;

    // Ten sam dzień = ta sama historia dla wszystkich słuchaczy (rotacja po dniach).
    const story = rows[dayIndex % rows.length];
    const dur = story.duration_sec || 600;
    const offset = secondsOfDay - slot.startSec;
    if (offset < 0 || offset >= dur) continue;

    return { story, slotKey: slot.key, offset, remaining: dur - offset, dur };
  }
  return null;
}

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
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { config, playable } = await loadState();
    const stationName = config?.station_name || "GrouAI Stream Radio";
    const storyOverride = await loadStoryOverride(supabase).catch(() => null);

    if (playable.length === 0 && !storyOverride) {
      return new Response("Radio schedule is empty", {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "text/plain", "Retry-After": "60" },
      });
    }

    // ── JSON: co teraz gra + adresy ─────────────────────────────
    if (f === "info" || f === "json") {
      if (storyOverride) {
        const label = storyOverride.slotKey === "evening_horror" ? "Opowiadania na dobranoc (horror)" : "Poranne opowiadania dla dzieci";
        return new Response(
          JSON.stringify({
            station_name: stationName,
            is_active: config?.is_active ?? true,
            listeners_synced: true,
            now_playing: { title: storyOverride.story.title, artist: label, cover_url: null, item_type: "story" },
            up_next: { title: "Powrót do muzyki", artist: stationName },
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
      if (storyOverride) {
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: storyOverride.story.audio_url, "Cache-Control": "no-cache" },
        });
      }
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
      if (storyOverride) {
        const seq = storyOverride.dur > 0 ? Math.floor(Date.now() / (storyOverride.dur * 1000)) : 0;
        const label = storyOverride.story.title.replace(/[\r\n",]/g, " ").slice(0, 120);
        const body = [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          `#EXT-X-TARGETDURATION:${Math.ceil(storyOverride.dur) + 1}`,
          `#EXT-X-MEDIA-SEQUENCE:${seq}`,
          "#EXT-X-DISCONTINUITY",
          `#EXTINF:${storyOverride.dur.toFixed(3)},${label}`,
          storyOverride.story.audio_url,
        ].join("\n") + "\n";
        return new Response(body, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }
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
