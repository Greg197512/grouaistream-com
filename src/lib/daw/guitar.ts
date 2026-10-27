// Gitara GrouAI Studio — czysta logika: stroje, kapodaster, chwyty akordów pod dowolny strój,
// rytmy bicia/palcowania i synteza struny (Karplus-Strong z pozycją kostki i tłumieniem dłonią).

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const hzToMidi = (hz: number, a4 = 440) => 69 + 12 * Math.log2(hz / a4);

/** Stroje: struny od najgrubszej (MIDI). */
export const TUNINGS: { id: string; label: string; strings: number[] }[] = [
  { id: "standard", label: "Standard (E A D G B E)", strings: [40, 45, 50, 55, 59, 64] },
  { id: "dropd", label: "Drop D (D A D G B E)", strings: [38, 45, 50, 55, 59, 64] },
  { id: "halfdown", label: "Pół tonu niżej (Eb)", strings: [39, 44, 49, 54, 58, 63] },
  { id: "fulldown", label: "Cały ton niżej (D G C F A D)", strings: [38, 43, 48, 53, 57, 62] },
  { id: "dropc", label: "Drop C (C G C F A D)", strings: [36, 43, 48, 53, 57, 62] },
  { id: "dadgad", label: "DADGAD", strings: [38, 45, 50, 55, 57, 62] },
  { id: "openg", label: "Open G (D G D G B D)", strings: [38, 43, 50, 55, 59, 62] },
  { id: "opend", label: "Open D (D A D F# A D)", strings: [38, 45, 50, 54, 57, 62] },
  { id: "opene", label: "Open E (E B E G# B E)", strings: [40, 47, 52, 56, 59, 64] },
  { id: "bass4", label: "Bas 4-strunowy (E A D G)", strings: [28, 33, 38, 43] },
  { id: "bass5", label: "Bas 5-strunowy (B E A D G)", strings: [23, 28, 33, 38, 43] },
  { id: "seven", label: "7-strunowa (B E A D G B E)", strings: [35, 40, 45, 50, 55, 59, 64] },
];

// ── Akordy ─────────────────────────────────────────────────────────────────────
export const CHORD_TYPES: Record<string, { label: string; intervals: number[] }> = {
  "": { label: "dur", intervals: [0, 4, 7] },
  m: { label: "moll", intervals: [0, 3, 7] },
  "7": { label: "7", intervals: [0, 4, 7, 10] },
  maj7: { label: "maj7", intervals: [0, 4, 7, 11] },
  m7: { label: "m7", intervals: [0, 3, 7, 10] },
  sus2: { label: "sus2", intervals: [0, 2, 7] },
  sus4: { label: "sus4", intervals: [0, 5, 7] },
  "5": { label: "power (5)", intervals: [0, 7] },
  dim: { label: "dim", intervals: [0, 3, 6] },
  add9: { label: "add9", intervals: [0, 4, 7, 14] },
};

/** „Am7”, „F#”, „Bbmaj7”, „G5” → { root 0–11, type } albo null. */
export function parseChord(name: string): { root: number; type: string } | null {
  const m = name.trim().match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!m) return null;
  let root = NOTE_NAMES.indexOf(m[1].toUpperCase());
  if (m[2] === "#") root += 1;
  if (m[2] === "b") root += 11;
  const rest = m[3].replace(/^min$|^-$/, "m").replace(/^maj$/, "");
  const type = rest in CHORD_TYPES ? rest : rest.toLowerCase() === "moll" ? "m" : null;
  return type === null ? null : { root: root % 12, type };
}

/**
 * Chwyt akordu dla stroju i kapodastera: na każdej strunie najniższy próg w oknie 4 progów,
 * którego dźwięk należy do akordu; struny basowe niebędące prymą lub kwintą — wyciszone.
 * Wybiera okno z najmniejszą liczbą wyciszonych strun i prymą w basie. Zwraca próg (−1 = wycisz).
 */
export function chordShape(chord: string, tuning: number[], capo = 0): number[] | null {
  const c = parseChord(chord);
  if (!c) return null;
  const pcs = CHORD_TYPES[c.type].intervals.map((i) => (c.root + i) % 12);
  let best: number[] | null = null, bestScore = -Infinity;
  for (let start = capo; start <= capo + 9; start++) {
    const frets = tuning.map((open) => {
      for (let f = start === capo ? capo : start; f <= start + 3; f++) if (pcs.includes((open + f) % 12)) return f;
      return -1;
    });
    // Bas: pierwsza grana struna powinna dać prymę (albo kwintę) — wcześniejsze wyciszamy.
    let firstPlayed = frets.findIndex((f) => f >= 0);
    while (firstPlayed >= 0 && firstPlayed < frets.length - 3 && (tuning[firstPlayed] + frets[firstPlayed]) % 12 !== c.root) {
      frets[firstPlayed] = -1;
      firstPlayed = frets.findIndex((f) => f >= 0);
    }
    const played = frets.filter((f) => f >= 0);
    const covered = new Set(frets.map((f, i) => (f >= 0 ? (tuning[i] + f) % 12 : -1)).filter((p) => p >= 0));
    if (played.length < Math.min(3, tuning.length) || !pcs.slice(0, 3).every((p) => covered.has(p) || p === (c.root + 7) % 12)) continue;
    const score = played.length * 2 - (start - capo) * 0.6 + (covered.size === pcs.length ? 2 : 0);
    if (score > bestScore) { bestScore = score; best = frets; }
  }
  return best;
}

// ── Rytmy ──────────────────────────────────────────────────────────────────────
/** Krok rytmu na ósemkach (8 na takt): D = w dół, U = w górę, X = stłumione uderzenie, liczby = struny palcowania. */
export const STRUM_PATTERNS: { id: string; label: string; steps: string[] }[] = [
  { id: "pop", label: "Pop (D-DU-UDU)", steps: ["D", "-", "D", "U", "-", "U", "D", "U"] },
  { id: "rock", label: "Rock (ósemki w dół)", steps: ["D", "D", "D", "D", "D", "D", "D", "D"] },
  { id: "ballad", label: "Ballada (D--D-DU-)", steps: ["D", "-", "-", "D", "-", "D", "U", "-"] },
  { id: "reggae", label: "Reggae (na słabą)", steps: ["-", "U", "-", "U", "-", "U", "-", "U"] },
  { id: "funk", label: "Funk (DXUXDXUX)", steps: ["D", "X", "U", "X", "D", "X", "U", "X"] },
  { id: "travis", label: "Palcowanie Travis", steps: ["0", "3", "1", "4", "0", "3", "1", "5"] },
  { id: "arp", label: "Arpeggio w górę", steps: ["0", "1", "2", "3", "4", "5", "4", "3"] },
  { id: "whole", label: "Całe nuty (1 uderzenie)", steps: ["D", "-", "-", "-", "-", "-", "-", "-"] },
];

// ── Synteza struny ─────────────────────────────────────────────────────────────
export type StringVoice = {
  brightness: number; // 0..1 — jasność ataku (filtr szumu wzbudzenia)
  pickPos: number;    // 0.05..0.5 — pozycja kostki (filtr grzebieniowy: przy mostku jaśniej)
  sustain: number;    // 0..1 — długość wybrzmienia
  palmMute: boolean;  // tłumienie dłonią: krótko i ciemniej
};

/**
 * Karplus-Strong z rozszerzeniami (pozycja kostki, strojenie ułamkowe przez allpass, tłumienie).
 * Zwraca próbki mono długości `seconds`.
 */
export function pluckString(hz: number, sr: number, seconds: number, v: StringVoice, seed = 1): Float32Array<ArrayBuffer> {
  const n = Math.max(1, Math.floor(sr * seconds));
  const out = new Float32Array(n);
  const period = sr / hz;
  const N = Math.max(2, Math.floor(period - 0.5));
  const frac = period - 0.5 - N; // reszta okresu → filtr allpass (dokładny strój)
  const ap = (1 - frac) / (1 + frac);
  const buf = new Float32Array(N);
  // Wzbudzenie: szum (deterministyczny) przefiltrowany wg jasności, potem grzebień pozycji kostki.
  let s = seed * 9301 + 49297, lp = 0;
  const bright = 0.15 + 0.85 * Math.max(0, Math.min(1, v.brightness * (v.palmMute ? 0.5 : 1)));
  for (let i = 0; i < N; i++) {
    s = (s * 9301 + 49297) % 233280;
    lp += bright * ((s / 233280) * 2 - 1 - lp);
    buf[i] = lp;
  }
  const pick = Math.max(1, Math.round(N * Math.max(0.05, Math.min(0.5, v.pickPos))));
  const exc = Float32Array.from(buf, (x, i) => x - (buf[i - pick] ?? 0) * 0.9);
  let mean = 0;
  for (const x of exc) mean += x;
  mean /= N;
  let peak = 1e-9;
  for (let i = 0; i < N; i++) { buf[i] = exc[i] - mean; peak = Math.max(peak, Math.abs(buf[i])); }
  for (let i = 0; i < N; i++) buf[i] /= peak;
  // Wybrzmienie: współczynnik strat na okres → czas T60 zależny od sustain (krócej przy tłumieniu).
  const t60 = v.palmMute ? 0.18 : 0.6 + 7 * Math.max(0, Math.min(1, v.sustain));
  const loss = Math.pow(10, -3 / (t60 * hz)) ;
  const damp = v.palmMute ? 0.35 : 0.5; // filtr uśredniający (wyższe tony gasną szybciej)
  let idx = 0, prev = 0, apX = 0, apY = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx];
    const nxt = buf[(idx + 1) % N];
    let y = loss * ((1 - damp) * cur + damp * nxt);
    // allpass dla ułamkowej długości linii
    const apOut = ap * y + apX - ap * apY;
    apX = y; apY = apOut; y = apOut;
    buf[idx] = y;
    out[i] = cur;
    prev = cur;
    idx = (idx + 1) % N;
  }
  void prev;
  return out;
}

/** Struna i próg dla nuty MIDI (najniższy próg na najwyższej możliwej strunie — wygodna pozycja). */
export function noteToFret(midi: number, tuning: number[], capo = 0, maxFret = 20): { string: number; fret: number } | null {
  let best: { string: number; fret: number } | null = null;
  tuning.forEach((open, sIdx) => {
    const fret = midi - open;
    if (fret < capo || fret > maxFret) return;
    if (!best || fret < best.fret) best = { string: sIdx, fret };
  });
  return best;
}

/** Najbliższa struna stroju dla częstotliwości (stroik) i odchyłka w centach; `a4` = kalibracja (np. 432–446 Hz). */
export function tunerReading(hz: number, tuning: number[], a4 = 440): { note: string; midi: number; cents: number; string: number; stringCents: number } {
  const m = hzToMidi(hz, a4);
  const nearest = Math.round(m);
  let sIdx = 0, best = Infinity;
  tuning.forEach((t, i) => { const d = Math.abs(m - t); if (d < best) { best = d; sIdx = i; } });
  return { note: noteName(nearest), midi: nearest, cents: Math.round((m - nearest) * 100), string: sIdx, stringCents: Math.round((m - tuning[sIdx]) * 100) };
}
