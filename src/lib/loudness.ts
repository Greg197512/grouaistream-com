// Analiza głośności i szczytu zgodna z metodą ITU-R BS.1770 (ten sam
// standard, którego używa Spotify do normalizacji odtwarzania) — licznik
// LUFS + oszacowanie true peak, bez żadnych zależności zewnętrznych.
// Źródła progów: Spotify normalizuje do -14 LUFS, zalecany margines
// true peak ≤ -1 dBTP (≤ -2 dBTP gdy master jest głośniejszy niż -14 LUFS),
// żeby transkodowanie do formatu stratnego nie ucięło szczytów.

function biquadFilter(samples: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const out = new Float32Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }
  return out;
}

// Stage 1: wysokopółkowy "pre-filter" (symuluje efekt głowy/ucha).
function highShelf(samples: Float32Array, sampleRate: number): Float32Array {
  const f0 = 1681.9744509555319, G = 3.999843853973347, Q = 0.7071752369554196;
  const A = Math.pow(10, G / 40);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);
  const sqrtA = Math.sqrt(A);
  const b0 = A * (A + 1 + (A - 1) * cosw0 + 2 * sqrtA * alpha);
  const b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
  const b2 = A * (A + 1 + (A - 1) * cosw0 - 2 * sqrtA * alpha);
  const a0 = A + 1 - (A - 1) * cosw0 + 2 * sqrtA * alpha;
  const a1 = 2 * (A - 1 - (A + 1) * cosw0);
  const a2 = A + 1 - (A - 1) * cosw0 - 2 * sqrtA * alpha;
  return biquadFilter(samples, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

// Stage 2: filtr RLB (górnoprzepustowy) — odrzuca bardzo niskie częstotliwości.
function rlbHighpass(samples: Float32Array, sampleRate: number): Float32Array {
  const f0 = 38.13547087613982, Q = 0.5003270373238773;
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);
  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  return biquadFilter(samples, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

/** Głośność zintegrowana (LUFS) wg ITU-R BS.1770-4 — bramkowanie absolutne + względne. */
export function measureIntegratedLUFS(buffer: AudioBuffer): number {
  const sr = buffer.sampleRate;
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(rlbHighpass(highShelf(buffer.getChannelData(c), sr), sr));
  }

  const blockSize = Math.round(0.4 * sr); // 400 ms
  const stepSize = Math.round(0.1 * sr); // krok 100 ms (75% nakładki)
  const blocks: number[] = [];
  for (let start = 0; start + blockSize <= channels[0].length; start += stepSize) {
    let sum = 0;
    for (const ch of channels) {
      let s = 0;
      for (let i = start; i < start + blockSize; i++) s += ch[i] * ch[i];
      sum += s / blockSize; // waga kanału = 1.0 dla mono/stereo L/R
    }
    const loudness = -0.691 + 10 * Math.log10(sum || 1e-12);
    blocks.push(loudness);
  }
  if (!blocks.length) return -70;

  // Bramka absolutna: -70 LUFS.
  const gated1 = blocks.filter((l) => l > -70);
  if (!gated1.length) return -70;
  const mean1 = gated1.reduce((a, b) => a + b, 0) / gated1.length;

  // Bramka względna: odrzuć bloki ciche o >10 LU od wstępnej średniej.
  const gated2 = gated1.filter((l) => l > mean1 - 10);
  if (!gated2.length) return mean1;
  return gated2.reduce((a, b) => a + b, 0) / gated2.length;
}

/** Przybliżony "true peak" (dBTP) — nadpróbkowanie 4x (interpolacja liniowa) łapie większość
 *  szczytów międzypróbkowych, które psuje transkodowanie do formatu stratnego. */
export function estimateTruePeakDb(buffer: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length - 1; i++) {
      const a = data[i], b = data[i + 1];
      peak = Math.max(peak, Math.abs(a), Math.abs(a + (b - a) * 0.25), Math.abs(a + (b - a) * 0.5), Math.abs(a + (b - a) * 0.75));
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

export type SpotifyReadyCheck = {
  ready: boolean;
  lufs: number;
  truePeakDb: number;
  durationSec: number;
  sampleRate: number;
  issues: string[];
};

/** Orientacyjna kontrola gotowości do dystrybucji (Spotify/DSP) — NIE wysyła nigdzie,
 *  tylko sprawdza parametry techniczne na podstawie publicznych wytycznych Spotify. */
export function checkSpotifyReady(buffer: AudioBuffer): SpotifyReadyCheck {
  const lufs = measureIntegratedLUFS(buffer);
  const truePeakDb = estimateTruePeakDb(buffer);
  const durationSec = buffer.duration;
  const sampleRate = buffer.sampleRate;
  const issues: string[] = [];

  const peakLimit = lufs > -14 ? -2 : -1;
  if (truePeakDb > peakLimit) {
    issues.push(`Zbyt głośne piki (~${truePeakDb.toFixed(1)} dBTP) — zostaw margines do ${peakLimit} dBTP, inaczej transkodowanie na Spotify może przyciąć dźwięk.`);
  }
  if (lufs < -24) {
    issues.push(`Bardzo cicho (${lufs.toFixed(1)} LUFS) — Spotify i tak wyrówna głośność do -14 LUFS, ale zbyt cichy master traci później na jakości.`);
  }
  if (durationSec < 30) {
    issues.push(`Utwór krótszy niż 30s (${durationSec.toFixed(0)}s) — odsłuchy poniżej 30 sekund nie liczą się do przychodu na Spotify.`);
  }
  if (sampleRate < 44100) {
    issues.push(`Częstotliwość próbkowania ${sampleRate} Hz poniżej wymaganych 44.1 kHz.`);
  }

  return { ready: issues.length === 0, lufs, truePeakDb, durationSec, sampleRate, issues };
}
