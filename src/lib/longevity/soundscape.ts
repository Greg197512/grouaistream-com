/**
 * Silnik dźwięku sesji — synteza w Web Audio API.
 *
 * Tła nie są plikami audio, tylko generowane w przeglądarce: szum filtrowany
 * (deszcz, ocean, las), drony harmoniczne i dudnienia binauralne. Dzięki temu
 * sesja startuje natychmiast, działa offline i nie zużywa transferu, a długość
 * jest dowolna — nie ma słyszalnej pętli.
 *
 * Warstwa lektorska i utwory muzyczne dochodzą osobno, z platformy
 * Grouaistream (patrz `grouaistreamTag` w katalogu sesji).
 */

import type { SoundscapeId } from "./meditations";

interface EngineState {
  ctx: AudioContext;
  master: GainNode;
  nodes: AudioNode[];
  timers: number[];
}

let engine: EngineState | null = null;

/**
 * Bufor szumu różowego (1/f). Szum biały brzmi ostro i męczy po kilku minutach;
 * różowy ma rozkład energii bliższy dźwiękom naturalnym.
 * Implementacja: filtr Voss-McCartney w wersji Paula Kellета (7 biegunów).
 */
const createPinkNoiseBuffer = (ctx: AudioContext, seconds = 4): AudioBuffer => {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
};

const noiseSource = (ctx: AudioContext): AudioBufferSourceNode => {
  const src = ctx.createBufferSource();
  src.buffer = createPinkNoiseBuffer(ctx);
  src.loop = true;
  return src;
};

/** Powolna modulacja parametru — nadaje „oddech” statycznym warstwom. */
const lfo = (
  ctx: AudioContext,
  target: AudioParam,
  frequency: number,
  depth: number,
): { osc: OscillatorNode; gain: GainNode } => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  gain.gain.value = depth;
  osc.connect(gain).connect(target);
  osc.start();
  return { osc, gain };
};

/** Dudnienie binauralne: dwa czyste tony różniące się o `beatHz`. */
const binaural = (ctx: AudioContext, out: AudioNode, baseHz: number, beatHz: number): AudioNode[] => {
  const merger = ctx.createChannelMerger(2);
  const left = ctx.createOscillator();
  const right = ctx.createOscillator();
  const leftGain = ctx.createGain();
  const rightGain = ctx.createGain();

  left.type = "sine";
  right.type = "sine";
  left.frequency.value = baseHz;
  right.frequency.value = baseHz + beatHz;
  leftGain.gain.value = 0.16;
  rightGain.gain.value = 0.16;

  left.connect(leftGain).connect(merger, 0, 0);
  right.connect(rightGain).connect(merger, 0, 1);
  merger.connect(out);
  left.start();
  right.start();

  return [left, right, leftGain, rightGain, merger];
};

/** Dron harmoniczny — kilka detuneowanych pił przez filtr dolnoprzepustowy. */
const drone = (ctx: AudioContext, out: AudioNode, rootHz: number, warm: boolean): AudioNode[] => {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = warm ? 700 : 320;
  filter.Q.value = 0.7;
  filter.connect(out);

  const nodes: AudioNode[] = [filter];
  // Kwinta i oktawa — interwały bez napięcia harmonicznego.
  const ratios = warm ? [1, 1.5, 2, 3] : [0.5, 1, 1.5];
  ratios.forEach((ratio, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index === 0 ? "sine" : "triangle";
    osc.frequency.value = rootHz * ratio;
    osc.detune.value = (index - 1) * 4;
    gain.gain.value = 0.12 / (index + 1);
    osc.connect(gain).connect(filter);
    osc.start();
    nodes.push(osc, gain);
    // Lekka modulacja głośności każdej warstwy — inaczej dron brzmi martwo.
    const mod = lfo(ctx, gain.gain, 0.03 + index * 0.017, 0.03);
    nodes.push(mod.osc, mod.gain);
  });

  return nodes;
};

/** Deszcz: szum różowy przez pasmo górne + rzadkie „krople” w wyższym rejestrze. */
const rain = (ctx: AudioContext, out: AudioNode): AudioNode[] => {
  const src = noiseSource(ctx);
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 900;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.value = 0.55;

  src.connect(highpass).connect(lowpass).connect(gain).connect(out);
  src.start();

  const mod = lfo(ctx, gain.gain, 0.07, 0.08);
  return [src, highpass, lowpass, gain, mod.osc, mod.gain];
};

/** Ocean: szum dolnoprzepustowy z falą 0,1 Hz — około 6 fal na minutę. */
const ocean = (ctx: AudioContext, out: AudioNode): AudioNode[] => {
  const src = noiseSource(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 600;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = 0.42;

  src.connect(filter).connect(gain).connect(out);
  src.start();

  // 0,1 Hz = jedna fala na 10 sekund; ten sam rytm co spokojny oddech.
  const swell = lfo(ctx, gain.gain, 0.1, 0.3);
  const sweep = lfo(ctx, filter.frequency, 0.1, 350);
  return [src, filter, gain, swell.osc, swell.gain, sweep.osc, sweep.gain];
};

/** Las: szum liści (pasmo średnie) + okazjonalne ćwierkanie z syntezy FM. */
const forest = (ctx: AudioContext, out: AudioNode): { nodes: AudioNode[]; timers: number[] } => {
  const src = noiseSource(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 0.6;
  const gain = ctx.createGain();
  gain.gain.value = 0.22;
  src.connect(filter).connect(gain).connect(out);
  src.start();

  const nodes: AudioNode[] = [src, filter, gain];
  const timers: number[] = [];

  const chirp = () => {
    if (!engine) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const base = 2400 + Math.random() * 1800;
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(base * 0.85, now + 0.2);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(env).connect(out);
    osc.start(now);
    osc.stop(now + 0.3);
    timers.push(window.setTimeout(chirp, 1500 + Math.random() * 6000));
  };
  timers.push(window.setTimeout(chirp, 1200));

  return { nodes, timers };
};

/** Noc: niski szum + cykanie owadów w regularnym, cichym rytmie. */
const night = (ctx: AudioContext, out: AudioNode): { nodes: AudioNode[]; timers: number[] } => {
  const src = noiseSource(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  src.connect(filter).connect(gain).connect(out);
  src.start();

  const nodes: AudioNode[] = [src, filter, gain];
  const timers: number[] = [];

  const cricket = () => {
    if (!engine) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 4300 + Math.random() * 400;
      const t = now + i * 0.09;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.025, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(env).connect(out);
      osc.start(t);
      osc.stop(t + 0.08);
    }
    timers.push(window.setTimeout(cricket, 2500 + Math.random() * 3500));
  };
  timers.push(window.setTimeout(cricket, 900));

  return { nodes, timers };
};

const buildLayer = (
  id: SoundscapeId,
  ctx: AudioContext,
  out: GainNode,
): { nodes: AudioNode[]; timers: number[] } => {
  switch (id) {
    case "rain":
      return { nodes: rain(ctx, out), timers: [] };
    case "ocean":
      return { nodes: ocean(ctx, out), timers: [] };
    case "forest":
      return forest(ctx, out);
    case "night":
      return night(ctx, out);
    case "drone-warm":
      return { nodes: drone(ctx, out, 110, true), timers: [] };
    case "drone-deep":
      return { nodes: drone(ctx, out, 55, false), timers: [] };
    case "binaural-alpha":
      // Nośna 200 Hz jest dobrze słyszalna, a różnica 10 Hz mieści się w paśmie alfa.
      return { nodes: [...binaural(ctx, out, 200, 10), ...drone(ctx, out, 110, true)], timers: [] };
    case "binaural-theta":
      return { nodes: [...binaural(ctx, out, 180, 6), ...drone(ctx, out, 90, true)], timers: [] };
    case "binaural-delta":
      return { nodes: [...binaural(ctx, out, 140, 2.5), ...drone(ctx, out, 55, false)], timers: [] };
    case "silence":
    default:
      return { nodes: [], timers: [] };
  }
};

export interface SoundscapeHandle {
  /** Zmienia głośność 0–1 z płynnym przejściem. */
  setVolume: (value: number) => void;
  /** Wygasza i zwalnia zasoby. */
  stop: (fadeSeconds?: number) => void;
  /** Czy silnik nadal gra. */
  isPlaying: () => boolean;
}

/**
 * Uruchamia tło dźwiękowe. Wymaga gestu użytkownika (polityka autoplay),
 * dlatego wywołujemy to wyłącznie z handlera kliknięcia.
 */
export const startSoundscape = (id: SoundscapeId, volume = 0.5): SoundscapeHandle => {
  stopSoundscape(0);

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const layer = buildLayer(id, ctx, master);
  engine = { ctx, master, nodes: layer.nodes, timers: layer.timers };

  // Wejście przez fade — nagły start szumu wybija ze skupienia.
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime + 2);

  return {
    setVolume: (value: number) => {
      if (!engine) return;
      engine.master.gain.cancelScheduledValues(engine.ctx.currentTime);
      engine.master.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, value)),
        engine.ctx.currentTime + 0.25,
      );
    },
    stop: (fadeSeconds = 1.5) => stopSoundscape(fadeSeconds),
    isPlaying: () => engine !== null,
  };
};

export const stopSoundscape = (fadeSeconds = 1.5): void => {
  const current = engine;
  if (!current) return;
  engine = null;

  current.timers.forEach((t) => window.clearTimeout(t));

  const finish = () => {
    current.nodes.forEach((node) => {
      try {
        if ("stop" in node && typeof (node as OscillatorNode).stop === "function") {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // Węzeł mógł już zostać zatrzymany — to nie jest błąd.
      }
    });
    current.master.disconnect();
    void current.ctx.close();
  };

  if (fadeSeconds <= 0) {
    finish();
    return;
  }

  const now = current.ctx.currentTime;
  current.master.gain.cancelScheduledValues(now);
  current.master.gain.setValueAtTime(current.master.gain.value, now);
  current.master.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
  window.setTimeout(finish, fadeSeconds * 1000 + 100);
};

/** Krótki sygnał końca fazy oddechu — cichy, bez ostrego ataku. */
export const playCue = (frequency = 528, durationMs = 220): void => {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.05);
    window.setTimeout(() => void ctx.close(), durationMs + 200);
  } catch {
    // Brak Web Audio (np. render serwerowy) — sygnał jest opcjonalny.
  }
};
