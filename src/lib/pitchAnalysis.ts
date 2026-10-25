// Analiza wysokości dźwięku i tonacji — na podstawie autokorelacji (metoda
// zbliżona do YIN), bez zależności zewnętrznych. Działa dobrze na liniach
// melodycznych/wokalu (sygnał w dużej mierze monofoniczny); dla gęstego miksu
// wielu instrumentów naraz wynik jest orientacyjny — stąd "sugerowana
// tonacja", nie "jedyna słuszna transkrypcja".

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function freqToNote(freq: number): { name: string; octave: number; cents: number; midi: number } {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { name, octave, cents, midi: rounded };
}

// Autokorelacja z normalizacją — zwraca częstotliwość podstawową (Hz) albo 0 (cisza/szum).
function detectPitch(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return 0; // za cicho — pewnie cisza

  let r1 = 0, r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) > threshold) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) > threshold) { r2 = SIZE - i; break; }
  const trimmed = buf.subarray(r1, r2);
  const n = trimmed.length;
  if (n < 512) return 0;

  const c = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += trimmed[i] * trimmed[i + lag];
    c[lag] = sum;
  }
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos <= 0) return 0;
  // Interpolacja paraboliczna dla dokładniejszego wyniku.
  const x0 = maxPos < 1 ? maxPos : maxPos - 1;
  const x2 = maxPos + 1 < n ? maxPos + 1 : maxPos;
  let betterPos = maxPos;
  if (x0 !== maxPos && x2 !== maxPos) {
    const a = c[x0], b = c[maxPos], cc = c[x2];
    const denom = a - 2 * b + cc;
    if (denom !== 0) betterPos = maxPos + 0.5 * (a - cc) / denom;
  }
  const freq = sampleRate / betterPos;
  return freq > 50 && freq < 1200 ? freq : 0; // sensowny zakres głosu/instrumentów melodycznych
}

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function detectKey(chroma: number[]): { key: string; mode: "dur" | "moll" } {
  let best = { score: -Infinity, root: 0, mode: "dur" as "dur" | "moll" };
  for (let root = 0; root < 12; root++) {
    let majorScore = 0, minorScore = 0;
    for (let i = 0; i < 12; i++) {
      majorScore += chroma[(i + root) % 12] * MAJOR_PROFILE[i];
      minorScore += chroma[(i + root) % 12] * MINOR_PROFILE[i];
    }
    if (majorScore > best.score) best = { score: majorScore, root, mode: "dur" };
    if (minorScore > best.score) best = { score: minorScore, root, mode: "moll" };
  }
  return { key: NOTE_NAMES[best.root], mode: best.mode };
}

export type SongAnalysis = {
  key: string; // np. "E-moll"
  vocalRangeLow: string; // np. "A2"
  vocalRangeHigh: string; // np. "A4"
  tuningHint: string; // podpowiedź strojenia dla kapeli
  detectedNotes: number; // ile klatek dało wiarygodny wynik (jakość analizy)
};

/** Analizuje zmiksowany bufor: wykrywa tonację i zakres wysokości (wokal/melodia),
 *  generuje podpowiedź strojenia instrumentów dla zespołu. Orientacyjne — na
 *  gęstym miksie wielu instrumentów jednocześnie dokładność spada. */
export function analyzeSong(buffer: AudioBuffer): SongAnalysis {
  const sr = buffer.sampleRate;
  const data = buffer.numberOfChannels > 1
    ? mixToMono(buffer)
    : buffer.getChannelData(0);

  const frameSize = 2048;
  const hop = 1024;
  const chroma = new Array(12).fill(0);
  let minMidi = Infinity, maxMidi = -Infinity, detected = 0;

  for (let start = 0; start + frameSize <= data.length; start += hop) {
    const frame = data.subarray(start, start + frameSize);
    const freq = detectPitch(frame, sr);
    if (freq > 0) {
      const { midi } = freqToNote(freq);
      chroma[((midi % 12) + 12) % 12] += 1;
      if (midi < minMidi) minMidi = midi;
      if (midi > maxMidi) maxMidi = midi;
      detected++;
    }
  }

  if (detected < 5) {
    return { key: "nie wykryto (za cicho / instrumentalny szum)", vocalRangeLow: "—", vocalRangeHigh: "—", tuningHint: "Za mało wyraźnych dźwięków melodycznych do analizy — spróbuj z samym wokalem lub melodią solo.", detectedNotes: detected };
  }

  const { key, mode } = detectKey(chroma);
  const low = freqToNote(440 * Math.pow(2, (minMidi - 69) / 12));
  const high = freqToNote(440 * Math.pow(2, (maxMidi - 69) / 12));

  const tuningByKey: Record<string, string> = {
    C: "gitara/bas standardowo (E-A-D-G-B-E), klawisze bez transpozycji",
    G: "gitara/bas standardowo, kapodaster na 7 dla wygodniejszych chwytów C",
    D: "gitara/bas standardowo, kapodaster na 2 dla chwytów C",
    A: "gitara/bas standardowo, kapodaster na 2 dla chwytów G",
    E: "gitara/bas standardowo — wygodna tonacja otwartych akordów E/A",
    F: "gitara: kapodaster na 1 dla chwytów E, bas standardowo",
  };
  const tuningHint = tuningByKey[key] || `gitara/bas standardowo (E-A-D-G-B-E); dla ${key}-${mode} rozważ kapodaster lub transpozycję na klawiszach`;

  return {
    key: `${key}-${mode}`,
    vocalRangeLow: `${low.name}${low.octave}`,
    vocalRangeHigh: `${high.name}${high.octave}`,
    tuningHint,
    detectedNotes: detected,
  };
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}
