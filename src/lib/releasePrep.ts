// GrouAI Studio → Spotify Ready: czyste funkcje (bez DOM) — tekst, tytuł, głośność,
// mastering i WAV. Orkiestracja w przeglądarce: src/lib/releasePipeline.ts.
//
// Wymogi dystrybucji (Spotify przez dystrybutora, np. DistroKid/Amuse):
//  • audio WAV 44,1 kHz / 16 bit stereo, bez przesterów,
//  • głośność referencyjna Spotify −14 LUFS, true peak ≤ −1 dBTP,
//  • okładka JPG RGB, kwadrat ≥ 3000×3000,
//  • tytuł bez emoji, adresów, dopisków typu „AI”/„Suno”, bez „feat.” w tytule,
//  • tekst bez znaczników sekcji ([Verse], [Chorus]…) i uwag produkcyjnych.

export const RELEASE_SAMPLE_RATE = 44_100;
export const TARGET_LUFS = -14;
export const CEILING_DBTP = -1;
export const COVER_SIZE = 3000;

// ── Tekst ──────────────────────────────────────────────────────────────────────

/** Uwagi generatora i znaczniki sekcji, których nie może być w opublikowanym tekście. */
const SECTION_RE = /^\s*[[(][^\])]*(verse|chorus|bridge|intro|outro|pre-?chorus|hook|refren|zwrotka|przejście|instrumental|solo|break|drop|interlude|end|koniec|fade)[^\])]*[\])]\s*$/i;
const LABEL_RE = /^\s*(verse|chorus|bridge|intro|outro|pre-?chorus|hook|refren|zwrotka)\s*\d*\s*:\s*/i;
const META_RE = /(\bsuno\b|\bai[- ]generated\b|wygenerowan\w* przez|stworzon\w* przez ai|\bchatgpt\b|\bgpt\b|grouai)/i;

/** Czyści tekst do publikacji: bez znaczników sekcji, uwag produkcyjnych i dopisków generatora. */
export function cleanLyrics(raw: string | null | undefined): string {
  if (!raw) return "";
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*|__|`/g, "")
    .split("\n")
    .map((l) => l.replace(/\s*[[(](?:x\d+|\d+x|repeat|powtórz\w*)[\])]\s*$/i, "").trimEnd())
    .filter((l) => !SECTION_RE.test(l) && !META_RE.test(l))
    .map((l) => l.replace(LABEL_RE, "").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s{2,}/g, " ").trim());
  // Zwrotki rozdzielone jedną pustą linią, bez pustych na początku/końcu.
  const out: string[] = [];
  for (const l of lines) {
    if (!l && (!out.length || out[out.length - 1] === "")) continue;
    out.push(l);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}/gu;
const HAS_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** Tytuł zgodny z wytycznymi sklepów: bez emoji, adresów i dopisków generatora. */
export function cleanTitle(raw: string | null | undefined): string {
  let t = (raw || "").replace(EMOJI_RE, "").replace(/https?:\/\/\S+/g, "");
  t = t.replace(/\s*[[(][^\])]*\b(ai|suno|demo|v\d|wersja \d)\b[^\])]*[\])]\s*/gi, " ");
  t = t.replace(/\s*[-–|•]\s*(ai|suno)\b.*$/i, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  // CAŁY TYTUŁ WIELKIMI LITERAMI → zwykła pisownia (sklepy odrzucają „krzyczące” tytuły).
  if (t.length > 4 && t === t.toUpperCase() && /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(t)) {
    t = t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, s, c) => s + c.toUpperCase());
  }
  return t.slice(0, 100) || "Bez tytułu";
}

const PROFANITY = ["kurw", "chuj", "pierdol", "jeb", "pizd", "skurwy", "fuck", "shit", "bitch", "motherf", "cunt", "nigga"];

/** Czy tekst wymaga oznaczenia „Explicit”. */
export function isExplicit(lyrics: string): boolean {
  const l = lyrics.toLowerCase();
  return PROFANITY.some((w) => l.includes(w));
}

// ── Głośność (ITU-R BS.1770-4) ────────────────────────────────────────────────

/** Współczynniki filtra K dla danej częstotliwości (dwa biquady: shelf + high-pass). */
function kFilterCoeffs(sr: number) {
  // Shelf (+4 dB @ ~1681 Hz)
  const G = 3.999843853973347;
  let f0 = 1681.974450955533, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = {
    b0: (Vh + Vb * K / Q + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q + K * K) / a0,
    a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0,
  };
  // High-pass (~38 Hz)
  f0 = 38.13547087602444; Q = 0.5003270373238773;
  K = Math.tan(Math.PI * f0 / sr);
  a0 = 1 + K / Q + K * K;
  const hp = { b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, hp];
}

function biquad(x: Float32Array, c: { b0: number; b1: number; b2: number; a1: number; a2: number }): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** Zintegrowana głośność w LUFS (bramka bezwzględna −70, względna −10 LU). */
export function integratedLufs(channels: Float32Array[], sr: number): number {
  const [shelf, hp] = kFilterCoeffs(sr);
  const filtered = channels.map((ch) => biquad(biquad(ch, shelf), hp));
  const block = Math.round(0.4 * sr), step = Math.round(0.1 * sr);
  const n = filtered[0]?.length ?? 0;
  const powers: number[] = [];
  for (let start = 0; start + block <= n; start += step) {
    let sum = 0;
    for (const ch of filtered) {
      let s = 0;
      for (let i = start; i < start + block; i++) s += ch[i] * ch[i];
      sum += s / block; // wagi kanałów L/R = 1
    }
    powers.push(sum);
  }
  if (!powers.length) return -70;
  const lufs = (p: number) => -0.691 + 10 * Math.log10(p);
  const abs = powers.filter((p) => lufs(p) > -70);
  if (!abs.length) return -70;
  const relGate = lufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const rel = abs.filter((p) => lufs(p) > relGate);
  return lufs(rel.reduce((a, b) => a + b, 0) / rel.length);
}

/** Szczyt rzeczywisty (true peak) w dBTP — nadpróbkowanie ×4 interpolacją Catmulla-Roma. */
export function truePeakDb(channels: Float32Array[]): number {
  let peak = 0;
  for (const x of channels) {
    for (let i = 1; i < x.length - 2; i++) {
      const p0 = x[i - 1], p1 = x[i], p2 = x[i + 1], p3 = x[i + 2];
      const a = Math.abs(p1); if (a > peak) peak = a;
      // Między próbkami sprawdzamy tylko tam, gdzie sygnał jest blisko szczytu (oszczędność czasu).
      if (Math.max(Math.abs(p1), Math.abs(p2)) < peak * 0.7) continue;
      for (const t of [0.25, 0.5, 0.75]) {
        const t2 = t * t, t3 = t2 * t;
        const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        const av = Math.abs(v); if (av > peak) peak = av;
      }
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -120;
}

// ── Mastering ─────────────────────────────────────────────────────────────────

/**
 * Normalizacja do −14 LUFS + limiter z wyprzedzeniem (5 ms) do sufitu −1 dBTP
 * (z zapasem 0,3 dB na nadpróbkowanie). Zwraca nowe kanały i zmierzone wartości.
 */
export function masterForRelease(channels: Float32Array[], sr: number) {
  const before = integratedLufs(channels, sr);
  const gain = Math.pow(10, (TARGET_LUFS - before) / 20);
  const ceiling = Math.pow(10, (CEILING_DBTP - 0.3) / 20);
  const n = channels[0].length;
  const look = Math.max(1, Math.round(0.005 * sr));
  const release = Math.exp(-1 / (0.08 * sr));
  // Obwiednia szczytów (max z kanałów) po wzmocnieniu.
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const ch of channels) { const v = Math.abs(ch[i] * gain); if (v > m) m = v; }
    env[i] = m;
  }
  // Wymagane wzmocnienie: minimum w oknie [i, i+look] (limiter widzi szczyt z wyprzedzeniem).
  const needArr = new Float32Array(n);
  for (let i = 0; i < n; i++) needArr[i] = env[i] > ceiling ? ceiling / env[i] : 1;
  const target = new Float32Array(n);
  const dq = new Int32Array(n + 1); // kolejka indeksów o rosnących wartościach (minimum okna)
  let head = 0, tail = 0;
  for (let k = 0; k < n + look; k++) {
    if (k < n) { while (tail > head && needArr[dq[tail - 1]] >= needArr[k]) tail--; dq[tail++] = k; }
    const i = k - look;
    if (i >= 0) { while (dq[head] < i) head++; target[i] = needArr[dq[head]]; }
  }
  // Płynny atak (~look próbek) i powrót 80 ms — bez skoków wzmocnienia (trzasków).
  const attack = Math.exp(-4.6 / look);
  let g = 1;
  const out = channels.map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    g = target[i] < g ? target[i] + (g - target[i]) * attack : target[i] + (g - target[i]) * release;
    for (let c = 0; c < channels.length; c++) {
      const v = channels[c][i] * gain * g;
      out[c][i] = Math.max(-ceiling, Math.min(ceiling, v)); // twarde zabezpieczenie resztek
    }
  }
  return { channels: out, lufsBefore: before, lufs: integratedLufs(out, sr), truePeak: truePeakDb(out), gainDb: 20 * Math.log10(gain) };
}

/** WAV PCM 16 bit z ditheringiem TPDF. */
export function encodeWav16(channels: Float32Array[], sr: number): Uint8Array {
  const nCh = channels.length, n = channels[0].length;
  const dataSize = n * nCh * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * 2, true); v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      const dither = (Math.random() - Math.random()) / 32768;
      const s = Math.max(-1, Math.min(1, channels[c][i] + dither));
      v.setInt16(o, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

// ── Kontrola wymogów ──────────────────────────────────────────────────────────

export type ReleaseCheck = { id: string; label: string; ok: boolean; detail: string };

export function releaseChecks(p: {
  title: string; artist: string; durationSec: number; sampleRate: number; channels: number;
  lufs: number; truePeak: number; coverSize: number | null; lyrics: string; instrumental: boolean;
}): ReleaseCheck[] {
  const c: ReleaseCheck[] = [];
  c.push({ id: "title", label: "Tytuł", ok: !!p.title && p.title !== "Bez tytułu" && !/\b(ai|suno)\b/i.test(p.title) && !HAS_EMOJI.test(p.title), detail: p.title });
  c.push({ id: "artist", label: "Wykonawca", ok: !!p.artist.trim() && !/\b(suno|ai generated)\b/i.test(p.artist), detail: p.artist });
  c.push({ id: "duration", label: "Długość ≥ 1 min", ok: p.durationSec >= 60, detail: `${Math.floor(p.durationSec / 60)}:${String(Math.round(p.durationSec % 60)).padStart(2, "0")}` });
  c.push({ id: "format", label: "WAV 44,1 kHz / 16 bit stereo", ok: p.sampleRate === RELEASE_SAMPLE_RATE && p.channels === 2, detail: `${p.sampleRate} Hz, ${p.channels} kan.` });
  c.push({ id: "loudness", label: "Głośność −14 LUFS (±1)", ok: Math.abs(p.lufs - TARGET_LUFS) <= 1, detail: `${p.lufs.toFixed(1)} LUFS` });
  c.push({ id: "peak", label: "True peak ≤ −1 dBTP", ok: p.truePeak <= CEILING_DBTP + 0.05, detail: `${p.truePeak.toFixed(1)} dBTP` });
  c.push({ id: "cover", label: "Okładka 3000×3000", ok: p.coverSize === COVER_SIZE, detail: p.coverSize ? `${p.coverSize}×${p.coverSize}` : "brak" });
  c.push({
    id: "lyrics", label: "Tekst bez znaczników",
    ok: p.instrumental || (!!p.lyrics && !/\[[^\]]+\]/.test(p.lyrics) && !META_RE.test(p.lyrics)),
    detail: p.instrumental ? "instrumentalny" : p.lyrics ? `${p.lyrics.split("\n").filter(Boolean).length} wersów` : "brak tekstu",
  });
  return c;
}
