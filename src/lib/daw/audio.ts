// GrouAI Studio DAW — silnik Web Audio: kanał z efektami (zmiany na żywo), harmonogram
// klipów, miks do pliku, instrumenty (perkusja, bas, akordy) renderowane do AudioBuffer.
import {
  chordNotes, DRUM_ROWS, FLAT_FX, midiToHz, PROGRESSIONS, type DrumPattern, type DrumRow, type StripFx,
} from "./dsp";

export type Clip = {
  id: string; name: string; buffer: AudioBuffer; start: number; offset: number; duration: number; gain: number;
  /** Trwały plik na R2 (po zapisie projektu / imporcie). Brak = trzeba wgrać przy zapisie. */
  url?: string;
  /** Oryginalny plik nagrania z mikrofonu (mniejszy niż WAV) — wgrywany przy zapisie. */
  blob?: Blob;
  /** Bufor sprzed autotune — do cofnięcia. */
  original?: AudioBuffer;
};
/** Skąd pochodzi materiał ścieżki (utwór z katalogu) — do opisu remiksu i praw autorskich. */
export type TrackSource = { trackId: string; title: string; artist: string; userId: string | null };
export type TrackKind = "audio" | "vocal" | "instrument";
export type Track = {
  id: string; name: string; color: string; kind: TrackKind;
  volume: number; pan: number; mute: boolean; solo: boolean; armed: boolean;
  fx: StripFx; clips: Clip[];
  source?: TrackSource;
};
export type Project = { bpm: number; tracks: Track[] };

export const projectEnd = (p: Project) =>
  p.tracks.reduce((m, t) => t.clips.reduce((mm, c) => Math.max(mm, c.start + c.duration), m), 0);

// ── Bramka szumów (AudioWorklet — działa na żywo i przy eksporcie) ───────────
const GATE_SRC = `
class GrouaiGate extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: "threshold", defaultValue: -90 }]; }
  constructor() { super(); this.env = 0; this.g = 1; this.gains = new Float32Array(128); }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    const x0 = input && input[0];
    if (!x0) { for (const ch of output) ch.fill(0); return true; }
    const thDb = params.threshold[0];
    const off = thDb <= -89, th = Math.pow(10, thDb / 20);
    for (let n = 0; n < x0.length; n++) {
      const a = Math.abs(x0[n]);
      this.env = a > this.env ? a : this.env * 0.9995;
      const target = off || this.env > th ? 1 : 0;
      this.g += (target - this.g) * (target > this.g ? 0.05 : 0.0008);
      this.gains[n] = this.g;
    }
    for (let c = 0; c < output.length; c++) {
      const x = input[c] || x0, y = output[c];
      for (let n = 0; n < y.length; n++) y[n] = x[n] * this.gains[n];
    }
    return true;
  }
}
registerProcessor("grouai-gate", GrouaiGate);`;

const workletReady = new WeakMap<BaseAudioContext, Promise<boolean>>();
/** Ładuje bramkę do kontekstu (raz). false = przeglądarka bez AudioWorklet — kanał działa bez bramki. */
export function ensureWorklet(ctx: BaseAudioContext): Promise<boolean> {
  let p = workletReady.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([GATE_SRC], { type: "application/javascript" }));
    p = (ctx.audioWorklet?.addModule(url) ?? Promise.reject(new Error("brak AudioWorklet"))).then(() => true, () => false);
    workletReady.set(ctx, p);
  }
  return p;
}

const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();
function impulse(ctx: BaseAudioContext): AudioBuffer {
  let b = impulses.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2.4);
    b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    impulses.set(ctx, b);
  }
  return b;
}

// ── Kanał miksera ─────────────────────────────────────────────────────────────
export type Strip = {
  input: AudioNode;
  analyser: AnalyserNode;
  setFx: (fx: StripFx) => void;
  setMix: (volume: number, pan: number) => void;
};

/**
 * Kanał: [bramka] → filtr → de-esser → EQ 3-pasmowy → obecność → powietrze → kompresor
 * → (suchy + pogłos + echo) → suwak → panorama → miernik → wyjście. Ustawienia zmienia się na żywo.
 */
export function buildStrip(ctx: BaseAudioContext, fx: StripFx, volume: number, pan: number, dest: AudioNode, withGate: boolean): Strip {
  const input = ctx.createGain();
  let head: AudioNode = input;
  let gate: AudioWorkletNode | null = null;
  if (withGate) {
    try {
      gate = new AudioWorkletNode(ctx, "grouai-gate", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      head.connect(gate);
      head = gate;
    } catch { gate = null; }
  }
  const bq = (type: BiquadFilterType, f: number, q = 0.9) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const hpf = bq("highpass", fx.hpf, 0.707);
  const deEss = bq("peaking", 6500, 2.5);
  const low = bq("lowshelf", 120);
  const mid = bq("peaking", 1000);
  const high = bq("highshelf", 8000);
  const presence = bq("peaking", 3500, 1);
  const air = bq("highshelf", 12000);
  const comp = ctx.createDynamicsCompressor();
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  const makeup = ctx.createGain();
  head.connect(hpf).connect(deEss).connect(low).connect(mid).connect(high).connect(presence).connect(air).connect(comp).connect(makeup);

  const bus = ctx.createGain();
  makeup.connect(bus); // suchy
  const revSend = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx);
  makeup.connect(revSend).connect(conv).connect(bus);
  const delSend = ctx.createGain();
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  makeup.connect(delSend).connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(bus);

  const fader = ctx.createGain();
  const panner = ctx.createStereoPanner();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  bus.connect(fader).connect(panner).connect(analyser).connect(dest);

  const set = (p: AudioParam, v: number) => p.setTargetAtTime(v, ctx.currentTime, 0.015);
  const setFx = (f: StripFx) => {
    if (gate) set(gate.parameters.get("threshold")!, f.gate);
    set(hpf.frequency, Math.max(20, f.hpf));
    set(deEss.gain, -(f.deEss / 100) * 12);
    set(low.gain, f.eqLow);
    set(mid.gain, f.eqMid);
    set(high.gain, f.eqHigh);
    set(presence.gain, f.presence);
    set(air.gain, f.air);
    const amt = Math.max(0, Math.min(100, f.compress)) / 100;
    set(comp.threshold, -6 - amt * 30);
    set(comp.ratio, 1 + amt * 7);
    set(makeup.gain, Math.pow(10, (amt * 8) / 20));
    set(revSend.gain, (f.reverb / 100) * 0.8);
    set(delSend.gain, (f.delay / 100) * 0.6);
  };
  const setMix = (v: number, p: number) => { set(fader.gain, v); set(panner.pan, p); };
  // Wartości startowe bez rampy (ważne dla eksportu offline).
  delay.delayTime.value = 0.32;
  setFx(fx);
  setMix(volume, pan);
  return { input, analyser, setFx, setMix };
}

// ── Harmonogram projektu ──────────────────────────────────────────────────────
/** Planuje wszystkie klipy od `fromSec` (czas projektu) z początkiem w `startAt` (czas kontekstu). */
export function scheduleProject(ctx: BaseAudioContext, project: Project, dest: AudioNode, fromSec: number, startAt: number, withGate: boolean) {
  const nodes: AudioScheduledSourceNode[] = [];
  const strips = new Map<string, Strip>();
  const anySolo = project.tracks.some((t) => t.solo);
  for (const t of project.tracks) {
    const audible = !t.mute && (!anySolo || t.solo);
    const strip = buildStrip(ctx, t.fx, audible ? t.volume : 0, t.pan, dest, withGate);
    strips.set(t.id, strip);
    if (!audible) continue;
    for (const c of t.clips) {
      const into = Math.max(0, fromSec - c.start);
      if (into >= c.duration) continue;
      const src = ctx.createBufferSource();
      src.buffer = c.buffer;
      const g = ctx.createGain();
      g.gain.value = c.gain;
      src.connect(g).connect(strip.input);
      src.start(startAt + Math.max(0, c.start - fromSec), c.offset + into, c.duration - into);
      nodes.push(src);
    }
  }
  return { nodes, strips };
}

/** Klik metronomu na każde uderzenie (mocniejszy na „raz”). */
export function scheduleClicks(ctx: BaseAudioContext, dest: AudioNode, bpm: number, fromSec: number, startAt: number, seconds: number) {
  const beat = 60 / bpm;
  const nodes: AudioScheduledSourceNode[] = [];
  for (let k = Math.ceil(fromSec / beat); k * beat < fromSec + seconds; k++) {
    const t = startAt + k * beat - fromSec;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = k % 4 === 0 ? 1600 : 1000;
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.06);
    nodes.push(o);
  }
  return nodes;
}

/** Miks całego projektu do AudioBuffer (44,1 kHz stereo) z 2 s na wybrzmienie pogłosu. */
export async function mixdown(project: Project, sr = 44_100): Promise<AudioBuffer> {
  const len = Math.max(1, Math.ceil((projectEnd(project) + 2) * sr));
  const off = new OfflineAudioContext(2, len, sr);
  const gate = await ensureWorklet(off);
  scheduleProject(off, project, off.destination, 0, 0, gate);
  return off.startRendering();
}

// ── Instrumenty ───────────────────────────────────────────────────────────────
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext) {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  return b;
}

function drumHit(ctx: BaseAudioContext, out: AudioNode, row: DrumRow, t: number) {
  const env = (g: GainNode, peak: number, decay: number) => {
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  };
  const noiseSrc = (filterType: BiquadFilterType, f: number, peak: number, decay: number, at = t) => {
    const s = ctx.createBufferSource(); s.buffer = noise(ctx);
    const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(peak, at); g.gain.exponentialRampToValueAtTime(0.001, at + decay);
    s.connect(fl).connect(g).connect(out); s.start(at); s.stop(at + decay + 0.02);
  };
  if (row === "kick") {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env(g, 1, 0.4); o.connect(g).connect(out); o.start(t); o.stop(t + 0.42);
  } else if (row === "snare") {
    noiseSrc("highpass", 1500, 0.6, 0.18);
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = "triangle"; o.frequency.value = 185;
    env(g, 0.5, 0.1); o.connect(g).connect(out); o.start(t); o.stop(t + 0.12);
  } else if (row === "clap") {
    for (const dt of [0, 0.011, 0.022]) noiseSrc("bandpass", 1200, 0.7, 0.09, t + dt);
  } else if (row === "hat") {
    noiseSrc("highpass", 7000, 0.28, 0.05);
  } else {
    noiseSrc("highpass", 6500, 0.25, 0.32);
  }
}

/** Perkusja: wzorzec 16 kroków powtarzany przez `bars` taktów. */
export async function renderDrums(pattern: DrumPattern, bpm: number, bars: number, sr = 44_100): Promise<AudioBuffer> {
  const bar = (60 / bpm) * 4, step = bar / 16;
  const off = new OfflineAudioContext(2, Math.ceil(bars * bar * sr), sr);
  const bus = off.createGain(); bus.gain.value = 0.8; bus.connect(off.destination);
  for (let b = 0; b < bars; b++) for (const row of DRUM_ROWS) pattern[row].forEach((on, i) => on && drumHit(off, bus, row, b * bar + i * step));
  return off.startRendering();
}

/** Bas albo akordy wg progresji w tonacji (`keyRoot` 0 = C); jeden akord na takt. */
export async function renderHarmony(part: "bass" | "chords", keyRoot: number, progressionId: string, bpm: number, bars: number, sr = 44_100): Promise<AudioBuffer> {
  const prog = PROGRESSIONS.find((p) => p.id === progressionId) ?? PROGRESSIONS[0];
  const bar = (60 / bpm) * 4, beat = bar / 4;
  const off = new OfflineAudioContext(2, Math.ceil(bars * bar * sr) + sr, sr);
  const lp = off.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = part === "bass" ? 700 : 2400;
  const bus = off.createGain(); bus.gain.value = part === "bass" ? 0.5 : 0.18;
  lp.connect(bus).connect(off.destination);
  const voice = (hz: number, t: number, dur: number, detune = 0, type: OscillatorType = "sawtooth") => {
    const o = off.createOscillator(); o.type = type; o.frequency.value = hz; o.detune.value = detune;
    const g = off.createGain();
    const a = part === "bass" ? 0.01 : 0.08;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + a);
    g.gain.setTargetAtTime(0.0001, t + dur, part === "bass" ? 0.05 : 0.25);
    o.connect(g).connect(lp); o.start(t); o.stop(t + dur + 1.2);
  };
  for (let b = 0; b < bars; b++) {
    const [degree, minor] = prog.chords[b % prog.chords.length];
    const { chord, bass } = chordNotes(keyRoot, degree, minor);
    const t = b * bar;
    if (part === "chords") {
      for (const n of chord) { voice(midiToHz(n), t, bar * 0.95, -7); voice(midiToHz(n), t, bar * 0.95, 7); }
    } else {
      for (let k = 0; k < 4; k++) { voice(midiToHz(bass), t + k * beat, beat * 0.8); voice(midiToHz(bass - 12), t + k * beat, beat * 0.8, 0, "sine"); }
    }
  }
  return off.startRendering();
}

export { FLAT_FX };
