// Warsztat ścieżek (Studio Pro): czysta logika bez DOM — tempo, kafelki, sample.

/** Długość taktu w sekundach. */
export const barSeconds = (bpm: number, beatsPerBar = 4) => (60 / bpm) * beatsPerBar;

/**
 * Szacuje tempo (BPM) z obwiedni energii: autokorelacja różnic energii w oknach 10 ms
 * w zakresie 70–180 BPM. Wystarcza do ustawienia siatki taktów; można poprawić ręcznie.
 */
export function estimateBpm(samples: Float32Array, sampleRate: number): number {
  const hop = Math.round(sampleRate * 0.01);
  const frames = Math.floor(samples.length / hop);
  if (frames < 400) return 120;
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) e += samples[i] * samples[i];
    env[f] = Math.sqrt(e / hop);
  }
  // Uderzenia = dodatnie przyrosty energii.
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, env[f] - env[f - 1]);
  let best = 120, bestScore = -Infinity;
  for (let bpm = 70; bpm <= 180; bpm++) {
    const lag = Math.round(6000 / bpm); // klatki 10 ms na jedno uderzenie
    let score = 0;
    for (let f = lag; f < frames; f++) score += onset[f] * onset[f - lag];
    score /= frames - lag;
    if (score > bestScore) { bestScore = score; best = bpm; }
  }
  return best;
}

/** Ciągłe odcinki włączonych kafelków w wierszu: [start, długość] — jedno źródło na odcinek (bez trzasków na granicach taktów). */
export function runsOf(row: boolean[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  row.forEach((on, i) => {
    if (on && start < 0) start = i;
    if ((!on || i === row.length - 1) && start >= 0) {
      const end = on ? i : i - 1;
      runs.push([start, end - start + 1]);
      start = -1;
    }
  });
  return runs;
}

export type SampleOptions = {
  start: number;     // s
  length: number;    // s
  reverse: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  gain: number;      // 0..2
};

/** Wycina sampel z kanałów, z odwróceniem i zanikaniem (wysokość zmienia odtwarzanie: playbackRate). */
export function cutSample(channels: Float32Array[], sampleRate: number, o: SampleOptions): Float32Array<ArrayBuffer>[] {
  const from = Math.max(0, Math.floor(o.start * sampleRate));
  const to = Math.min(channels[0].length, from + Math.max(1, Math.floor(o.length * sampleRate)));
  const n = Math.max(1, to - from);
  const fin = Math.min(n, Math.floor((o.fadeInMs / 1000) * sampleRate));
  const fout = Math.min(n, Math.floor((o.fadeOutMs / 1000) * sampleRate));
  return channels.map((ch) => {
    const out = new Float32Array(n); // własny ArrayBuffer — wymagany przez AudioBuffer.copyToChannel
    out.set(ch.subarray(from, from + n));
    if (o.reverse) out.reverse();
    for (let i = 0; i < n; i++) {
      let g = o.gain;
      if (i < fin) g *= i / fin;
      if (i >= n - fout) g *= (n - 1 - i) / Math.max(1, fout);
      out[i] *= g;
    }
    return out;
  });
}

/** Szczyty do rysowania fali: max |x| w każdej z `width` kolumn. */
export function peaks(samples: Float32Array, width: number): Float32Array {
  const out = new Float32Array(width);
  const step = Math.max(1, Math.floor(samples.length / width));
  const stride = Math.max(1, Math.floor(step / 256)); // długie kolumny: co n-ta próbka (szybko), krótkie: każda
  for (let x = 0; x < width; x++) {
    let m = 0;
    const end = Math.min(samples.length, (x + 1) * step);
    for (let i = x * step; i < end; i += stride) { const v = Math.abs(samples[i]); if (v > m) m = v; }
    out[x] = m;
  }
  return out;
}

/** Polskie nazwy ścieżek Demucsa. */
export const STEM_LABELS: Record<string, string> = {
  vocals: "Wokal", instrumental: "Akompaniament", drums: "Perkusja", bass: "Bas",
  other: "Reszta", guitar: "Gitara", piano: "Pianino", mix: "Cały utwór",
};
