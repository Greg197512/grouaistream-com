// Autotune (korekta wysokości) jako obróbka nagrania — bez opóźnień odsłuchu.
// 1) wykrycie wysokości metodą YIN na sygnale zdecymowanym ×2 (szybciej),
// 2) docelowa nuta = najbliższy dźwięk wybranej skali, wygładzanie „szybkością korekty”,
// 3) przesunięcie wysokości ziarnami (granular resampling, nakładanie 75%) z zachowaniem długości.

export type Scale = "major" | "minor" | "chromatic";
export type AutotuneOptions = {
  keyRoot: number;     // 0 = C … 11 = B
  scale: Scale;
  strength: number;    // 0..1 — jak mocno ściągać do nuty
  speedMs: number;     // 0 = natychmiast (efekt „robota”), 40–80 = naturalnie
};

const SCALES: Record<Scale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Najbliższa nuta skali (MIDI, ułamkowe wejście). */
export function nearestScaleNote(midi: number, keyRoot: number, scale: Scale): number {
  const allowed = SCALES[scale];
  let best = Math.round(midi), bestDist = Infinity;
  for (let n = Math.floor(midi) - 2; n <= Math.ceil(midi) + 2; n++) {
    if (!allowed.includes((((n - keyRoot) % 12) + 12) % 12)) continue;
    const d = Math.abs(n - midi);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

/** Wysokość (Hz) w oknie metodą YIN; 0 = brak tonu (szept, szum, cisza). */
export function yinPitch(x: Float32Array, start: number, w: number, sr: number, minHz = 70, maxHz = 1000): number {
  const tauMin = Math.floor(sr / maxHz), tauMax = Math.min(Math.floor(sr / minHz), w - 1);
  if (start + w + tauMax >= x.length) return 0;
  let energy = 0;
  for (let i = start; i < start + w; i++) energy += x[i] * x[i];
  if (energy / w < 1e-6) return 0;
  const d = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = start; i < start + w; i++) { const v = x[i] - x[i + tau]; s += v * v; }
    d[tau] = s;
  }
  // Skumulowana normalizacja (CMND) i pierwszy dołek poniżej progu.
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    if (tau < tauMin) { run += d[tau]; continue; }
    run += d[tau];
    const cmnd = run > 0 ? (d[tau] * tau) / run : 1;
    if (cmnd < 0.15) {
      let t = tau;
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      // Interpolacja paraboliczna wokół minimum.
      const a = d[t - 1] ?? d[t], b = d[t], c = d[t + 1] ?? d[t];
      const shift = (a - 2 * b + c) !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
      return sr / (t + shift);
    }
  }
  return 0;
}

/** Krzywa wysokości: Hz co `hop` próbek oryginału (0 = bez tonu). */
export function pitchTrack(x: Float32Array, sr: number, hop: number): Float32Array {
  // Decymacja ×2 (średnia par) — ton głosu i tak leży nisko, a YIN liczy 4× szybciej.
  const half = new Float32Array(Math.floor(x.length / 2));
  for (let i = 0; i < half.length; i++) half[i] = 0.5 * (x[2 * i] + x[2 * i + 1]);
  const sr2 = sr / 2, w = Math.round(sr2 * 0.03);
  const frames = Math.ceil(x.length / hop);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) out[f] = yinPitch(half, Math.floor((f * hop) / 2), w, sr2);
  return out;
}

export type PitchCurve = { pitch: Float32Array; ratios: Float32Array; hop: number };

/** Krzywa korekty: wysokość (mediana z 3 ramek — bez skoków oktawowych) i współczynnik zmiany. */
export function correctionCurve(x: Float32Array, sr: number, o: AutotuneOptions): PitchCurve & { corrected: number } {
  const hop = 512;
  const raw = pitchTrack(x, sr, hop);
  const pitch = new Float32Array(raw.length);
  for (let f = 0; f < raw.length; f++) {
    const a = raw[f - 1] ?? raw[f], b = raw[f], c = raw[f + 1] ?? raw[f];
    pitch[f] = b === 0 ? 0 : [a, b, c].filter(Boolean).sort((p, q) => p - q)[Math.floor([a, b, c].filter(Boolean).length / 2)];
  }
  const ratios = new Float32Array(pitch.length).fill(1);
  const alpha = o.speedMs <= 0 ? 1 : 1 - Math.exp(-(hop / sr) / (o.speedMs / 1000));
  let smooth = 0, voiced = false, corrected = 0;
  for (let f = 0; f < pitch.length; f++) {
    if (!pitch[f]) { voiced = false; continue; }
    const m = hzToMidi(pitch[f]);
    const shift = (nearestScaleNote(m, o.keyRoot, o.scale) - m) * o.strength; // półtony
    smooth = !voiced ? shift : smooth + (shift - smooth) * alpha;
    voiced = true;
    ratios[f] = Math.pow(2, smooth / 12);
    if (Math.abs(smooth) > 0.05) corrected++;
  }
  return { pitch, ratios, hop, corrected };
}

/**
 * TD-PSOLA: znaczniki analizy co okres oryginału, znaczniki syntezy co okres docelowy;
 * w każdym znaczniku syntezy ziarno 2 okresów (okno Hanna) z najbliższego znacznika analizy.
 * Fragmenty bez tonu przechodzą bez zmian (stały krok 10 ms, współczynnik 1).
 */
export function psolaShift(x: Float32Array, sr: number, curve: PitchCurve): Float32Array {
  const { pitch, ratios, hop } = curve;
  const n = x.length, unvoicedT = Math.round(sr * 0.01);
  const frame = (t: number) => Math.min(pitch.length - 1, Math.max(0, Math.floor(t / hop)));
  const periodAt = (t: number) => { const f0 = pitch[frame(t)]; return f0 ? sr / f0 : unvoicedT; };
  const marks: number[] = [];
  for (let t = 0; t < n; t += Math.max(1, Math.round(periodAt(t)))) marks.push(t);
  const out = new Float32Array(n), norm = new Float32Array(n);
  let k = 0;
  for (let ts = 0; ts < n;) {
    const T = periodAt(ts), r = pitch[frame(ts)] ? ratios[frame(ts)] : 1;
    while (k + 1 < marks.length && Math.abs(marks[k + 1] - ts) <= Math.abs(marks[k] - ts)) k++;
    const ta = marks[k], Ta = Math.max(2, Math.round(periodAt(ta)));
    const L = 2 * Ta;
    for (let j = 0; j < L; j++) {
      const src = ta - Ta + j, dst = Math.round(ts) - Ta + j;
      if (src < 0 || src >= n || dst < 0 || dst >= n) continue;
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (L - 1));
      out[dst] += x[src] * w;
      norm[dst] += w;
    }
    ts += Math.max(1, T / r);
  }
  for (let i = 0; i < n; i++) out[i] = norm[i] > 1e-3 ? out[i] / norm[i] : x[i];
  return out;
}

/** Autotune kanałów nagrania: krzywa z pierwszego kanału, ta sama zmiana na wszystkich (spójne stereo). */
export function autotune(x: Float32Array, sr: number, o: AutotuneOptions, curve?: PitchCurve): { out: Float32Array; curve: PitchCurve; corrected: number } {
  const c = curve ? { ...curve, corrected: 0 } : correctionCurve(x, sr, o);
  return { out: psolaShift(x, sr, c), curve: c, corrected: c.corrected };
}

export const SCALE_LABELS: Record<Scale, string> = { major: "dur", minor: "moll", chromatic: "chromatyczna" };
