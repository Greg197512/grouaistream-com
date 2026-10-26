// GrouAI Studio DAW — czysta logika (bez Web Audio): ustawienia łańcucha, presety wokalu,
// analiza nagranego głosu → inteligentne ustawienia, wzorce perkusji, harmonia.

/** Ustawienia kanału (te same na żywo i przy odtwarzaniu/eksporcie). */
export type StripFx = {
  gate: number;      // dB progu bramki szumów; -90 = wyłączona
  hpf: number;       // Hz filtra górnoprzepustowego (dudnienie, trzaski mikrofonu)
  deEss: number;     // 0..100 — tłumienie syczenia (s, sz, cz)
  eqLow: number;     // dB @ 120 Hz
  eqMid: number;     // dB @ 1 kHz
  eqHigh: number;    // dB @ 8 kHz
  presence: number;  // dB @ 3,5 kHz — czytelność głosu
  air: number;       // dB @ 12 kHz — „powietrze”
  compress: number;  // 0..100
  reverb: number;    // 0..100
  delay: number;     // 0..100
};

export const FLAT_FX: StripFx = { gate: -90, hpf: 20, deEss: 0, eqLow: 0, eqMid: 0, eqHigh: 0, presence: 0, air: 0, compress: 0, reverb: 0, delay: 0 };

export const VOCAL_PRESETS: { id: string; label: string; fx: StripFx }[] = [
  { id: "natural", label: "Naturalny", fx: { ...FLAT_FX, gate: -60, hpf: 80, deEss: 20, presence: 2, compress: 30, reverb: 12 } },
  { id: "pop", label: "Pop studio", fx: { gate: -55, hpf: 100, deEss: 45, eqLow: -2, eqMid: -1, eqHigh: 2, presence: 4, air: 4, compress: 60, reverb: 22, delay: 10 } },
  { id: "rap", label: "Rap / hip-hop", fx: { gate: -50, hpf: 90, deEss: 40, eqLow: 1, eqMid: 1, eqHigh: 1, presence: 5, air: 2, compress: 75, reverb: 6, delay: 0 } },
  { id: "ballad", label: "Ballada", fx: { gate: -60, hpf: 80, deEss: 35, eqLow: 0, eqMid: -2, eqHigh: 2, presence: 3, air: 5, compress: 45, reverb: 45, delay: 18 } },
  { id: "radio", label: "Radio (telefon)", fx: { gate: -50, hpf: 400, deEss: 10, eqLow: -12, eqMid: 6, eqHigh: -8, presence: 6, air: -6, compress: 70, reverb: 0, delay: 0 } },
];

// ── Analiza głosu ──────────────────────────────────────────────────────────────

type Coeffs = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** Filtr RBJ (górno/dolnoprzepustowy, Q = 0,707). */
function rbj(type: "lp" | "hp", f: number, sr: number): Coeffs {
  const w = (2 * Math.PI * f) / sr, cos = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b1 = type === "lp" ? 1 - cos : -(1 + cos);
  const b0 = type === "lp" ? (1 - cos) / 2 : (1 + cos) / 2;
  return { b0: b0 / a0, b1: b1 / a0, b2: b0 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

function filt(x: Float32Array, c: Coeffs): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

const meanSq = (x: Float32Array) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return s / Math.max(1, x.length); };
const db = (p: number) => 10 * Math.log10(Math.max(p, 1e-12));

export type VocalAnalysis = {
  rmsDb: number;        // średni poziom fragmentów z głosem
  peakDb: number;
  noiseDb: number;      // tło między frazami
  lowRatio: number;     // udział < 150 Hz (dudnienie)
  sibilance: number;    // udział 5–9 kHz (syczenie)
  presenceRatio: number; // udział 2–5 kHz (czytelność)
  crestDb: number;      // szczyt − średnia (dynamika)
};

/** Analiza nagrania głosu (mono): poziomy, tło, rozkład pasm. */
export function analyzeVocal(x: Float32Array, sr: number): VocalAnalysis {
  const win = Math.max(1, Math.round(sr * 0.05));
  const frames: number[] = [];
  let peak = 0;
  for (let s = 0; s + win <= x.length; s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) { e += x[i] * x[i]; const a = Math.abs(x[i]); if (a > peak) peak = a; }
    frames.push(e / win);
  }
  const sorted = [...frames].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)] ?? 1e-12;
  const loud = sorted.slice(Math.floor(sorted.length * 0.5));
  const rms = loud.reduce((a, b) => a + b, 0) / Math.max(1, loud.length);
  const total = meanSq(x) || 1e-12;
  const low = meanSq(filt(x, rbj("lp", 150, sr))) / total;
  const sib = meanSq(filt(filt(x, rbj("hp", 5000, sr)), rbj("lp", 9000, sr))) / total;
  const pres = meanSq(filt(filt(x, rbj("hp", 2000, sr)), rbj("lp", 5000, sr))) / total;
  return {
    rmsDb: db(rms), peakDb: 20 * Math.log10(Math.max(peak, 1e-6)), noiseDb: db(noise),
    lowRatio: low, sibilance: sib, presenceRatio: pres, crestDb: 20 * Math.log10(Math.max(peak, 1e-6)) - db(rms),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Inteligentne ustawienia z analizy: bramka tuż nad tłem, filtr wg dudnienia, de-esser wg
 * syczenia, „obecność” gdy głos jest matowy, kompresja wg dynamiki, wzmocnienie do −18 dBFS RMS.
 */
export function smartVocalFx(a: VocalAnalysis): { fx: StripFx; gainDb: number; notes: string[] } {
  const notes: string[] = [];
  // Bramka 4 dB nad tłem, ale zawsze wyraźnie poniżej głosu (żeby nie ucinać cichych sylab).
  const gate = a.noiseDb < a.rmsDb - 8 ? clamp(Math.round(Math.min(a.noiseDb + 4, a.rmsDb - 6)), -80, -30) : -90;
  if (gate > -90) notes.push(`bramka szumów od ${gate} dB (tło ${Math.round(a.noiseDb)} dB)`);
  const hpf = a.lowRatio > 0.25 ? 120 : a.lowRatio > 0.1 ? 100 : 80;
  if (a.lowRatio > 0.1) notes.push(`wycięte dudnienie poniżej ${hpf} Hz`);
  const deEss = clamp(Math.round(a.sibilance * 900), 10, 80);
  if (deEss > 30) notes.push("złagodzone syczenie");
  const presence = a.presenceRatio < 0.06 ? 5 : a.presenceRatio < 0.12 ? 3 : 1;
  if (presence >= 3) notes.push("dodana czytelność (głos był matowy)");
  const compress = clamp(Math.round((a.crestDb - 8) * 5), 25, 80);
  notes.push(`kompresja ${compress}% (dynamika ${a.crestDb.toFixed(0)} dB)`);
  const gainDb = clamp(Math.round(-18 - a.rmsDb), -12, 24);
  if (Math.abs(gainDb) >= 2) notes.push(`poziom ${gainDb > 0 ? "+" : ""}${gainDb} dB`);
  return { fx: { gate, hpf, deEss, eqLow: -1, eqMid: 0, eqHigh: 1, presence, air: 3, compress, reverb: 18, delay: 6 }, gainDb, notes };
}

// ── Perkusja i harmonia ───────────────────────────────────────────────────────

export const DRUM_ROWS = ["kick", "snare", "clap", "hat", "openhat"] as const;
export type DrumRow = (typeof DRUM_ROWS)[number];
export type DrumPattern = Record<DrumRow, boolean[]>;
export const DRUM_LABELS: Record<DrumRow, string> = { kick: "Stopa", snare: "Werbel", clap: "Klaśnięcie", hat: "Hi-hat", openhat: "Otwarty hat" };

const steps = (s: string) => s.split("").map((c) => c === "x");
export const DRUM_PRESETS: Record<string, DrumPattern> = {
  "Pop": { kick: steps("x...x...x...x..."), snare: steps("....x.......x..."), clap: steps("................"), hat: steps("x.x.x.x.x.x.x.x."), openhat: steps("..............x.") },
  "Hip-hop": { kick: steps("x.....x...x....."), snare: steps("....x.......x..."), clap: steps("....x.......x..."), hat: steps("x.x.x.x.x.x.xxx."), openhat: steps("................") },
  "House": { kick: steps("x...x...x...x..."), snare: steps("................"), clap: steps("....x.......x..."), hat: steps("..x...x...x...x."), openhat: steps("..x...x...x...x.") },
  "Trap": { kick: steps("x......x..x....."), snare: steps("........x......."), clap: steps("........x......."), hat: steps("xxxxxxxxxxxxxxxx"), openhat: steps("......x.......x.") },
  "Pusty": { kick: steps("................"), snare: steps("................"), clap: steps("................"), hat: steps("................"), openhat: steps("................") },
};

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Progresje: [stopnie od toniki w półtonach, czy akord molowy]. */
export const PROGRESSIONS: { id: string; label: string; minorKey: boolean; chords: [number, boolean][] }[] = [
  { id: "pop", label: "I–V–vi–IV (pop)", minorKey: false, chords: [[0, false], [7, false], [9, true], [5, false]] },
  { id: "doo", label: "I–vi–IV–V (lata 50.)", minorKey: false, chords: [[0, false], [9, true], [5, false], [7, false]] },
  { id: "ballad", label: "vi–IV–I–V (ballada)", minorKey: false, chords: [[9, true], [5, false], [0, false], [7, false]] },
  { id: "minor", label: "i–VI–III–VII (mol, epicko)", minorKey: true, chords: [[0, true], [8, false], [3, false], [10, false]] },
  { id: "dark", label: "i–iv–v–i (mol, mrocznie)", minorKey: true, chords: [[0, true], [5, true], [7, true], [0, true]] },
];

/** Dźwięki akordu (MIDI) w okolicy C4 oraz bas (MIDI) w okolicy C2. */
export function chordNotes(keyRoot: number, degree: number, minor: boolean): { chord: number[]; bass: number } {
  const root = 60 + ((keyRoot + degree) % 12);
  const third = minor ? 3 : 4;
  return { chord: [root, root + third, root + 7], bass: 36 + ((keyRoot + degree) % 12) };
}

/** Przyciąganie czasu do siatki (np. do ćwierćnuty). */
export const snap = (sec: number, grid: number) => Math.max(0, Math.round(sec / grid) * grid);
