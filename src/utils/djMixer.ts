/**
 * Professional DJ Audio Mixer — Rotterdam/Dutch Hard Techno Style
 * Web Audio API: crossfades, industrial effects, peak-time transitions.
 */

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
};

export interface CrossfadeOptions {
  duration?: number;
  curve?: "linear" | "exponential" | "equal-power";
}

/** Fade out an audio element smoothly */
export const fadeOut = (
  audio: HTMLAudioElement,
  durationSec = 3,
  curve: "linear" | "exponential" | "equal-power" = "equal-power"
): Promise<void> => {
  return new Promise((resolve) => {
    const startVolume = audio.volume;
    const steps = 40;
    const stepTime = (durationSec * 1000) / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      let mult: number;
      switch (curve) {
        case "exponential": mult = Math.pow(1 - progress, 3); break;
        case "equal-power": mult = Math.cos(progress * Math.PI * 0.5); break;
        default: mult = 1 - progress;
      }
      audio.volume = Math.max(0, startVolume * mult);
      if (step >= steps) { clearInterval(interval); audio.volume = 0; resolve(); }
    }, stepTime);
  });
};

/** Fade in an audio element smoothly */
export const fadeIn = (
  audio: HTMLAudioElement,
  targetVolume: number,
  durationSec = 3,
  curve: "linear" | "exponential" | "equal-power" = "equal-power"
): Promise<void> => {
  return new Promise((resolve) => {
    audio.volume = 0;
    const steps = 40;
    const stepTime = (durationSec * 1000) / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      let mult: number;
      switch (curve) {
        case "exponential": mult = Math.pow(progress, 2); break;
        case "equal-power": mult = Math.sin(progress * Math.PI * 0.5); break;
        default: mult = progress;
      }
      audio.volume = Math.min(targetVolume, targetVolume * mult);
      if (step >= steps) { clearInterval(interval); audio.volume = targetVolume; resolve(); }
    }, stepTime);
  });
};

/** Crossfade between two audio elements */
export const crossfade = async (
  currentAudio: HTMLAudioElement,
  nextAudio: HTMLAudioElement,
  targetVolume: number,
  options: CrossfadeOptions = {}
): Promise<void> => {
  const { duration = 3, curve = "equal-power" } = options;
  await Promise.all([
    fadeOut(currentAudio, duration, curve),
    fadeIn(nextAudio, targetVolume, duration, curve),
  ]);
};

/**
 * Rotterdam/Dutch Hard Techno DJ Effects
 * Industrial kick, distorted sub-bass, dark risers, raw impacts.
 */
export type DJEffectType = 
  | "horn" | "scratch" | "drop" | "siren" | "buildup" 
  | "rewind" | "laser" | "riser" | "impact"
  | "industrial_kick" | "distorted_sub" | "dark_riser" | "hard_drop" | "stab";

export const playDJEffect = (type: DJEffectType) => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    switch (type) {
      case "horn": {
        // Hard techno air horn — aggressive, short
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const dist = ctx.createWaveShaper();
        const gain = ctx.createGain();
        osc1.type = "sawtooth";
        osc2.type = "square";
        osc1.frequency.setValueAtTime(520, now);
        osc1.frequency.linearRampToValueAtTime(1100, now + 0.06);
        osc2.frequency.setValueAtTime(525, now);
        osc2.frequency.linearRampToValueAtTime(1105, now + 0.06);
        // Add distortion for harder sound
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
        }
        dist.curve = curve;
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.setValueAtTime(0.28, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc1.connect(dist);
        osc2.connect(dist);
        dist.connect(gain).connect(ctx.destination);
        osc1.start(now); osc2.start(now);
        osc1.stop(now + 0.7); osc2.stop(now + 0.7);
        break;
      }
      case "scratch": {
        // Hard vinyl scratch
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(4000, now + 0.03);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(3500, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.22);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.25);
        break;
      }
      case "drop":
      case "hard_drop": {
        // Rotterdam-style heavy bass drop with distortion
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const dist = ctx.createWaveShaper();
        const gain = ctx.createGain();
        const subGain = ctx.createGain();
        osc.type = "sine";
        sub.type = "sine";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.3);
        sub.frequency.setValueAtTime(55, now);
        sub.frequency.exponentialRampToValueAtTime(20, now + 1.0);
        const dropCurve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          dropCurve[i] = Math.tanh(x * 3);
        }
        dist.curve = dropCurve;
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        subGain.gain.setValueAtTime(0.35, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        osc.connect(dist).connect(gain).connect(ctx.destination);
        sub.connect(subGain).connect(ctx.destination);
        osc.start(now); sub.start(now);
        osc.stop(now + 0.8); sub.stop(now + 1.2);
        break;
      }
      case "industrial_kick": {
        // Rotterdam industrial kick — punchy, distorted, short
        const osc = ctx.createOscillator();
        const noise = ctx.createOscillator();
        const dist = ctx.createWaveShaper();
        const gain = ctx.createGain();
        osc.type = "sine";
        noise.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
        noise.frequency.setValueAtTime(1200, now);
        noise.frequency.exponentialRampToValueAtTime(80, now + 0.04);
        const kickCurve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          kickCurve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.5);
        }
        dist.curve = kickCurve;
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(dist);
        noise.connect(dist);
        dist.connect(gain).connect(ctx.destination);
        osc.start(now); noise.start(now);
        osc.stop(now + 0.2); noise.stop(now + 0.06);
        break;
      }
      case "distorted_sub": {
        // Heavy distorted sub-bass rumble
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const dist = ctx.createWaveShaper();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc2.type = "sine";
        osc.frequency.setValueAtTime(35, now);
        osc2.frequency.setValueAtTime(36, now); // slight detune for width
        const subCurve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          subCurve[i] = Math.tanh(x * 5);
        }
        dist.curve = subCurve;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.setValueAtTime(0.3, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        osc.connect(dist);
        osc2.connect(dist);
        dist.connect(gain).connect(ctx.destination);
        osc.start(now); osc2.start(now);
        osc.stop(now + 1.5); osc2.stop(now + 1.5);
        break;
      }
      case "dark_riser": {
        // Dark tension riser — filtered noise sweep, longer
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc2.type = "square";
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(6000, now + 3.0);
        osc2.frequency.setValueAtTime(52, now);
        osc2.frequency.exponentialRampToValueAtTime(6010, now + 3.0);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 2.8);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);
        osc.connect(gain); osc2.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now); osc2.start(now);
        osc.stop(now + 3.0); osc2.stop(now + 3.0);
        break;
      }
      case "stab": {
        // Hard techno stab — short, aggressive chord hit
        const oscs: OscillatorNode[] = [];
        const gain = ctx.createGain();
        const freqs = [220, 277, 330, 440]; // dark minor stab
        for (const freq of freqs) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(freq, now);
          o.connect(gain);
          o.start(now);
          o.stop(now + 0.15);
          oscs.push(o);
        }
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        gain.connect(ctx.destination);
        break;
      }
      case "siren": {
        // Dark siren — lower frequency, menacing
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.3);
        osc.frequency.linearRampToValueAtTime(400, now + 0.6);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.9);
        osc.frequency.linearRampToValueAtTime(400, now + 1.2);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 1.3);
        break;
      }
      case "buildup": {
        // Hard techno buildup — aggressive riser with sub rumble
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        const subGain = ctx.createGain();
        osc.type = "sawtooth";
        osc2.type = "square";
        sub.type = "sine";
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(6000, now + 2.5);
        osc2.frequency.setValueAtTime(62, now);
        osc2.frequency.exponentialRampToValueAtTime(6010, now + 2.5);
        sub.frequency.setValueAtTime(30, now);
        sub.frequency.setValueAtTime(30, now + 2.0);
        sub.frequency.exponentialRampToValueAtTime(60, now + 2.5);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 2.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
        subGain.gain.setValueAtTime(0.15, now);
        subGain.gain.linearRampToValueAtTime(0.3, now + 2.2);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
        osc.connect(gain); osc2.connect(gain);
        sub.connect(subGain);
        gain.connect(ctx.destination);
        subGain.connect(ctx.destination);
        osc.start(now); osc2.start(now); sub.start(now);
        osc.stop(now + 2.5); osc2.stop(now + 2.5); sub.stop(now + 2.5);
        break;
      }
      case "rewind": {
        // Tape rewind
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(2500, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.6);
        break;
      }
      case "laser": {
        // Laser zap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(4500, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.15);
        break;
      }
      case "riser": {
        // Quick energy riser
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(3500, now + 0.8);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.8);
        break;
      }
      case "impact": {
        // Heavy industrial impact
        const osc = ctx.createOscillator();
        const noise = ctx.createOscillator();
        const dist = ctx.createWaveShaper();
        const gain = ctx.createGain();
        osc.type = "sine";
        noise.type = "sawtooth";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.25);
        noise.frequency.setValueAtTime(1000, now);
        noise.frequency.exponentialRampToValueAtTime(40, now + 0.08);
        const impCurve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          impCurve[i] = Math.tanh(x * 4);
        }
        dist.curve = impCurve;
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.connect(dist);
        noise.connect(dist);
        dist.connect(gain).connect(ctx.destination);
        osc.start(now); noise.start(now);
        osc.stop(now + 0.4); noise.stop(now + 0.1);
        break;
      }
    }
  } catch (e) {
    console.warn("DJ effect failed:", e);
  }
};

/** Pick a random hard techno transition effect */
export const playRandomTransitionEffect = () => {
  const effects: DJEffectType[] = [
    "industrial_kick", "scratch", "hard_drop", "stab", 
    "rewind", "laser", "riser", "impact", "distorted_sub"
  ];
  const effect = effects[Math.floor(Math.random() * effects.length)];
  playDJEffect(effect);
};

/** Play a combo of effects for maximum impact (used on drops) */
export const playDropCombo = () => {
  playDJEffect("industrial_kick");
  setTimeout(() => playDJEffect("hard_drop"), 80);
  setTimeout(() => playDJEffect("distorted_sub"), 200);
};
