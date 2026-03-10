/**
 * Professional DJ Audio Mixer using Web Audio API
 * Smooth crossfades, DJ effects, beat-synced transitions.
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
 * Professional DJ sound effects using oscillators and noise.
 * Each effect is crafted to sound like real club DJ gear.
 */
export const playDJEffect = (type: "horn" | "scratch" | "drop" | "siren" | "buildup" | "rewind" | "laser" | "riser" | "impact") => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    switch (type) {
      case "horn": {
        // Classic air horn — layered oscillators for fullness
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = "sawtooth";
        osc2.type = "square";
        osc1.frequency.setValueAtTime(520, now);
        osc1.frequency.linearRampToValueAtTime(980, now + 0.08);
        osc1.frequency.setValueAtTime(980, now + 0.08);
        osc2.frequency.setValueAtTime(523, now);
        osc2.frequency.linearRampToValueAtTime(985, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.setValueAtTime(0.25, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.9);
        osc2.stop(now + 0.9);
        break;
      }
      case "scratch": {
        // Vinyl scratch — rapid frequency sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(3000, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(2500, now + 0.18);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.25);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case "drop": {
        // Deep bass drop with sub-bass rumble
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        const subGain = ctx.createGain();
        osc.type = "sine";
        sub.type = "sine";
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);
        sub.frequency.setValueAtTime(60, now);
        sub.frequency.exponentialRampToValueAtTime(25, now + 0.8);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        subGain.gain.setValueAtTime(0.3, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        osc.connect(gain).connect(ctx.destination);
        sub.connect(subGain).connect(ctx.destination);
        osc.start(now);
        sub.start(now);
        osc.stop(now + 1.0);
        sub.stop(now + 1.2);
        break;
      }
      case "siren": {
        // Club siren — two cycles
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1400, now + 0.25);
        osc.frequency.linearRampToValueAtTime(600, now + 0.5);
        osc.frequency.linearRampToValueAtTime(1400, now + 0.75);
        osc.frequency.linearRampToValueAtTime(600, now + 1.0);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.1);
        break;
      }
      case "buildup": {
        // Tension riser — filtered noise-like sweep building to climax
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc2.type = "square";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(5000, now + 2.5);
        osc2.frequency.setValueAtTime(82, now);
        osc2.frequency.exponentialRampToValueAtTime(5010, now + 2.5);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 2.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 2.5);
        osc2.stop(now + 2.5);
        break;
      }
      case "rewind": {
        // Tape rewind effect
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      case "laser": {
        // Laser zap effect
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(4000, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "riser": {
        // Quick energy riser for transitions
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(3000, now + 1.0);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.9);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
        break;
      }
      case "impact": {
        // Heavy impact hit
        const osc = ctx.createOscillator();
        const noise = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        noise.type = "sawtooth";
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        noise.frequency.setValueAtTime(800, now);
        noise.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain);
        noise.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        noise.start(now);
        osc.stop(now + 0.5);
        noise.stop(now + 0.15);
        break;
      }
    }
  } catch (e) {
    console.warn("DJ effect failed:", e);
  }
};

/** Pick a random DJ effect for transitions */
export const playRandomTransitionEffect = () => {
  const effects: Array<"horn" | "scratch" | "drop" | "siren" | "rewind" | "laser" | "riser" | "impact"> = [
    "horn", "scratch", "drop", "siren", "rewind", "laser", "riser", "impact"
  ];
  const effect = effects[Math.floor(Math.random() * effects.length)];
  playDJEffect(effect);
};
