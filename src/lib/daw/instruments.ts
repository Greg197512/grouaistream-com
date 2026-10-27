// Instrumenty GrouAI Studio na żywo: wzmacniacz gitarowy z efektami, silnik gitary (struny Karplus-Strong),
// syntezator polifoniczny z brzmieniami, perkusja GM, Web MIDI i nagrywanie wyjścia instrumentu do DAW.
import { drumHit } from "./audio";
import type { DrumRow } from "./dsp";
import { midiToHz, pluckString, type StringVoice } from "./guitar";

// ── Wzmacniacz i efekty ────────────────────────────────────────────────────────
export type AmpSettings = {
  drive: number;     // 0..100 przester
  bass: number;      // −12..12 dB
  mid: number;
  treble: number;
  presence: number;
  comp: number;      // 0..100 kompresja
  chorus: number;    // 0..100
  delay: number;     // 0..100 (miks)
  delayTime: number; // ms
  feedback: number;  // 0..90 %
  reverb: number;    // 0..100
  volume: number;    // 0..100
  cabinet: boolean;  // symulacja kolumny głośnikowej
};

export const AMP_PRESETS: Record<string, { label: string; amp: AmpSettings }> = {
  clean: { label: "Clean (czysty)", amp: { drive: 4, bass: 1, mid: 0, treble: 2, presence: 1, comp: 30, chorus: 0, delay: 12, delayTime: 380, feedback: 25, reverb: 22, volume: 75, cabinet: true } },
  chorus: { label: "Clean + chorus (lata 80.)", amp: { drive: 6, bass: 0, mid: -1, treble: 3, presence: 2, comp: 40, chorus: 55, delay: 18, delayTime: 420, feedback: 30, reverb: 30, volume: 75, cabinet: true } },
  crunch: { label: "Crunch (blues/rock)", amp: { drive: 42, bass: 2, mid: 3, treble: 1, presence: 2, comp: 20, chorus: 0, delay: 8, delayTime: 320, feedback: 20, reverb: 16, volume: 70, cabinet: true } },
  lead: { label: "Lead (solówki)", amp: { drive: 68, bass: 1, mid: 4, treble: 2, presence: 3, comp: 45, chorus: 0, delay: 28, delayTime: 450, feedback: 38, reverb: 28, volume: 68, cabinet: true } },
  metal: { label: "Metal (high-gain)", amp: { drive: 92, bass: 4, mid: -5, treble: 3, presence: 4, comp: 35, chorus: 0, delay: 0, delayTime: 300, feedback: 10, reverb: 10, volume: 62, cabinet: true } },
  jazz: { label: "Jazz (ciepły)", amp: { drive: 2, bass: 3, mid: 1, treble: -5, presence: -3, comp: 25, chorus: 0, delay: 0, delayTime: 300, feedback: 10, reverb: 24, volume: 78, cabinet: true } },
  acoustic: { label: "Akustyk (mikrofon)", amp: { drive: 0, bass: -1, mid: -1, treble: 2, presence: 2, comp: 30, chorus: 0, delay: 0, delayTime: 300, feedback: 10, reverb: 26, volume: 80, cabinet: false } },
  ambient: { label: "Ambient (przestrzeń)", amp: { drive: 8, bass: 0, mid: -2, treble: 3, presence: 1, comp: 40, chorus: 35, delay: 45, delayTime: 520, feedback: 62, reverb: 70, volume: 70, cabinet: true } },
  bass: { label: "Wzmacniacz basowy", amp: { drive: 10, bass: 4, mid: 1, treble: -2, presence: 0, comp: 55, chorus: 0, delay: 0, delayTime: 300, feedback: 10, reverb: 4, volume: 82, cabinet: true } },
  di: { label: "Bez wzmacniacza (DI)", amp: { drive: 0, bass: 0, mid: 0, treble: 0, presence: 0, comp: 0, chorus: 0, delay: 0, delayTime: 300, feedback: 10, reverb: 0, volume: 80, cabinet: false } },
};

function impulse(ctx: BaseAudioContext, seconds = 2.4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let s = 12345 + c * 777;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = ((s / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / len, 3); }
  }
  return ir;
}

function driveCurve(drive: number) {
  const k = (drive / 100) * 60;
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = k < 0.05 ? x : ((1 + k) * x) / (1 + k * Math.abs(x)) * (x < 0 ? 0.92 : 1); // lekka asymetria = „lampowo”
  }
  return curve;
}

export type AmpChain = { input: GainNode; output: GainNode; set: (a: AmpSettings) => void };

/** Łańcuch: kompresor → przester → EQ (bas/środek/góra/presence) → kolumna → chorus/delay/pogłos → głośność. */
export function createAmp(ctx: BaseAudioContext, dest: AudioNode, initial: AmpSettings): AmpChain {
  const input = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  const pre = ctx.createGain();
  const shaper = ctx.createWaveShaper(); shaper.oversample = "4x";
  const post = ctx.createGain();
  const bass = ctx.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 120;
  const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 750; mid.Q.value = 0.8;
  const treble = ctx.createBiquadFilter(); treble.type = "highshelf"; treble.frequency.value = 3200;
  const presence = ctx.createBiquadFilter(); presence.type = "peaking"; presence.frequency.value = 5200; presence.Q.value = 1.2;
  const cabHp = ctx.createBiquadFilter(); cabHp.type = "highpass"; cabHp.frequency.value = 80;
  const cabLp = ctx.createBiquadFilter(); cabLp.type = "lowpass"; cabLp.Q.value = 0.9;
  const cabRes = ctx.createBiquadFilter(); cabRes.type = "peaking"; cabRes.frequency.value = 2400; cabRes.Q.value = 2;
  const dry = ctx.createGain();
  // chorus: krótka linia opóźniająca modulowana LFO
  const chDelay = ctx.createDelay(0.05); chDelay.delayTime.value = 0.014;
  const chLfo = ctx.createOscillator(); chLfo.frequency.value = 0.7;
  const chDepth = ctx.createGain(); chDepth.gain.value = 0.0035;
  const chGain = ctx.createGain();
  chLfo.connect(chDepth).connect(chDelay.delayTime); chLfo.start();
  // delay z pętlą sprzężenia (ciemniejące echa)
  const dl = ctx.createDelay(2);
  const fb = ctx.createGain();
  const dlTone = ctx.createBiquadFilter(); dlTone.type = "lowpass"; dlTone.frequency.value = 3500;
  const dlGain = ctx.createGain();
  dl.connect(dlTone).connect(fb).connect(dl);
  // pogłos
  const conv = ctx.createConvolver(); conv.buffer = impulse(ctx);
  const rvGain = ctx.createGain();
  const vol = ctx.createGain();

  input.connect(comp).connect(pre).connect(shaper).connect(post)
    .connect(bass).connect(mid).connect(treble).connect(presence).connect(cabHp).connect(cabLp).connect(cabRes).connect(dry);
  dry.connect(vol);
  dry.connect(chDelay).connect(chGain).connect(vol);
  dry.connect(dl); dlTone.connect(dlGain).connect(vol);
  dry.connect(conv).connect(rvGain).connect(vol);
  vol.connect(dest);

  const set = (a: AmpSettings) => {
    const t = ctx.currentTime;
    const ramp = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, 0.02);
    comp.threshold.value = -6 - a.comp * 0.34; comp.ratio.value = 1 + a.comp * 0.07; comp.attack.value = 0.006; comp.release.value = 0.18;
    const preG = 1 + (a.drive / 100) ** 2 * 30;
    ramp(pre.gain, preG);
    shaper.curve = driveCurve(a.drive);
    ramp(post.gain, a.drive > 1 ? 0.9 / Math.sqrt(preG) : 1);
    ramp(bass.gain, a.bass); ramp(mid.gain, a.mid); ramp(treble.gain, a.treble); ramp(presence.gain, a.presence);
    ramp(cabLp.frequency, a.cabinet ? 5200 - a.drive * 12 : 20_000);
    ramp(cabRes.gain, a.cabinet ? 3 : 0);
    ramp(cabHp.frequency, a.cabinet ? 85 : 20);
    ramp(chGain.gain, a.chorus / 100 * 0.8);
    ramp(dl.delayTime, Math.max(0.02, a.delayTime / 1000));
    ramp(fb.gain, Math.min(0.9, a.feedback / 100));
    ramp(dlGain.gain, a.delay / 100 * 0.7);
    ramp(rvGain.gain, a.reverb / 100 * 0.9);
    ramp(vol.gain, (a.volume / 100) * 1.1);
  };
  set(initial);
  return { input, output: vol, set };
}

// ── Gitara ─────────────────────────────────────────────────────────────────────
export type GuitarType = { id: string; label: string; voice: StringVoice; amp: string; twelve?: boolean; tuning?: string };
export const GUITAR_TYPES: GuitarType[] = [
  { id: "acoustic", label: "Akustyczna (stalowe struny)", voice: { brightness: 0.78, pickPos: 0.17, sustain: 0.62, palmMute: false }, amp: "acoustic" },
  { id: "nylon", label: "Klasyczna (nylon)", voice: { brightness: 0.36, pickPos: 0.3, sustain: 0.5, palmMute: false }, amp: "acoustic" },
  { id: "twelve", label: "12-strunowa", voice: { brightness: 0.8, pickPos: 0.15, sustain: 0.7, palmMute: false }, amp: "acoustic", twelve: true },
  { id: "clean", label: "Elektryczna — czysta", voice: { brightness: 0.6, pickPos: 0.12, sustain: 0.75, palmMute: false }, amp: "clean" },
  { id: "crunch", label: "Elektryczna — crunch", voice: { brightness: 0.62, pickPos: 0.12, sustain: 0.8, palmMute: false }, amp: "crunch" },
  { id: "lead", label: "Elektryczna — lead", voice: { brightness: 0.66, pickPos: 0.1, sustain: 0.95, palmMute: false }, amp: "lead" },
  { id: "metal", label: "Metal (7 strun, high-gain)", voice: { brightness: 0.7, pickPos: 0.08, sustain: 0.85, palmMute: false }, amp: "metal", tuning: "seven" },
  { id: "jazz", label: "Jazzowa (hollow body)", voice: { brightness: 0.28, pickPos: 0.36, sustain: 0.6, palmMute: false }, amp: "jazz" },
  { id: "bass", label: "Gitara basowa", voice: { brightness: 0.4, pickPos: 0.2, sustain: 0.7, palmMute: false }, amp: "bass", tuning: "bass4" },
];

export type GuitarOptions = { voice: StringVoice; twelve: boolean; vibratoDepth: number; vibratoRate: number; strumMs: number };

export class GuitarEngine {
  readonly amp: AmpChain;
  private cache = new Map<string, AudioBuffer>();
  private ringing = new Map<number, { srcs: AudioBufferSourceNode[]; gain: GainNode }>();
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private bend: ConstantSourceNode;
  opts: GuitarOptions;
  /** Wywoływane przy każdym szarpnięciu (animacja struny). */
  onPluck?: (stringIdx: number, fret: number, velocity: number) => void;

  constructor(private ctx: AudioContext, dest: AudioNode, amp: AmpSettings, opts: GuitarOptions) {
    this.amp = createAmp(ctx, dest, amp);
    this.opts = opts;
    this.lfo = ctx.createOscillator();
    this.lfoGain = ctx.createGain();
    this.lfo.connect(this.lfoGain);
    this.lfo.start();
    this.bend = ctx.createConstantSource();
    this.bend.offset.value = 0;
    this.bend.start();
    this.setVibrato(opts.vibratoDepth, opts.vibratoRate);
  }

  setVibrato(depthCents: number, rateHz: number) {
    this.opts.vibratoDepth = depthCents; this.opts.vibratoRate = rateHz;
    this.lfoGain.gain.setTargetAtTime(depthCents, this.ctx.currentTime, 0.03);
    this.lfo.frequency.setTargetAtTime(rateHz, this.ctx.currentTime, 0.03);
  }

  /** Podciągnięcie struny / pitch bend w centach (np. ±200). */
  setBend(cents: number) { this.bend.offset.setTargetAtTime(cents, this.ctx.currentTime, 0.01); }

  private buffer(midi: number, voice: StringVoice, seed: number) {
    const r = (v: number) => Math.round(v * 20) / 20;
    const key = `${midi}|${r(voice.brightness)}|${r(voice.pickPos)}|${r(voice.sustain)}|${voice.palmMute}|${seed}`;
    let b = this.cache.get(key);
    if (!b) {
      const sec = voice.palmMute ? 0.7 : 1.6 + voice.sustain * 5;
      const data = pluckString(midiToHz(midi), this.ctx.sampleRate, sec, voice, seed);
      // krótkie wygaszenie końcówki — bez trzasków
      const fade = Math.min(data.length, Math.floor(this.ctx.sampleRate * 0.05));
      for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
      b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      b.copyToChannel(data, 0);
      if (this.cache.size > 400) this.cache.clear();
      this.cache.set(key, b);
    }
    return b;
  }

  /** Szarpnięcie struny `stringIdx` dźwiękiem `midi` (poprzedni dźwięk na tej strunie gaśnie jak w prawdziwej gitarze). */
  pluck(stringIdx: number, midi: number, velocity = 0.8, when = this.ctx.currentTime, voice: StringVoice = this.opts.voice, fret = 0, totalStrings = 6) {
    this.choke(stringIdx, when);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.32 * velocity;
    gain.connect(this.amp.input);
    const srcs: AudioBufferSourceNode[] = [];
    const add = (m: number, g: number, delay: number, detune: number, seed: number) => {
      const s = this.ctx.createBufferSource();
      s.buffer = this.buffer(m, voice, seed);
      s.detune.value = detune;
      this.lfoGain.connect(s.detune);
      this.bend.connect(s.detune);
      const sg = this.ctx.createGain(); sg.gain.value = g;
      s.connect(sg).connect(gain);
      s.start(when + delay);
      s.onended = () => { try { sg.disconnect(); } catch { /* już odłączony */ } };
      srcs.push(s);
    };
    add(midi, 1, 0, 0, stringIdx + 1);
    if (this.opts.twelve && !voice.palmMute) {
      // 12-strunowa: basowe pary w oktawie, wysokie w unisonie lekko odstrojone
      if (stringIdx < totalStrings - 2) add(midi + 12, 0.55, 0.012, 3, stringIdx + 11);
      else add(midi, 0.6, 0.009, 5, stringIdx + 21);
    }
    this.ringing.set(stringIdx, { srcs, gain });
    const delayMs = Math.max(0, (when - this.ctx.currentTime) * 1000);
    if (this.onPluck) window.setTimeout(() => this.onPluck?.(stringIdx, fret, velocity), delayMs);
  }

  /** Wygaszenie struny (tłumienie palcem). */
  choke(stringIdx: number, when = this.ctx.currentTime, time = 0.015) {
    const r = this.ringing.get(stringIdx);
    if (!r) return;
    r.gain.gain.setTargetAtTime(0, when, time);
    for (const s of r.srcs) { try { s.stop(when + time * 8); } catch { /* już zatrzymany */ } }
    this.ringing.delete(stringIdx);
  }

  chokeAll(when = this.ctx.currentTime) { for (const k of [...this.ringing.keys()]) this.choke(k, when, 0.03); }

  /**
   * Uderzenie akordu: `frets` (−1 = wyciszona), kierunek D (w dół, od basu), U (w górę), X (stłumione „czik”).
   * Struny wybrzmiewają z przesunięciem `strumMs` — jak ruch ręki.
   */
  strum(frets: number[], tuning: number[], dir: "D" | "U" | "X", velocity = 0.85, when = this.ctx.currentTime, onlyStrings?: number[]) {
    const order = frets.map((f, i) => i).filter((i) => frets[i] >= 0 && (!onlyStrings || onlyStrings.includes(i)));
    if (dir === "U") order.reverse();
    const step = this.opts.strumMs / 1000 / Math.max(1, order.length - 1);
    const voice: StringVoice = dir === "X" ? { ...this.opts.voice, palmMute: true, sustain: 0, brightness: 0.5 } : this.opts.voice;
    order.forEach((s, k) => {
      // akcent na basie przy uderzeniu w dół, na wysokich przy uderzeniu w górę
      const accent = dir === "U" ? 0.7 + 0.3 * (k / order.length) : 1 - 0.25 * (k / order.length);
      this.pluck(s, tuning[s] + frets[s], velocity * accent * (dir === "X" ? 0.6 : 1), when + k * step, voice, frets[s], tuning.length);
    });
  }
}

// ── Syntezator polifoniczny ─────────────────────────────────────────────────────
type Osc = { type: OscillatorType; ratio: number; detune: number; gain: number };
export type SynthPreset = { id: string; label: string; oscs: Osc[]; attack: number; decay: number; sustain: number; release: number; cutoff: number; envAmt: number; q: number; vibrato: number };

export const SYNTH_PRESETS: SynthPreset[] = [
  { id: "piano", label: "Fortepian", oscs: [{ type: "triangle", ratio: 1, detune: 0, gain: 0.7 }, { type: "sine", ratio: 2, detune: 2, gain: 0.25 }, { type: "sine", ratio: 3, detune: -3, gain: 0.08 }], attack: 0.003, decay: 1.6, sustain: 0.08, release: 0.35, cutoff: 2800, envAmt: 3500, q: 0.5, vibrato: 0 },
  { id: "rhodes", label: "Rhodes (elektryczne pianino)", oscs: [{ type: "sine", ratio: 1, detune: 0, gain: 0.8 }, { type: "sine", ratio: 2, detune: 0, gain: 0.18 }, { type: "sine", ratio: 7, detune: 0, gain: 0.03 }], attack: 0.004, decay: 2.2, sustain: 0.28, release: 0.5, cutoff: 3500, envAmt: 1500, q: 0.4, vibrato: 0 },
  { id: "organ", label: "Organy Hammond", oscs: [{ type: "sine", ratio: 0.5, detune: 0, gain: 0.35 }, { type: "sine", ratio: 1, detune: 0, gain: 0.5 }, { type: "sine", ratio: 1.5, detune: 0, gain: 0.25 }, { type: "sine", ratio: 2, detune: 0, gain: 0.3 }, { type: "sine", ratio: 4, detune: 0, gain: 0.12 }], attack: 0.006, decay: 0.1, sustain: 1, release: 0.08, cutoff: 7000, envAmt: 0, q: 0.3, vibrato: 6 },
  { id: "strings", label: "Smyczki", oscs: [{ type: "sawtooth", ratio: 1, detune: -7, gain: 0.35 }, { type: "sawtooth", ratio: 1, detune: 7, gain: 0.35 }, { type: "sawtooth", ratio: 2, detune: 3, gain: 0.12 }], attack: 0.35, decay: 0.4, sustain: 0.85, release: 0.9, cutoff: 2600, envAmt: 600, q: 0.3, vibrato: 9 },
  { id: "pad", label: "Pad (ambient)", oscs: [{ type: "sawtooth", ratio: 1, detune: -12, gain: 0.3 }, { type: "sawtooth", ratio: 1, detune: 12, gain: 0.3 }, { type: "triangle", ratio: 0.5, detune: 0, gain: 0.3 }], attack: 0.9, decay: 1, sustain: 0.8, release: 1.8, cutoff: 1500, envAmt: 900, q: 1.2, vibrato: 3 },
  { id: "lead", label: "Lead (syntezator)", oscs: [{ type: "sawtooth", ratio: 1, detune: -5, gain: 0.45 }, { type: "square", ratio: 1, detune: 5, gain: 0.3 }], attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.2, cutoff: 2200, envAmt: 3000, q: 4, vibrato: 12 },
  { id: "brass", label: "Sekcja dęta", oscs: [{ type: "sawtooth", ratio: 1, detune: -4, gain: 0.45 }, { type: "sawtooth", ratio: 1, detune: 4, gain: 0.45 }], attack: 0.06, decay: 0.3, sustain: 0.75, release: 0.25, cutoff: 900, envAmt: 2600, q: 1.5, vibrato: 5 },
  { id: "bass", label: "Bas syntezatorowy", oscs: [{ type: "square", ratio: 0.5, detune: 0, gain: 0.5 }, { type: "sine", ratio: 0.25, detune: 0, gain: 0.6 }], attack: 0.004, decay: 0.25, sustain: 0.6, release: 0.12, cutoff: 600, envAmt: 1400, q: 3, vibrato: 0 },
  { id: "bell", label: "Dzwonki / celesta", oscs: [{ type: "sine", ratio: 1, detune: 0, gain: 0.6 }, { type: "sine", ratio: 3.5, detune: 0, gain: 0.25 }, { type: "sine", ratio: 5.4, detune: 0, gain: 0.1 }], attack: 0.002, decay: 2.5, sustain: 0, release: 1.2, cutoff: 9000, envAmt: 0, q: 0.3, vibrato: 0 },
];

type SynthVoice = { oscs: OscillatorNode[]; env: GainNode; filter: BiquadFilterNode; preset: SynthPreset };

export class PolySynth {
  readonly fx: AmpChain;
  private voices = new Map<number, SynthVoice>();
  private held = new Set<number>(); // nuty puszczone przy wciśniętym pedale
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private bend: ConstantSourceNode;
  private mod = 0;
  sustainPedal = false;
  preset: SynthPreset = SYNTH_PRESETS[0];

  constructor(private ctx: AudioContext, dest: AudioNode, fx: AmpSettings) {
    this.fx = createAmp(ctx, dest, fx);
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 5.2;
    this.lfoGain = ctx.createGain(); this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain); this.lfo.start();
    this.bend = ctx.createConstantSource(); this.bend.offset.value = 0; this.bend.start();
  }

  setPreset(p: SynthPreset) { this.preset = p; this.setMod(this.mod); }
  /** Kółko modulacji 0..1 → głębokość vibrato. */
  setMod(v: number) { this.mod = v; this.lfoGain.gain.setTargetAtTime(this.preset.vibrato + v * 40, this.ctx.currentTime, 0.03); }
  setBend(cents: number) { this.bend.offset.setTargetAtTime(cents, this.ctx.currentTime, 0.01); }

  noteOn(midi: number, velocity = 0.8, when = this.ctx.currentTime) {
    this.kill(midi, when);
    const p = this.preset;
    const env = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter(); filter.type = "lowpass"; filter.Q.value = p.q;
    const hz = midiToHz(midi);
    // Wyższe nuty fortepianu gasną szybciej, mocniejsze uderzenie = jaśniej.
    const decay = p.decay * Math.max(0.35, 1 - (midi - 60) / 60);
    const peak = 0.22 * velocity;
    filter.frequency.setValueAtTime(p.cutoff + p.envAmt * velocity, when);
    filter.frequency.setTargetAtTime(p.cutoff, when + p.attack, decay / 3);
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peak, when + p.attack);
    env.gain.setTargetAtTime(Math.max(0.0001, peak * p.sustain), when + p.attack, decay / 3);
    filter.connect(env).connect(this.fx.input);
    const oscs = p.oscs.map((o) => {
      const osc = this.ctx.createOscillator();
      osc.type = o.type; osc.frequency.value = hz * o.ratio; osc.detune.value = o.detune;
      this.lfoGain.connect(osc.detune); this.bend.connect(osc.detune);
      const g = this.ctx.createGain(); g.gain.value = o.gain;
      osc.connect(g).connect(filter);
      osc.start(when);
      return osc;
    });
    this.voices.set(midi, { oscs, env, filter, preset: p });
    this.held.delete(midi);
  }

  noteOff(midi: number, when = this.ctx.currentTime) {
    if (this.sustainPedal) { if (this.voices.has(midi)) this.held.add(midi); return; }
    this.release(midi, when);
  }

  private release(midi: number, when: number) {
    const v = this.voices.get(midi);
    if (!v) return;
    v.env.gain.cancelScheduledValues(when);
    v.env.gain.setValueAtTime(Math.max(0.0001, v.env.gain.value), when);
    v.env.gain.setTargetAtTime(0.0001, when, v.preset.release / 4);
    for (const o of v.oscs) o.stop(when + v.preset.release * 1.5 + 0.05);
    this.voices.delete(midi);
  }

  private kill(midi: number, when: number) {
    const v = this.voices.get(midi);
    if (!v) return;
    v.env.gain.setTargetAtTime(0, when, 0.01);
    for (const o of v.oscs) o.stop(when + 0.06);
    this.voices.delete(midi);
  }

  setSustain(on: boolean) {
    this.sustainPedal = on;
    if (!on) { for (const m of this.held) this.release(m, this.ctx.currentTime); this.held.clear(); }
  }

  allOff() { for (const m of [...this.voices.keys()]) this.release(m, this.ctx.currentTime); this.held.clear(); }
}

/** Perkusja wg standardu General MIDI (kanał 10 / klawisze od C1). */
export const GM_DRUMS: Record<number, { row: DrumRow; label: string }> = {
  35: { row: "kick", label: "Stopa" }, 36: { row: "kick", label: "Stopa" }, 37: { row: "clap", label: "Rimshot" }, 38: { row: "snare", label: "Werbel" },
  39: { row: "clap", label: "Klaśnięcie" }, 40: { row: "snare", label: "Werbel" }, 42: { row: "hat", label: "Hi-hat" }, 44: { row: "hat", label: "Hi-hat (pedał)" },
  46: { row: "openhat", label: "Otwarty hat" }, 49: { row: "openhat", label: "Crash" }, 51: { row: "openhat", label: "Ride" },
};
export function playDrum(ctx: BaseAudioContext, out: AudioNode, midi: number, velocity = 0.9, when = ctx.currentTime) {
  const d = GM_DRUMS[midi] ?? GM_DRUMS[36 + (midi % 12 < 2 ? 0 : midi % 12 < 5 ? 2 : midi % 12 < 7 ? 6 : 10)];
  const g = ctx.createGain(); g.gain.value = velocity; g.connect(out);
  drumHit(ctx, g, d.row, when);
}

// ── Web MIDI ───────────────────────────────────────────────────────────────────
export type MidiEvent =
  | { type: "on"; note: number; velocity: number; channel: number }
  | { type: "off"; note: number; channel: number }
  | { type: "cc"; cc: number; value: number; channel: number }
  | { type: "bend"; value: number; channel: number }; // −1..1

/** Rozkodowanie surowego komunikatu MIDI. */
export function decodeMidi(data: ArrayLike<number>): MidiEvent | null {
  const [status, a = 0, b = 0] = Array.from(data);
  const cmd = status & 0xf0, channel = (status & 0x0f) + 1;
  if (cmd === 0x90 && b > 0) return { type: "on", note: a, velocity: b / 127, channel };
  if (cmd === 0x80 || (cmd === 0x90 && b === 0)) return { type: "off", note: a, channel };
  if (cmd === 0xb0) return { type: "cc", cc: a, value: b / 127, channel };
  if (cmd === 0xe0) return { type: "bend", value: (((b << 7) | a) - 8192) / 8192, channel };
  return null;
}

type MidiInputLike = { name?: string | null; addEventListener: (t: string, f: (e: { data: Uint8Array }) => void) => void; removeEventListener: (t: string, f: (e: { data: Uint8Array }) => void) => void };
type MidiAccessLike = { inputs: Map<string, MidiInputLike>; onstatechange: (() => void) | null };

export const midiSupported = () => typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

/** Podłącza wszystkie wejścia MIDI (także podłączone później). Zwraca funkcję rozłączającą. */
export async function connectMidi(onEvent: (e: MidiEvent) => void, onDevices: (names: string[]) => void): Promise<() => void> {
  const access = (await (navigator as unknown as { requestMIDIAccess: () => Promise<MidiAccessLike> }).requestMIDIAccess()) as MidiAccessLike;
  const attached = new Map<MidiInputLike, (e: { data: Uint8Array }) => void>();
  const sync = () => {
    access.inputs.forEach((input) => {
      if (attached.has(input)) return;
      const h = (e: { data: Uint8Array }) => { const ev = decodeMidi(e.data); if (ev) onEvent(ev); };
      input.addEventListener("midimessage", h);
      attached.set(input, h);
    });
    onDevices([...access.inputs.values()].map((i) => i.name || "Urządzenie MIDI"));
  };
  sync();
  access.onstatechange = sync;
  return () => { access.onstatechange = null; attached.forEach((h, i) => i.removeEventListener("midimessage", h)); };
}

// ── Nagrywanie wyjścia instrumentu (bezstratnie, PCM z AudioWorklet) ────────────
const TAP_SRC = `class T extends AudioWorkletProcessor{constructor(){super();this.on=true;this.port.onmessage=e=>{if(e.data==="stop")this.on=false}}
process(i){const c=i[0];if(c&&c.length)this.port.postMessage(c.map(x=>x.slice(0)));return this.on}}registerProcessor("grouai-tap",T);`;
const tapReady = new WeakMap<BaseAudioContext, Promise<void>>();

export class InstrumentRecorder {
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[][] = [];
  private sink: GainNode | null = null;
  constructor(private ctx: AudioContext, private source: AudioNode) {}

  async start() {
    let ready = tapReady.get(this.ctx);
    if (!ready) {
      const url = URL.createObjectURL(new Blob([TAP_SRC], { type: "application/javascript" }));
      ready = this.ctx.audioWorklet.addModule(url);
      tapReady.set(this.ctx, ready);
    }
    await ready;
    this.chunks = [];
    this.node = new AudioWorkletNode(this.ctx, "grouai-tap", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: "explicit" });
    this.node.port.onmessage = (e: MessageEvent<Float32Array[]>) => this.chunks.push(e.data);
    this.sink = this.ctx.createGain(); this.sink.gain.value = 0;
    this.source.connect(this.node);
    this.node.connect(this.sink).connect(this.ctx.destination);
  }

  /** Kończy nagranie; obcina ciszę na początku i końcu. Zwraca null, jeśli nic nie zagrało. */
  stop(): AudioBuffer | null {
    if (!this.node) return null;
    this.node.port.postMessage("stop");
    try { this.source.disconnect(this.node); } catch { /* już odłączony */ }
    this.node.disconnect(); this.sink?.disconnect();
    this.node = null;
    const total = this.chunks.reduce((s, c) => s + c[0].length, 0);
    if (!total) return null;
    const chans = Math.max(...this.chunks.map((c) => c.length));
    const data = Array.from({ length: chans }, () => new Float32Array(total));
    let o = 0;
    for (const c of this.chunks) { for (let ch = 0; ch < chans; ch++) data[ch].set(c[ch] ?? c[0], o); o += c[0].length; }
    const loud = (i: number) => data.some((d) => Math.abs(d[i]) > 0.0015);
    let a = 0, b = total - 1;
    while (a < total && !loud(a)) a++;
    while (b > a && !loud(b)) b--;
    if (a >= b) return null;
    a = Math.max(0, a - Math.floor(this.ctx.sampleRate * 0.01));
    b = Math.min(total - 1, b + Math.floor(this.ctx.sampleRate * 0.3));
    const buf = this.ctx.createBuffer(chans, b - a + 1, this.ctx.sampleRate);
    data.forEach((d, ch) => buf.copyToChannel(d.subarray(a, b + 1), ch));
    return buf;
  }
}
