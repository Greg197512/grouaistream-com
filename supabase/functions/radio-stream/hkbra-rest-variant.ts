// 📻 GrouAI Stream — publiczny strumień radia (wariant hostowany na projekcie hkbra).
// Czyta rozkład/utwory z projektu LIVE (bvstv) przez publiczne REST API (anon),
// więc działa niezależnie od wdrożeń Lovable. Buduje strumień HLS dla aut/aplikacji.
//
// RAMÓWKA TYGODNIOWA (2026-07-07): każdy dzień tygodnia gra inny gatunek/gatunki.
// Filtruje bibliotekę `tracks` z bvstv po gatunkach przypisanych do dnia i buduje
// z nich dzienną playlistę (pętla przez całą dobę, reset o północy Europe/Warsaw).
// Jeśli danego dnia gatunki nie mają utworów → fallback do ręcznej kolejki
// radio_schedule (stare zachowanie), żeby radio nigdy nie zamilkło.
const BV = "https://bvstvawnigyczvofzhps.supabase.co/rest/v1";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";
const SELF = "https://hkbraboqdsonekzxbntr.supabase.co/functions/v1/radio-stream";
const FIXED_ANCHOR = Date.parse("2020-01-01T00:00:00Z");
const WINDOW = 6;
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

// Ramówka tygodniowa: dzień tygodnia (0=niedziela … 6=sobota) → lista gatunków.
// Gatunki muszą zgadzać się z polem tracks.genre. Kolejność = priorytet.
const WEEKLY_GENRES = {
  0: ["Folk", "Country", "Jazz", "Classical", "Ambient", "Lo-fi", "Acoustic"], // Niedziela — spokojnie
  1: ["Rock", "Metal", "Punk"],                                                 // Poniedziałek — mocniej
  2: ["Pop"],                                                                    // Wtorek — pop
  3: ["Hip-Hop", "Trap", "R&B"],                                                 // Środa — hip-hop
  4: ["Alternative", "Indie"],                                                   // Czwartek — alternatywa
  5: ["Electronic", "EDM", "House", "Trance", "Disco"],                          // Piątek — impreza
  6: ["Alternative", "Rock", "Pop"],                                             // Sobota — energiczny miks
};
const DAY_LABELS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

function isTrack(i) { return (i.item_type || "track") === "track"; }
function dur(i) { return isTrack(i) ? ((i.track && i.track.duration) || 180) : (i.custom_duration || 30); }
function audioUrl(i) { return isTrack(i) ? ((i.track && i.track.audio_url) || null) : (i.custom_audio_url || null); }
function title(i) { return isTrack(i) ? ((i.track && i.track.title) || "GrouAI Stream") : (i.custom_title || i.item_type || "GrouAI Stream"); }
function artist(i) { return isTrack(i) ? ((i.track && i.track.artist) || "GrouAI Stream") : "GrouAI Stream"; }
// HLS (auta/aplikacje) obsługuje tylko mp3/aac/m4a/mp4 — WAV/FLAC/OGG psują strumień.
function hlsSafe(u) { return !!u && /\.(mp3|aac|m4a|mp4|ts|m4s)(\?|$)/i.test(u); }

async function rest(path) {
  const r = await fetch(BV + path, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
  if (!r.ok) throw new Error("bvstv " + r.status);
  return await r.json();
}

// Bieżący dzień tygodnia i północ w strefie Europe/Warsaw (serwer działa w UTC).
function warsawDay() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw", weekday: "short", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday];
  // Sekundy od lokalnej północy → timestamp UTC lokalnej północy = now - sekundy dzisiejsze.
  const secToday = (parseInt(map.hour, 10) * 3600) + (parseInt(map.minute, 10) * 60) + parseInt(map.second, 10);
  const midnight = new Date(now.getTime() - secToday * 1000);
  return { dow: wd, midnightIso: midnight.toISOString() };
}

// Pobierz z bvstv utwory pasujące do listy gatunków (dla ramówki dnia).
async function loadGenreTracks(genres) {
  if (!genres || !genres.length) return [];
  const inList = "(" + genres.map(function (g) { return '"' + g.replace(/"/g, "") + '"'; }).join(",") + ")";
  const sel = "id,title,artist,duration,audio_url,cover_url,genre";
  const rows = await rest("/tracks?select=" + encodeURIComponent(sel) +
    "&genre=in." + encodeURIComponent(inList) +
    "&audio_url=not.is.null&order=id.asc&limit=1000");
  // Owiń w kształt zgodny z resztą kodu (item_type track + zagnieżdżony track).
  return (rows || []).map(function (t) {
    return { id: t.id, item_type: "track", track: t };
  });
}

async function loadState() {
  let config = null;
  try { const c = await rest("/radio_config?select=is_active,mode,started_at,station_name&limit=1"); config = (c && c[0]) || null; } catch (e) { /* ignore */ }

  const day = warsawDay();
  const genres = WEEKLY_GENRES[day.dow] || [];

  // 1) Spróbuj ramówki tygodniowej (gatunek dnia).
  let weekly = [];
  try { weekly = await loadGenreTracks(genres); } catch (e) { weekly = []; }
  let weeklyPlayable = weekly.filter(function (i) { return hlsSafe(audioUrl(i)); });
  if (weeklyPlayable.length) {
    return {
      config: config, playable: weeklyPlayable, mode: "weekly",
      dayLabel: DAY_LABELS[day.dow], genres: genres, anchor: day.midnightIso,
    };
  }

  // 2) Fallback — ręczna kolejka radio_schedule (stare zachowanie).
  const all = [];
  const sel = "id,item_type,custom_title,custom_duration,custom_audio_url,track:tracks(title,artist,duration,audio_url,cover_url)";
  for (let off = 0; off < 10000; off += 1000) {
    let page;
    try { page = await rest("/radio_schedule?select=" + encodeURIComponent(sel) + "&order=position.asc&limit=1000&offset=" + off); } catch (e) { break; }
    all.push.apply(all, page || []);
    if (!page || page.length < 1000) break;
  }
  let playable = all.filter(function (i) { return hlsSafe(audioUrl(i)); });
  if (!playable.length) playable = all.filter(function (i) { return !!audioUrl(i); });
  return {
    config: config, playable: playable, mode: "queue",
    dayLabel: DAY_LABELS[day.dow], genres: genres, anchor: (config && config.started_at) || null,
  };
}

function position(playable, startedAt) {
  const N = playable.length;
  const durations = playable.map(dur);
  const total = durations.reduce(function (s, d) { return s + d; }, 0);
  const anchor = startedAt ? Date.parse(startedAt) : FIXED_ANCHOR;
  const base = isFinite(anchor) ? anchor : FIXED_ANCHOR;
  const elapsedTotal = (Date.now() - base) / 1000;
  const loops = Math.floor(elapsedTotal / total);
  let elapsed = elapsedTotal - loops * total;
  if (!isFinite(elapsed) || elapsed < 0) elapsed = 0;
  let cum = 0, index = 0, offset = 0;
  for (let i = 0; i < N; i++) { if (cum + durations[i] > elapsed) { index = i; offset = elapsed - cum; break; } cum += durations[i]; }
  return { index: index, offset: offset, loops: loops, N: N, durations: durations, total: total };
}

function buildM3U8(playable, startedAt) {
  const p = position(playable, startedAt);
  let maxDur = 10; for (const d of p.durations) if (d > maxDur) maxDur = d;
  const target = Math.min(1200, Math.ceil(maxDur) + 1);
  const mediaSeq = p.loops * p.N + p.index;
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:" + target, "#EXT-X-MEDIA-SEQUENCE:" + mediaSeq];
  for (let k = 0; k < Math.min(WINDOW, p.N); k++) {
    const idx = (p.index + k) % p.N;
    const it = playable[idx];
    lines.push("#EXT-X-DISCONTINUITY");
    const label = (title(it) + " - " + artist(it)).replace(/[\r\n",]/g, " ").slice(0, 120);
    lines.push("#EXTINF:" + p.durations[idx].toFixed(3) + "," + label);
    lines.push(audioUrl(it));
  }
  return lines.join("\n") + "\n";
}

Deno.serve(async function (req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  const url = new URL(req.url);
  const f = (url.searchParams.get("f") || "").toLowerCase();
  try {
    const st = await loadState();
    // Nazwa publicznego radia (strumień, auta, odtwarzacz). Ustawiona na życzenie.
    const station = "Groua Radio";
    const playable = st.playable;
    if (!playable.length) return new Response("Radio schedule is empty", { status: 503, headers: Object.assign({}, H, { "Content-Type": "text/plain", "Retry-After": "60" }) });
    const startedAt = st.anchor;

    if (f === "info" || f === "json") {
      const p = position(playable, startedAt);
      const now = playable[p.index]; const next = playable[(p.index + 1) % p.N];
      const body = JSON.stringify({
        station_name: station, is_active: (st.config && st.config.is_active) !== false, listeners_synced: true,
        schedule_mode: st.mode, day: st.dayLabel, day_genres: st.genres,
        now_playing: { title: title(now), artist: artist(now), cover_url: (now.track && now.track.cover_url) || null, item_type: now.item_type || "track" },
        up_next: { title: title(next), artist: artist(next) },
        stream: { hls: SELF + "?f=m3u8", current_file: SELF + "?f=now", pls: SELF + "?f=pls", m3u: SELF + "?f=m3u" },
      });
      return new Response(body, { headers: Object.assign({}, H, { "Content-Type": "application/json", "Cache-Control": "no-cache" }) });
    }
    if (f === "now" || f === "current" || f === "mp3") {
      const p = position(playable, startedAt);
      return new Response(null, { status: 302, headers: Object.assign({}, H, { Location: audioUrl(playable[p.index]), "Cache-Control": "no-cache" }) });
    }
    if (f === "pls") {
      const body = "[playlist]\nNumberOfEntries=1\nFile1=" + SELF + "?f=m3u8\nTitle1=" + station + "\nLength1=-1\nVersion=2\n";
      return new Response(body, { headers: Object.assign({}, H, { "Content-Type": "audio/x-scpls" }) });
    }
    if (f === "m3u") {
      const body = "#EXTM3U\n#EXTINF:-1," + station + "\n" + SELF + "?f=m3u8\n";
      return new Response(body, { headers: Object.assign({}, H, { "Content-Type": "audio/x-mpegurl" }) });
    }
    const body = buildM3U8(playable, startedAt);
    return new Response(body, { headers: Object.assign({}, H, { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-cache, no-store, must-revalidate" }) });
  } catch (e) {
    return new Response("radio-stream error: " + ((e && e.message) || e), { status: 500, headers: Object.assign({}, H, { "Content-Type": "text/plain" }) });
  }
});
