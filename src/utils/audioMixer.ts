/**
 * AudioMixer — Mixes two audio files into one using Web Audio API.
 * Supports crossfade, overlay, and beat-sync styles.
 */

export type MixStyle = "crossfade" | "overlay" | "mashup" | "mashup_pro";

export interface MixConfig {
  style?: MixStyle;
  crossfadeDuration?: number; // seconds
  outputDuration?: number; // 0 = auto (length of longer track)
  gainA?: number; // 0-1
  gainB?: number; // 0-1
}

export interface MixResult {
  audioUrl: string;
  duration: number;
  title: string;
}

const audioCtxCache = { ctx: null as AudioContext | null };
const getAudioContext = (): AudioContext => {
  if (!audioCtxCache.ctx || audioCtxCache.ctx.state === "closed") {
    audioCtxCache.ctx = new AudioContext({ sampleRate: 44100 });
  }
  return audioCtxCache.ctx;
};

async function fetchAudioBuffer(url: string): Promise<AudioBuffer> {
  const resp = await fetch(url);
  const arrayBuffer = await resp.arrayBuffer();
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

function applyFadeIn(buffer: Float32Array, sampleRate: number, fadeDuration: number) {
  const fadeSamples = Math.min(Math.floor(fadeDuration * sampleRate), buffer.length);
  for (let i = 0; i < fadeSamples; i++) {
    buffer[i] *= i / fadeSamples;
  }
}

function applyFadeOut(buffer: Float32Array, sampleRate: number, fadeDuration: number) {
  const fadeSamples = Math.min(Math.floor(fadeDuration * sampleRate), buffer.length);
  const start = buffer.length - fadeSamples;
  for (let i = 0; i < fadeSamples; i++) {
    buffer[start + i] *= 1 - i / fadeSamples;
  }
}

/**
 * Szacowanie BPM z obwiedni energii (onset) + autokorelacja.
 * Zwraca 0 gdy niepewne. Wystarczające do beatmatchingu (delikatny nudge tempa).
 */
export function detectBPM(buffer: AudioBuffer): number {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const win = Math.max(1, Math.floor(sr * 0.01)); // 10 ms okno
  const env: number[] = [];
  for (let i = 0; i + win < data.length; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) { const v = data[i + j]; s += v * v; }
    env.push(Math.sqrt(s / win));
  }
  const onset: number[] = [];
  for (let i = 1; i < env.length; i++) onset.push(Math.max(0, env[i] - env[i - 1]));
  if (onset.length < 20) return 0;
  const envRate = sr / win; // klatki/s (~100)
  let bestBpm = 0, bestCorr = 0;
  for (let bpm = 70; bpm <= 180; bpm++) {
    const lag = Math.round((envRate * 60) / bpm);
    if (lag < 1 || lag >= onset.length) continue;
    let corr = 0;
    for (let i = 0; i + lag < onset.length; i++) corr += onset[i] * onset[i + lag];
    if (corr > bestCorr) { bestCorr = corr; bestBpm = bpm; }
  }
  return bestBpm;
}

// Perceived loudness (RMS) — do wyrównania głośności obu utworów przed miksem.
function rmsOf(buffer: AudioBuffer): number {
  const ch = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(ch.length / 100000));
  let s = 0, n = 0;
  for (let i = 0; i < ch.length; i += step) { s += ch[i] * ch[i]; n++; }
  return n ? Math.sqrt(s / n) : 0;
}

// Krzywa równomocna (equal-power) — płynny crossfade bez zapadnięcia głośności.
function equalPowerCurve(fadeIn: boolean, points = 64): Float32Array {
  const c = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    c[i] = fadeIn ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2);
  }
  return c;
}

export async function mixAudioFiles(
  urlA: string,
  urlB: string,
  config: MixConfig = {}
): Promise<MixResult> {
  const {
    style = "crossfade",
    crossfadeDuration = 4,
    gainA = 0.85,
    gainB = 0.85,
  } = config;

  const [bufferA, bufferB] = await Promise.all([
    fetchAudioBuffer(urlA),
    fetchAudioBuffer(urlB),
  ]);

  const sampleRate = bufferA.sampleRate;
  const channels = Math.max(bufferA.numberOfChannels, bufferB.numberOfChannels);

  // ── BEATMATCH: dopasuj tempo B do A (delikatny nudge, żeby uderzenia się zeszły) ──
  const bpmA = detectBPM(bufferA);
  const bpmB = detectBPM(bufferB);
  let rateB = 1;
  if (bpmA > 0 && bpmB > 0) {
    let r = bpmA / bpmB;
    while (r > 1.4) r /= 2;   // oktawy tempa (np. 140 vs 70)
    while (r < 0.7) r *= 2;
    // stosuj tylko gdy blisko 1 (unikamy słyszalnego przesuwu wysokości)
    rateB = r >= 0.88 && r <= 1.14 ? r : 1;
  }
  const bLenSamples = Math.floor(bufferB.length / rateB); // efektywna długość B po zmianie tempa

  // ── LOUDNESS MATCH: wyrównaj głośność (RMS) obu, żeby żaden nie dominował ──
  const rmsA = rmsOf(bufferA), rmsB = rmsOf(bufferB);
  const target = 0.18;
  const gA = Math.min(1.2, gainA * (rmsA > 0.002 ? target / rmsA : 1));
  const gB = Math.min(1.2, gainB * (rmsB > 0.002 ? target / rmsB : 1));

  let outputLength: number;
  const cfSamples = Math.floor(crossfadeDuration * sampleRate);

  if (style === "crossfade") {
    outputLength = bufferA.length + bLenSamples - cfSamples;
  } else {
    outputLength = Math.max(bufferA.length, bLenSamples);
  }
  outputLength = Math.max(outputLength, sampleRate); // min 1 s bezpiecznie

  const offlineCtx = new OfflineAudioContext(channels, outputLength, sampleRate);

  // Master: kompresor „klejący" + miękki limiter chroniący przed przesterem.
  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-14, 0);
  comp.knee.setValueAtTime(24, 0);
  comp.ratio.setValueAtTime(3, 0);
  comp.attack.setValueAtTime(0.005, 0);
  comp.release.setValueAtTime(0.18, 0);
  const master = offlineCtx.createGain();
  master.gain.setValueAtTime(0.95, 0);
  comp.connect(master).connect(offlineCtx.destination);

  if (style === "crossfade") {
    const sourceA = offlineCtx.createBufferSource();
    sourceA.buffer = bufferA;
    const gainNodeA = offlineCtx.createGain();
    gainNodeA.gain.setValueAtTime(gainA, 0);
    // Start crossfade wyrównany do siatki beatu A (na uderzeniu — brzmi jak DJ).
    let fadeOutStart = (bufferA.length - cfSamples) / sampleRate;
    if (bpmA > 0) {
      const beat = 60 / bpmA;
      fadeOutStart = Math.max(0, Math.round(fadeOutStart / beat) * beat);
    }
    gainNodeA.gain.setValueCurveAtTime(
      equalPowerCurve(false).map((v) => v * gA) as unknown as Float32Array,
      fadeOutStart, crossfadeDuration,
    );
    // EQ carving: w trakcie wyjścia A wycinamy jego bas (highpass 20→240 Hz),
    // żeby bas B wszedł czysto — koniec „muła" nakładających się dołów.
    const hpA = offlineCtx.createBiquadFilter();
    hpA.type = "highpass";
    hpA.frequency.setValueAtTime(20, 0);
    hpA.frequency.setValueAtTime(20, fadeOutStart);
    hpA.frequency.linearRampToValueAtTime(240, fadeOutStart + crossfadeDuration);
    sourceA.connect(gainNodeA).connect(hpA).connect(comp);
    sourceA.start(0);

    const sourceB = offlineCtx.createBufferSource();
    sourceB.buffer = bufferB;
    sourceB.playbackRate.value = rateB;
    const gainNodeB = offlineCtx.createGain();
    const bStartTime = fadeOutStart;
    gainNodeB.gain.setValueCurveAtTime(
      equalPowerCurve(true).map((v) => v * gB) as unknown as Float32Array,
      bStartTime, crossfadeDuration,
    );
    sourceB.connect(gainNodeB).connect(comp);
    sourceB.start(bStartTime);
  } else {
    // Overlay / Mashup — oba od 0, z beatmatchem + panoramą.
    const sourceA = offlineCtx.createBufferSource();
    sourceA.buffer = bufferA;
    const gainNodeA = offlineCtx.createGain();
    gainNodeA.gain.setValueAtTime(style === "mashup" ? gA * 0.72 : gA, 0);

    const sourceB = offlineCtx.createBufferSource();
    sourceB.buffer = bufferB;
    sourceB.playbackRate.value = rateB;
    const gainNodeB = offlineCtx.createGain();
    gainNodeB.gain.setValueAtTime(style === "mashup" ? gB * 0.72 : gB, 0);

    if (style === "mashup") {
      // Bas trzyma B, a A odsiewamy z dołów (highpass ~160 Hz) — czysty, nie zabłocony mashup.
      const hpA = offlineCtx.createBiquadFilter();
      hpA.type = "highpass";
      hpA.frequency.setValueAtTime(160, 0);
      const panA = offlineCtx.createStereoPanner?.();
      const panB = offlineCtx.createStereoPanner?.();
      if (panA && panB) {
        panA.pan.setValueAtTime(-0.25, 0);
        panB.pan.setValueAtTime(0.25, 0);
        sourceA.connect(gainNodeA).connect(hpA).connect(panA).connect(comp);
        sourceB.connect(gainNodeB).connect(panB).connect(comp);
      } else {
        sourceA.connect(gainNodeA).connect(hpA).connect(comp);
        sourceB.connect(gainNodeB).connect(comp);
      }
    } else {
      sourceA.connect(gainNodeA).connect(comp);
      sourceB.connect(gainNodeB).connect(comp);
    }
    sourceA.start(0);
    sourceB.start(0);
  }

  const renderedBuffer = await offlineCtx.startRendering();

  // Apply master fade in/out
  for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
    const data = renderedBuffer.getChannelData(ch);
    applyFadeIn(data, sampleRate, 0.05); // tiny click prevention
    applyFadeOut(data, sampleRate, 0.8);
  }

  // Encode to WAV
  const wavBlob = audioBufferToWav(renderedBuffer);
  const audioUrl = URL.createObjectURL(wavBlob);
  const duration = Math.round(renderedBuffer.duration);

  const beatTag = rateB !== 1 ? ` · beatmatch ${bpmA}→${bpmB}` : bpmA > 0 ? ` · ${bpmA} BPM` : "";
  return { audioUrl, duration, title: `Mix (${style})${beatTag}` };
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Interleave channels
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
