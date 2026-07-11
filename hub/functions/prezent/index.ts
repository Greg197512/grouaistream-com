// GROUAI HUB — prezent: strona-prezent do udostępniania utworu (jak Suno share, ale z „wow").
// Link grouaistream.com/prezent/<trackId> -> ta funkcja zwraca HTML z OG (podgląd w
// WhatsApp/X) + animacją: paczka z kokardą „GrouAI Studio" -> wir -> rozwija się
// piosenka z grafiką i playerem. Publiczne (verify_jwt=false).
const BVSTV = "https://bvstvawnigyczvofzhps.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3R2YXduaWd5Y3p2b2Z6aHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDEwMzEsImV4cCI6MjA4NDMxNzAzMX0.Mp6lpKIcFGsduODIwm1V7FcRQmaN5DtPM5aaqj9i_Xw";

const esc = (s: string) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // id z ?t=... albo z ostatniego segmentu ścieżki /prezent/<id>
  let id = url.searchParams.get("t") || "";
  if (!id) {
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[parts.length - 1] || "";
  }

  let track: any = null;
  if (id && id !== "prezent") {
    try {
      const r = await fetch(
        `${BVSTV}/rest/v1/tracks?id=eq.${encodeURIComponent(id)}&select=title,artist,cover_url,audio_url,video_url,genre&limit=1`,
        { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
      );
      const rows = await r.json();
      track = Array.isArray(rows) ? rows[0] : null;
    } catch { /* ignore */ }
  }

  const title = track?.title || "Prezent od GrouAI Studio";
  const artist = track?.artist || "GrouAI Stream";
  const cover = track?.cover_url || "https://grouaistream.com/og-image.jpg";
  const audio = track?.audio_url || "";
  const video = track?.video_url || "";
  const desc = `🎁 ${artist} przysyła Ci utwór „${title}" — otwórz prezent w GrouAI Studio.`;
  const pageUrl = `https://grouaistream.com/prezent/${esc(id)}`;

  const html = `<!doctype html><html lang="pl"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<title>${esc(title)} — prezent GrouAI Studio</title>
<meta name="description" content="${esc(desc)}"/>
<meta property="og:type" content="music.song"/>
<meta property="og:title" content="🎁 ${esc(title)} — ${esc(artist)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:image" content="${esc(cover)}"/>
<meta property="og:url" content="${pageUrl}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="🎁 ${esc(title)} — ${esc(artist)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${esc(cover)}"/>
<link rel="icon" href="https://grouaistream.com/favicon.png"/>
<style>
:root{--o:#FF6B00;--p:#9333EA;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:radial-gradient(1200px 800px at 50% -10%,#241033 0%,#0b0714 55%,#060409 100%);color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden;display:grid;place-items:center;min-height:100dvh}
.aurora{position:fixed;inset:-20%;background:conic-gradient(from 0deg,transparent,rgba(255,107,0,.10),transparent,rgba(147,51,234,.12),transparent);filter:blur(60px);animation:spin 22s linear infinite;pointer-events:none}
@keyframes spin{to{transform:rotate(360deg)}}
.wrap{position:relative;z-index:2;text-align:center;padding:24px;width:min(560px,92vw)}
/* PACZKA */
.gift{cursor:pointer;display:inline-block;transition:transform .2s}
.gift:active{transform:scale(.96)}
.box{width:180px;height:150px;margin:0 auto;position:relative;filter:drop-shadow(0 20px 40px rgba(147,51,234,.45))}
.lid{position:absolute;top:0;left:-6px;width:192px;height:44px;border-radius:8px;background:linear-gradient(135deg,var(--o),#ff9500);z-index:3;transition:transform .5s cubic-bezier(.5,-.4,.5,1.4)}
.base{position:absolute;bottom:0;width:180px;height:120px;border-radius:8px;background:linear-gradient(135deg,#2a1550,#4a2483);overflow:hidden}
.base:after{content:"";position:absolute;left:50%;top:0;width:26px;height:100%;transform:translateX(-50%);background:linear-gradient(var(--o),#ff9500)}
.lid:after{content:"";position:absolute;left:50%;top:0;width:26px;height:100%;transform:translateX(-50%);background:linear-gradient(#ffb055,#ff7a00)}
.bow{position:absolute;top:-26px;left:50%;transform:translateX(-50%);z-index:4;font-size:40px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
.brand{margin-top:18px;font-weight:800;letter-spacing:.14em;background:linear-gradient(90deg,var(--o),var(--p));-webkit-background-clip:text;background-clip:text;color:transparent;font-size:15px}
.hint{margin-top:8px;color:#ffffff88;font-size:13px}
.pulse{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
/* WIR */
.vortex{position:fixed;inset:0;z-index:5;display:grid;place-items:center;opacity:0;pointer-events:none}
.vortex .swirl{width:60px;height:60px;border-radius:50%;background:conic-gradient(var(--o),var(--p),var(--o));filter:blur(2px)}
/* REVEAL */
.reveal{opacity:0;transform:scale(.8);transition:opacity .6s,transform .6s;display:none}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:18px;backdrop-filter:blur(12px);box-shadow:0 0 50px rgba(147,51,234,.25)}
.cover{width:100%;max-width:340px;aspect-ratio:1;object-fit:cover;border-radius:16px;margin:0 auto;display:block;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.vid{width:100%;max-width:420px;border-radius:16px;margin:0 auto;display:block}
h1{font-size:20px;margin:14px 4px 2px}
.by{color:#ffffffaa;font-size:14px;margin-bottom:12px}
audio{width:100%;margin-top:6px}
.cta{display:inline-block;margin-top:16px;padding:11px 22px;border-radius:999px;font-weight:800;color:#fff;text-decoration:none;background:linear-gradient(135deg,var(--o),var(--p));box-shadow:0 8px 24px rgba(255,107,0,.35)}
.foot{margin-top:14px;font-size:11px;color:#ffffff55}
.hidden{display:none!important}
</style></head>
<body>
<div class="aurora"></div>
<div class="wrap">
  <div id="gift" class="gift pulse" onclick="openGift()">
    <div class="box">
      <div class="bow">🎀</div>
      <div class="lid" id="lid"></div>
      <div class="base"></div>
    </div>
    <div class="brand">GROUAI&nbsp;STUDIO</div>
    <div class="hint">Masz prezent — kliknij, aby otworzyć 🎁</div>
  </div>

  <div id="reveal" class="reveal">
    <div class="card">
      ${video
        ? `<video class="vid" src="${esc(video)}" controls playsinline poster="${esc(cover)}"></video>`
        : `<img class="cover" src="${esc(cover)}" alt="${esc(title)}"/>`}
      <h1>${esc(title)}</h1>
      <div class="by">${esc(artist)} · GrouAI Stream</div>
      ${audio ? `<audio id="au" src="${esc(audio)}" controls></audio>` : ""}
      <a class="cta" href="https://grouaistream.com" target="_blank" rel="noopener">Odkryj więcej w GrouAI Stream →</a>
      <div class="foot">Stworzone w GrouAI Studio 🎧</div>
    </div>
  </div>
</div>
<div id="vortex" class="vortex"><div class="swirl"></div></div>

<script>
function openGift(){
  var gift=document.getElementById('gift'),lid=document.getElementById('lid'),vx=document.getElementById('vortex'),rv=document.getElementById('reveal');
  gift.classList.remove('pulse');
  lid.style.transform='translateY(-90px) rotate(14deg)';
  // paczka kręci się i wpada w wir
  gift.style.transition='transform .9s cubic-bezier(.6,.1,.3,1),opacity .6s';
  gift.style.transform='rotate(720deg) scale(.05)';gift.style.opacity='0';
  vx.style.transition='opacity .3s';vx.style.opacity='1';
  var sw=vx.querySelector('.swirl');sw.animate([{transform:'scale(.4) rotate(0)'},{transform:'scale(18) rotate(900deg)'}],{duration:900,easing:'cubic-bezier(.5,0,.5,1)'});
  setTimeout(function(){
    gift.classList.add('hidden');vx.style.opacity='0';
    rv.style.display='block';requestAnimationFrame(function(){rv.style.opacity='1';rv.style.transform='scale(1)';});
    var au=document.getElementById('au');if(au){au.play().catch(function(){});}
    var vd=rv.querySelector('video');if(vd){vd.play().catch(function(){});}
  },950);
}
</script>
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
