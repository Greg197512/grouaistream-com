// Mastering AI w przeglądarce (Web Audio) — bez serwera, bez modelu, bez kosztu.
// Łańcuch: HPF (usuwa dudnienie) → EQ (ciepło + obecność + powietrze) → kompresja
// „gluowa" → normalizacja głośności do poziomu streamingowego → limiter (brickwall).
// Efekt: utwór brzmi głośniej, pełniej i równiej — gotowy pod Spotify/YouTube.

/** Enkoder WAV 16-bit PCM (interleaved) z AudioBuffer. */
function bufferToWav(audio: AudioBuffer): Blob {
  const numCh = audio.numberOfChannels;
  const len = audio.length * numCh * 2;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF"); view.setUint32(4, 36 + len, true); writeStr(8, "WAVE");
  writeStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * numCh * 2, true); view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true); writeStr(36, "data"); view.setUint32(40, len, true);
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(audio.getChannelData(c));
  let off = 44;
  for (let i = 0; i < audio.length; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename.replace(/[\\/:*?"<>|]/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

export interface MasterOptions {
  loudness?: number;   // 0..100 — docelowa głośność (RMS)
  brightness?: number; // 0..100 — powietrze/obecność (wysokie tony)
  bass?: number;       // 0..100 — dolna półka (bas)
}

/**
 * Masteruje audio spod URL i pobiera zmasterowany WAV.
 * Dekodowanie działa jak w downloadAudioAsWav (te same adresy przechodzą CORS).
 * `opts` (0..100) sterują głośnością, jasnością i basem.
 */
export async function masterAudioToWav(url: string, filename: string, opts: MasterOptions = {}): Promise<void> {
  const loudness = opts.loudness ?? 60;
  const brightness = opts.brightness ?? 50;
  const bass = opts.bass ?? 50;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const arrayBuffer = await r.arrayBuffer();

  const decodeCtx = new AudioContext();
  const audio = await decodeCtx.decodeAudioData(arrayBuffer);
  void decodeCtx.close();

  // Zmierz RMS wejścia (co 64. próbka — szybko) do normalizacji głośności.
  let sum = 0;
  let count = 0;
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < d.length; i += 64) { sum += d[i] * d[i]; count++; }
  }
  const inputRms = Math.sqrt(sum / Math.max(1, count)) || 0.05;
  const targetRms = 0.07 + (loudness / 100) * 0.13; // 0.07..0.20
  const normGain = Math.min(5, Math.max(0.4, targetRms / inputRms));

  const lowGain = -0.5 + (bass / 100) * 5;        // -0.5..+4.5 dB
  const airGain = -0.5 + (brightness / 100) * 5;  // -0.5..+4.5 dB
  const presGain = -0.25 + (brightness / 100) * 3; // -0.25..+2.75 dB

  const ctx = new OfflineAudioContext(audio.numberOfChannels, audio.length, audio.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = audio;

  const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 30; hpf.Q.value = 0.7;
  const low = ctx.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 110; low.gain.value = lowGain;
  const pres = ctx.createBiquadFilter(); pres.type = "peaking"; pres.frequency.value = 3000; pres.Q.value = 1; pres.gain.value = presGain;
  const air = ctx.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 11000; air.gain.value = airGain;

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18; glue.knee.value = 30; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.25;

  const makeup = ctx.createGain(); makeup.gain.value = normGain;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.06;

  const out = ctx.createGain(); out.gain.value = 0.98;

  src.connect(hpf); hpf.connect(low); low.connect(pres); pres.connect(air);
  air.connect(glue); glue.connect(makeup); makeup.connect(limiter); limiter.connect(out); out.connect(ctx.destination);
  src.start(0);

  const rendered = await ctx.startRendering();
  triggerDownload(bufferToWav(rendered), filename);
}
