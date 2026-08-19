import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Play, Pause, Moon, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * /nocne — Nocne czytanie z MUZYKĄ W TLE z KATALOGU.
 * Głos gra przez łańcuch Web Audio (ciało + wyrazistość + powietrze + delikatny
 * pogłos studia + kompresja), żeby brzmiał cieplej i bardziej „na żywo", a nie
 * płasko jak surowe TTS. Pod spodem cichy instrumental z katalogu (zapętlony).
 * Gdy katalog nic nie zwróci — awaryjny generatywny pad.
 */
const DEFAULT_VOICE =
  "https://bmwtydwpevzhbdplilbr.supabase.co/storage/v1/object/public/night-audio/1787099400474-nocne-czytanie.mp3";

const BED_VOLUME = 0.19;
const BED_FADE_IN = 4000;
const isHttp = (u?: string | null) => !!u && /^https?:\/\//i.test(u) && !u.includes("open.spotify.com");

interface BedTrack { title: string; artist: string; audio_url: string; }

// Cieplejszy impuls pogłosowy (dłuższy, miękki zanik) — „ciepły booth".
function makeImpulse(ctx: AudioContext, dur = 1.7, decay = 2.1): AudioBuffer {
  const rate = ctx.sampleRate, len = Math.floor(rate * dur);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Miękka saturacja (tanh) — odrobina analogowego ciepła i harmonicznych.
function softCurve(drive = 0.35): Float32Array {
  const n = 1024, c = new Float32Array(n), k = 1 + drive * 3;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
  return c;
}

export default function NightStory() {
  const [params] = useSearchParams();
  const voiceUrl = params.get("u") || DEFAULT_VOICE;
  const title = params.get("t") || "Nocne czytanie";

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bedRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const voiceReadyRef = useRef(false);
  const fadeRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [bed, setBed] = useState<BedTrack | null>(null);

  // Dobierz spokojny instrumental z katalogu na podkład.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("tracks")
          .select("title, artist, audio_url, genre, mood")
          .not("audio_url", "is", null)
          .or("genre.ilike.%ambient%,genre.ilike.%instrumental%,genre.ilike.%lo-fi%,genre.ilike.%lofi%,genre.ilike.%chill%,genre.ilike.%classical%,mood.ilike.%calm%,mood.ilike.%chill%,mood.ilike.%spok%")
          .limit(30);
        let pool = (data || []).filter((t: any) => isHttp(t.audio_url));
        if (pool.length === 0) {
          const { data: any2 } = await supabase.from("tracks").select("title, artist, audio_url").not("audio_url", "is", null).limit(40);
          pool = (any2 || []).filter((t: any) => isHttp(t.audio_url));
        }
        if (pool.length > 0) {
          const t = pool[Math.floor(Math.random() * pool.length)] as any;
          setBed({ title: t.title, artist: t.artist, audio_url: t.audio_url });
        }
      } catch { /* brak katalogu → pad awaryjny */ }
    })();
  }, []);

  const ensureCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  }, []);

  // Łańcuch „ożywiający" głos — podpinany raz.
  const setupVoice = useCallback((ctx: AudioContext) => {
    if (voiceReadyRef.current) return;
    const el = audioRef.current;
    if (!el) return;
    let src: MediaElementAudioSourceNode;
    try { src = ctx.createMediaElementSource(el); } catch { voiceReadyRef.current = true; return; }
    // Przytnij cyfrowy „syk" TTS (miękki low-pass u samej góry).
    const deFizz = ctx.createBiquadFilter(); deFizz.type = "lowpass"; deFizz.frequency.value = 11500; deFizz.Q.value = 0.5;
    // Ciało + ciepło dolnego środka.
    const body = ctx.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 190; body.Q.value = 0.8; body.gain.value = 3.5;
    const warmth = ctx.createBiquadFilter(); warmth.type = "peaking"; warmth.frequency.value = 480; warmth.Q.value = 0.7; warmth.gain.value = 1.6;
    // Wyrazistość — łagodniej, żeby nie kłuło.
    const pres = ctx.createBiquadFilter(); pres.type = "peaking"; pres.frequency.value = 2600; pres.Q.value = 0.9; pres.gain.value = 2.4;
    const air = ctx.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 9000; air.gain.value = 2;
    // Odrobina analogowego ciepła.
    const sat = ctx.createWaveShaper(); sat.curve = softCurve(0.3); sat.oversample = "4x";
    const satMix = ctx.createGain(); satMix.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 26; comp.ratio.value = 2.4; comp.attack.value = 0.006; comp.release.value = 0.25;
    const dry = ctx.createGain(); dry.gain.value = 1;
    // Ciepły, ciemny pogłos: convolver → low-pass ogona → wet.
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx);
    const wetLP = ctx.createBiquadFilter(); wetLP.type = "lowpass"; wetLP.frequency.value = 2600; wetLP.Q.value = 0.4;
    const wet = ctx.createGain(); wet.gain.value = 0.16;
    src.connect(deFizz); deFizz.connect(body); body.connect(warmth); warmth.connect(pres); pres.connect(air);
    air.connect(sat); sat.connect(satMix); satMix.connect(comp);
    comp.connect(dry); dry.connect(ctx.destination);
    comp.connect(conv); conv.connect(wetLP); wetLP.connect(wet); wet.connect(ctx.destination);
    voiceReadyRef.current = true;
  }, []);

  const fadeTo = useCallback((el: HTMLAudioElement, target: number, ms: number) => {
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const start = el.volume, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      el.volume = start + (target - start) * k;
      if (k < 1) fadeRef.current = requestAnimationFrame(step);
    };
    fadeRef.current = requestAnimationFrame(step);
  }, []);

  // Awaryjny generatywny pad (tylko gdy brak podkładu z katalogu).
  const startPad = useCallback((ctx: AudioContext) => {
    if (masterRef.current) { masterRef.current.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 3); return; }
    const master = ctx.createGain();
    master.gain.value = 0; master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 5);
    masterRef.current = master;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 640; filt.Q.value = 5; filt.connect(master);
    const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    lfo.frequency.value = 0.05; lg.gain.value = 260; lfo.connect(lg); lg.connect(filt.frequency); lfo.start();
    [110, 164.81, 220, 277.18].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = f; o.detune.value = Math.random() * 10 - 5;
      const g = ctx.createGain(); g.gain.value = 0.11;
      const amp = ctx.createOscillator(); const ag = ctx.createGain();
      amp.frequency.value = 0.06 + Math.random() * 0.06; ag.gain.value = 0.09; amp.connect(ag); ag.connect(g.gain); amp.start();
      o.connect(g); g.connect(filt); o.start();
    });
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!playing) {
      const ctx = ensureCtx();
      void ctx.resume();
      setupVoice(ctx);
      // Lekko wolniej + głębiej (preservesPitch=false) — spokojny, nocny lektor.
      a.playbackRate = 0.95;
      try {
        (a as any).preservesPitch = false;
        (a as any).mozPreservesPitch = false;
        (a as any).webkitPreservesPitch = false;
      } catch { /* brak wsparcia — trudno */ }
      const b = bedRef.current;
      if (bed && b) {
        b.loop = true; b.volume = 0;
        // Zacznij od spokojnego miejsca w utworze (nie od głośnego intro).
        b.addEventListener("loadedmetadata", () => {
          if (b.duration && isFinite(b.duration) && b.duration > 40) b.currentTime = Math.min(20, b.duration * 0.15);
        }, { once: true });
        void b.play().then(() => fadeTo(b, BED_VOLUME, BED_FADE_IN)).catch(() => startPad(ctx));
      } else {
        startPad(ctx);
      }
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      const b = bedRef.current;
      if (b) fadeTo(b, 0, 600);
      window.setTimeout(() => bedRef.current?.pause(), 650);
      const ctx = ctxRef.current, m = masterRef.current;
      if (ctx && m) m.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setPlaying(false);
    }
  }, [playing, bed, ensureCtx, setupVoice, startPad, fadeTo]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => {
      setPlaying(false);
      const b = bedRef.current;
      if (b) { fadeTo(b, 0, 3000); window.setTimeout(() => bedRef.current?.pause(), 3100); }
      const ctx = ctxRef.current, m = masterRef.current;
      if (ctx && m) m.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
    };
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("ended", onEnd); };
  }, [fadeTo]);

  useEffect(() => () => { void ctxRef.current?.close(); }, []);

  // Aurora w tle
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const x = c.getContext("2d"); if (!x) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t = 0;
    const cols = [[52, 229, 196], [176, 112, 255], [255, 122, 69]];
    const size = () => { c.width = innerWidth; c.height = innerHeight; };
    size(); addEventListener("resize", size);
    const draw = () => {
      x.clearRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "lighter";
      for (let b = 0; b < 3; b++) {
        const g = x.createLinearGradient(0, 0, c.width, 0);
        const [r, gr, bl] = cols[b];
        g.addColorStop(0, `rgba(${r},${gr},${bl},0)`);
        g.addColorStop(0.5, `rgba(${r},${gr},${bl},0.32)`);
        g.addColorStop(1, `rgba(${r},${gr},${bl},0)`);
        x.fillStyle = g; x.beginPath(); x.moveTo(0, c.height);
        for (let px = 0; px <= c.width; px += 16) {
          const ny = px / c.width;
          const y = (0.36 + b * 0.12 + Math.sin(ny * 4 + t * (0.2 + b * 0.1) + b) * 0.09) * c.height;
          x.lineTo(px, y);
        }
        x.lineTo(c.width, c.height); x.closePath(); x.fill();
      }
      x.globalCompositeOperation = "source-over";
      t += 0.01;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(120% 90% at 50% -10%, #1a1230, #09080f 70%)",
      color: "#ece9f5", overflow: "hidden", position: "relative",
      fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif",
    }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, opacity: 0.7 }} />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 540, padding: 40 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.3em", color: "#ff7a45", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Moon size={14} /> 04:17 · GROUAI STREAM
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 600, margin: "16px 0 6px", lineHeight: 1.2 }}>{title}</h1>
        <p style={{ color: "#a79fc0", fontSize: 15, marginBottom: 34 }}>Nocne czytanie z muzyką w tle</p>
        <button onClick={toggle} aria-label={playing ? "Pauza" : "Odtwarzaj"} style={{
          cursor: "pointer", border: 0, borderRadius: 999, width: 76, height: 76,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(105deg, #34e5c4, #79eaf1)", color: "#04140f",
          boxShadow: "0 14px 40px rgba(52,229,196,.4)",
        }}>
          {playing ? <Pause size={30} /> : <Play size={30} style={{ marginLeft: 3 }} />}
        </button>
        <p style={{ marginTop: 22, color: "#6f6791", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Music2 size={13} />
          {bed ? `w tle: ${bed.artist} — ${bed.title}` : "podkład generowany na żywo"}
        </p>
      </div>
      <audio ref={audioRef} src={voiceUrl} preload="auto" crossOrigin="anonymous" />
      {bed && <audio ref={bedRef} src={bed.audio_url} preload="auto" />}
    </div>
  );
}
