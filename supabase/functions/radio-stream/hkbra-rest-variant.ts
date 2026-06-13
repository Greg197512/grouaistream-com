// 📻 GrouAI Stream — publiczny strumień radia (wariant hostowany na projekcie hkbra).
// Czyta rozkład/utwory z projektu LIVE (bvstv) przez publiczne REST API (anon),
// więc działa niezależnie od wdrożeń Lovable. Buduje strumień HLS dla aut/aplikacji.
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

async function loadState() {
  let config = null;
  try { const c = await rest("/radio_config?select=is_active,mode,started_at,station_name&limit=1"); config = (c && c[0]) || null; } catch (e) { /* ignore */ }
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
  return { config: config, playable: playable };
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
    const station = (st.config && st.config.station_name) || "GrouAI Stream Radio";
    const playable = st.playable;
    if (!playable.length) return new Response("Radio schedule is empty", { status: 503, headers: Object.assign({}, H, { "Content-Type": "text/plain", "Retry-After": "60" }) });
    const startedAt = (st.config && st.config.started_at) || null;

    if (f === "info" || f === "json") {
      const p = position(playable, startedAt);
      const now = playable[p.index]; const next = playable[(p.index + 1) % p.N];
      const body = JSON.stringify({
        station_name: station, is_active: (st.config && st.config.is_active) !== false, listeners_synced: true,
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
