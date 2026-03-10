/**
 * DJ Audio Crossfade Mixer using Web Audio API
 * Provides smooth transitions between tracks with configurable crossfade duration.
 */

let audioContext: AudioContext | null = null;
let currentGainNode: GainNode | null = null;
let nextGainNode: GainNode | null = null;

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
  duration?: number; // crossfade duration in seconds (default 3)
  curve?: "linear" | "exponential" | "equal-power"; // fade curve type
}

/**
 * Apply a crossfade-out to the current audio element.
 * Gradually reduces volume to 0 over the specified duration.
 */
export const fadeOut = (
  audio: HTMLAudioElement,
  durationSec = 3,
  curve: "linear" | "exponential" | "equal-power" = "equal-power"
): Promise<void> => {
  return new Promise((resolve) => {
    const startVolume = audio.volume;
    const steps = 30; // 30 steps for smooth fade
    const stepTime = (durationSec * 1000) / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;

      let volumeMultiplier: number;
      switch (curve) {
        case "exponential":
          volumeMultiplier = Math.pow(1 - progress, 3);
          break;
        case "equal-power":
          volumeMultiplier = Math.cos(progress * Math.PI * 0.5);
          break;
        default: // linear
          volumeMultiplier = 1 - progress;
      }

      audio.volume = Math.max(0, startVolume * volumeMultiplier);

      if (step >= steps) {
        clearInterval(interval);
        audio.volume = 0;
        resolve();
      }
    }, stepTime);
  });
};

/**
 * Apply a crossfade-in to an audio element.
 * Gradually increases volume from 0 to targetVolume.
 */
export const fadeIn = (
  audio: HTMLAudioElement,
  targetVolume: number,
  durationSec = 3,
  curve: "linear" | "exponential" | "equal-power" = "equal-power"
): Promise<void> => {
  return new Promise((resolve) => {
    audio.volume = 0;
    const steps = 30;
    const stepTime = (durationSec * 1000) / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;

      let volumeMultiplier: number;
      switch (curve) {
        case "exponential":
          volumeMultiplier = Math.pow(progress, 2);
          break;
        case "equal-power":
          volumeMultiplier = Math.sin(progress * Math.PI * 0.5);
          break;
        default:
          volumeMultiplier = progress;
      }

      audio.volume = Math.min(targetVolume, targetVolume * volumeMultiplier);

      if (step >= steps) {
        clearInterval(interval);
        audio.volume = targetVolume;
        resolve();
      }
    }, stepTime);
  });
};

/**
 * Perform a crossfade between two audio elements.
 * Fades out current while fading in next simultaneously.
 */
export const crossfade = async (
  currentAudio: HTMLAudioElement,
  nextAudio: HTMLAudioElement,
  targetVolume: number,
  options: CrossfadeOptions = {}
): Promise<void> => {
  const { duration = 3, curve = "equal-power" } = options;

  // Start both fades simultaneously
  await Promise.all([
    fadeOut(currentAudio, duration, curve),
    fadeIn(nextAudio, targetVolume, duration, curve),
  ]);
};

/**
 * Generate a DJ sound effect (air horn, record scratch, etc.) using oscillators.
 */
export const playDJEffect = (type: "horn" | "scratch" | "drop" | "siren" | "buildup") => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    switch (type) {
      case "horn": {
        // Air horn sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }
      case "scratch": {
        // Record scratch
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case "drop": {
        // Bass drop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
        break;
      }
      case "siren": {
        // DJ siren
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
        osc.frequency.linearRampToValueAtTime(600, now + 0.6);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.9);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.0);
        break;
      }
      case "buildup": {
        // Tension buildup (rising noise)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(4000, now + 2.0);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 1.8);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.0);
        break;
      }
    }
  } catch (e) {
    console.warn("DJ effect failed:", e);
  }
};

/** Pick a random DJ effect for transitions */
export const playRandomTransitionEffect = () => {
  const effects: Array<"horn" | "scratch" | "drop" | "siren"> = ["horn", "scratch", "drop", "siren"];
  const effect = effects[Math.floor(Math.random() * effects.length)];
  playDJEffect(effect);
};
