/**
 * Advanced Algorithmic Music Generator using Web Audio API
 * Rich layered synthesis with reverb, delay, compression, detuned oscillators
 */

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

const PROGRESSIONS: Record<string, number[][]> = {
  Pop: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
  Rock: [[0, 4, 7], [5, 9, 12], [3, 7, 10], [5, 9, 12]],
  "Hip-Hop": [[0, 3, 7], [5, 8, 12], [3, 7, 10], [0, 3, 7]],
  Electronic: [[0, 4, 7], [0, 5, 9], [0, 4, 7, 11], [0, 3, 7]],
  Jazz: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [0, 4, 7, 10]],
  Classical: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
  "Lo-fi": [[0, 4, 7, 11], [2, 5, 9, 12], [4, 7, 11, 14], [0, 3, 7, 10]],
  Ambient: [[0, 7, 12], [5, 12, 17], [7, 14, 19], [0, 7, 12]],
  Metal: [[0, 7], [5, 12], [3, 10], [1, 8]],
  "R&B": [[0, 4, 7, 11], [2, 5, 9, 14], [5, 9, 12, 16], [0, 4, 7, 11]],
  Reggae: [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]],
  Trap: [[0, 3, 7], [0, 3, 7], [5, 8, 12], [3, 7, 10]],
  House: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
  Disco: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 5, 9]],
  Indie: [[0, 4, 7], [2, 5, 9], [4, 7, 11], [5, 9, 12]],
  Country: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
};

const BPM_RANGES: Record<string, [number, number]> = {
  Pop: [110, 130], Rock: [120, 150], "Hip-Hop": [80, 100],
  Electronic: [125, 140], Jazz: [100, 140], Classical: [70, 110],
  "Lo-fi": [70, 90], Ambient: [60, 80], Metal: [140, 180],
  "R&B": [85, 105], Reggae: [70, 90], Trap: [130, 160],
  House: [120, 130], Disco: [115, 130], Indie: [100, 130], Country: [100, 130],
};

const DRUM_PATTERNS: Record<string, { kick: number[]; snare: number[]; hihat: number[]; perc: number[] }> = {
  Pop:        { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], perc: [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0] },
  Rock:       { kick: [1,0,0,0, 1,0,0,0, 1,0,1,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], perc: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0] },
  "Hip-Hop":  { kick: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], perc: [0,0,1,0, 0,0,0,0, 0,1,0,0, 0,0,0,1] },
  Electronic: { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1], perc: [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0] },
  Jazz:       { kick: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0], snare: [0,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,1,0], hihat: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0], perc: [0,1,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0] },
  Classical:  { kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], hihat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], perc: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
  "Lo-fi":    { kick: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], perc: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1] },
  Ambient:    { kick: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], hihat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], perc: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
  Metal:      { kick: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], perc: [0,0,0,1, 0,0,0,1, 0,0,0,1, 0,0,0,1] },
  "R&B":      { kick: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1], perc: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0] },
  Reggae:     { kick: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0], snare: [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], perc: [0,1,0,0, 0,1,0,0, 0,1,0,0, 0,1,0,0] },
  Trap:       { kick: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], perc: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0] },
  House:      { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], perc: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1] },
  Disco:      { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], perc: [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0] },
  Indie:      { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], perc: [0,0,0,0, 0,0,0,0, 0,1,0,0, 0,0,0,0] },
  Country:    { kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], perc: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
};

// Style-specific sound parameters
interface StyleParams {
  melodyWaves: OscillatorType[];
  melodyDetune: number;
  chordWaves: OscillatorType[];
  chordDetune: number;
  bassWaves: OscillatorType[];
  bassDetune: number;
  padWave: OscillatorType;
  reverbDecay: number;
  reverbMix: number;
  delayTime: number;
  delayFeedback: number;
  filterFreq: number;
  filterQ: number;
  melodyVol: number;
  chordVol: number;
  bassVol: number;
  padVol: number;
  drumVol: number;
  useSubBass: boolean;
  usePad: boolean;
  arpSpeed: number; // 0 = no arp, 1-4 = subdivisions
}

function getStyleParams(style: string): StyleParams {
  const defaults: StyleParams = {
    melodyWaves: ['triangle', 'sine'], melodyDetune: 8,
    chordWaves: ['triangle', 'sine'], chordDetune: 12,
    bassWaves: ['sine', 'triangle'], bassDetune: 3,
    padWave: 'sine', reverbDecay: 2.5, reverbMix: 0.25,
    delayTime: 0.3, delayFeedback: 0.2,
    filterFreq: 2000, filterQ: 1,
    melodyVol: 0.12, chordVol: 0.08, bassVol: 0.18,
    padVol: 0.06, drumVol: 0.3,
    useSubBass: false, usePad: false, arpSpeed: 0,
  };

  switch (style) {
    case 'Pop': return { ...defaults, melodyWaves: ['triangle', 'square'], melodyDetune: 10, chordWaves: ['triangle', 'sine'], chordDetune: 15, usePad: true, padVol: 0.04, reverbMix: 0.2, filterFreq: 3000 };
    case 'Rock': return { ...defaults, melodyWaves: ['sawtooth', 'square'], melodyDetune: 15, chordWaves: ['sawtooth', 'sawtooth'], chordDetune: 20, bassWaves: ['sawtooth', 'square'], bassDetune: 5, drumVol: 0.38, reverbDecay: 1.5, reverbMix: 0.15, filterFreq: 4000, filterQ: 2 };
    case 'Metal': return { ...defaults, melodyWaves: ['sawtooth', 'sawtooth'], melodyDetune: 20, chordWaves: ['sawtooth', 'square'], chordDetune: 25, bassWaves: ['sawtooth', 'square'], bassDetune: 8, drumVol: 0.42, reverbDecay: 1.2, reverbMix: 0.12, filterFreq: 5000, filterQ: 3, useSubBass: true };
    case 'Electronic': return { ...defaults, melodyWaves: ['sawtooth', 'square'], melodyDetune: 12, chordWaves: ['square', 'sawtooth'], chordDetune: 18, bassWaves: ['sawtooth', 'sine'], useSubBass: true, usePad: true, padVol: 0.05, reverbMix: 0.3, delayTime: 0.375, delayFeedback: 0.35, filterFreq: 2500, arpSpeed: 2 };
    case 'House': return { ...defaults, melodyWaves: ['sawtooth', 'triangle'], melodyDetune: 10, chordWaves: ['triangle', 'sine'], useSubBass: true, usePad: true, padVol: 0.06, reverbMix: 0.35, delayTime: 0.25, delayFeedback: 0.3, filterFreq: 2200, arpSpeed: 2 };
    case 'Trap': return { ...defaults, melodyWaves: ['square', 'sine'], melodyDetune: 6, bassWaves: ['sine', 'sine'], useSubBass: true, drumVol: 0.4, reverbMix: 0.25, delayTime: 0.2, delayFeedback: 0.15, filterFreq: 1800 };
    case 'Jazz': return { ...defaults, melodyWaves: ['sine', 'triangle'], melodyDetune: 4, chordWaves: ['sine', 'triangle'], chordDetune: 6, bassWaves: ['triangle', 'sine'], reverbDecay: 3, reverbMix: 0.35, filterFreq: 1500, filterQ: 0.7, melodyVol: 0.14, chordVol: 0.07, drumVol: 0.22 };
    case 'Classical': return { ...defaults, melodyWaves: ['sine', 'triangle'], melodyDetune: 3, chordWaves: ['sine', 'sine'], chordDetune: 5, usePad: true, padWave: 'sine', padVol: 0.08, reverbDecay: 4, reverbMix: 0.45, drumVol: 0.05, filterFreq: 2000 };
    case 'Ambient': return { ...defaults, melodyWaves: ['sine', 'triangle'], melodyDetune: 5, usePad: true, padWave: 'sine', padVol: 0.12, reverbDecay: 5, reverbMix: 0.55, delayTime: 0.5, delayFeedback: 0.45, drumVol: 0.03, filterFreq: 1200, melodyVol: 0.08 };
    case 'Lo-fi': return { ...defaults, melodyWaves: ['triangle', 'sine'], melodyDetune: 8, chordWaves: ['sine', 'triangle'], usePad: true, padVol: 0.05, reverbDecay: 2.5, reverbMix: 0.3, filterFreq: 1200, filterQ: 1.5, drumVol: 0.25, melodyVol: 0.1 };
    case 'R&B': return { ...defaults, melodyWaves: ['sine', 'triangle'], melodyDetune: 6, chordWaves: ['sine', 'triangle'], chordDetune: 10, usePad: true, padVol: 0.05, reverbDecay: 2.5, reverbMix: 0.3, filterFreq: 1800, drumVol: 0.28 };
    case 'Hip-Hop': return { ...defaults, melodyWaves: ['triangle', 'square'], melodyDetune: 8, bassWaves: ['sine', 'sine'], useSubBass: true, reverbMix: 0.2, filterFreq: 1600, drumVol: 0.35 };
    case 'Reggae': return { ...defaults, melodyWaves: ['sine', 'triangle'], melodyDetune: 5, chordWaves: ['triangle', 'sine'], reverbDecay: 2, reverbMix: 0.25, delayTime: 0.375, delayFeedback: 0.3, filterFreq: 1400, drumVol: 0.25 };
    case 'Disco': return { ...defaults, melodyWaves: ['sawtooth', 'triangle'], melodyDetune: 10, chordWaves: ['triangle', 'sine'], usePad: true, padVol: 0.04, reverbMix: 0.2, filterFreq: 2800, arpSpeed: 2 };
    case 'Indie': return { ...defaults, melodyWaves: ['triangle', 'sawtooth'], melodyDetune: 12, chordWaves: ['triangle', 'sine'], chordDetune: 15, reverbDecay: 3, reverbMix: 0.3, delayTime: 0.35, delayFeedback: 0.25, filterFreq: 2200 };
    case 'Country': return { ...defaults, melodyWaves: ['triangle', 'sine'], melodyDetune: 6, chordWaves: ['triangle', 'sine'], reverbDecay: 2, reverbMix: 0.2, filterFreq: 2500, drumVol: 0.28 };
    default: return defaults;
  }
}

export interface GenerationConfig {
  style: string;
  style2?: string; // For genre blending
  blendRatio?: number; // 0-1, how much of style2 (default 0.5)
  durationSeconds: number;
  instrumental: boolean;
  title?: string;
  prompt?: string; // Full text prompt from user
  mood?: 'dark' | 'bright' | 'melancholic' | 'euphoric' | 'aggressive' | 'dreamy' | 'romantic' | 'tense';
  energy?: 'low' | 'medium' | 'high' | 'extreme';
  tempoOverride?: number; // Exact BPM override
  textContent?: string; // Lyrics/text to weave into the vibe
}

export interface GeneratedTrack {
  id: string;
  title: string;
  style: string;
  duration: number;
  audioBlob: Blob;
  audioUrl: string;
  _bpm?: number;
  _rootMidi?: number;
  _scaleType?: string;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Blend two style params
function blendParams(a: StyleParams, b: StyleParams, ratio: number): StyleParams {
  return {
    melodyWaves: ratio < 0.5 ? a.melodyWaves : b.melodyWaves,
    melodyDetune: lerp(a.melodyDetune, b.melodyDetune, ratio),
    chordWaves: ratio < 0.5 ? a.chordWaves : b.chordWaves,
    chordDetune: lerp(a.chordDetune, b.chordDetune, ratio),
    bassWaves: ratio < 0.5 ? a.bassWaves : b.bassWaves,
    bassDetune: lerp(a.bassDetune, b.bassDetune, ratio),
    padWave: ratio < 0.5 ? a.padWave : b.padWave,
    reverbDecay: lerp(a.reverbDecay, b.reverbDecay, ratio),
    reverbMix: lerp(a.reverbMix, b.reverbMix, ratio),
    delayTime: lerp(a.delayTime, b.delayTime, ratio),
    delayFeedback: lerp(a.delayFeedback, b.delayFeedback, ratio),
    filterFreq: lerp(a.filterFreq, b.filterFreq, ratio),
    filterQ: lerp(a.filterQ, b.filterQ, ratio),
    melodyVol: lerp(a.melodyVol, b.melodyVol, ratio),
    chordVol: lerp(a.chordVol, b.chordVol, ratio),
    bassVol: lerp(a.bassVol, b.bassVol, ratio),
    padVol: lerp(a.padVol, b.padVol, ratio),
    drumVol: lerp(a.drumVol, b.drumVol, ratio),
    useSubBass: ratio < 0.5 ? a.useSubBass : b.useSubBass,
    usePad: a.usePad || b.usePad,
    arpSpeed: ratio < 0.5 ? a.arpSpeed : b.arpSpeed,
  };
}

// Blend drum patterns
function blendDrums(
  d1: { kick: number[]; snare: number[]; hihat: number[]; perc: number[] },
  d2: { kick: number[]; snare: number[]; hihat: number[]; perc: number[] },
  ratio: number
): { kick: number[]; snare: number[]; hihat: number[]; perc: number[] } {
  const blend = (a: number[], b: number[]) => a.map((v, i) => {
    if (v && b[i]) return 1;
    if (v && !b[i]) return Math.random() > ratio ? 1 : 0;
    if (!v && b[i]) return Math.random() < ratio ? 1 : 0;
    return 0;
  });
  return {
    kick: blend(d1.kick, d2.kick),
    snare: blend(d1.snare, d2.snare),
    hihat: blend(d1.hihat, d2.hihat),
    perc: blend(d1.perc, d2.perc),
  };
}

function generateMelodyNotes(scale: number[], bars: number, stepsPerBar: number, rootMidi: number): { note: number; step: number; duration: number }[] {
  const notes: { note: number; step: number; duration: number }[] = [];
  const totalSteps = bars * stepsPerBar;
  let lastDegree = 0;

  for (let step = 0; step < totalSteps; ) {
    if (Math.random() < 0.25) { step++; continue; }
    // Prefer stepwise motion for musicality
    const maxJump = Math.random() < 0.7 ? 2 : scale.length - 1;
    const direction = Math.random() < 0.5 ? 1 : -1;
    const jump = Math.floor(Math.random() * maxJump) + 1;
    lastDegree = Math.max(0, Math.min(scale.length - 1, lastDegree + direction * jump));
    
    const octaveShift = Math.random() < 0.2 ? 12 : 0;
    const note = rootMidi + scale[lastDegree] + octaveShift;
    const dur = randomFromArray([1, 1, 2, 2, 3, 4]);
    const actualDur = Math.min(dur, totalSteps - step);
    notes.push({ note, step, duration: actualDur });
    step += actualDur;
  }
  return notes;
}

// Create impulse response for reverb
function createReverbIR(ctx: OfflineAudioContext, decay: number, sampleRate: number): AudioBuffer {
  const length = sampleRate * decay;
  const ir = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * t / decay) * 0.5;
    }
  }
  return ir;
}

// Rich drum synthesis with layered samples
function synthDrum(ctx: OfflineAudioContext, type: 'kick' | 'snare' | 'hihat' | 'perc', time: number, volume: number, dest: AudioNode) {
  if (type === 'kick') {
    // Layered kick: sub sine + body + click
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, time);
    sub.frequency.exponentialRampToValueAtTime(30, time + 0.2);
    subGain.gain.setValueAtTime(volume * 0.9, time);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    sub.connect(subGain).connect(dest);
    sub.start(time); sub.stop(time + 0.35);

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(160, time);
    body.frequency.exponentialRampToValueAtTime(50, time + 0.08);
    bodyGain.gain.setValueAtTime(volume * 0.6, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    body.connect(bodyGain).connect(dest);
    body.start(time); body.stop(time + 0.15);

    // Click transient
    const clickLen = ctx.sampleRate * 0.008;
    const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) clickData[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(volume * 0.4, time);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass'; clickFilter.frequency.value = 4000; clickFilter.Q.value = 2;
    click.connect(clickFilter).connect(clickGain).connect(dest);
    click.start(time); click.stop(time + 0.01);
  } else if (type === 'snare') {
    // Noise body + tonal body
    const noiseLen = ctx.sampleRate * 0.18;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-8 * i / noiseLen);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass'; bandpass.frequency.value = 3500; bandpass.Q.value = 1.2;
    noise.connect(bandpass).connect(noiseGain).connect(dest);
    noise.start(time); noise.stop(time + 0.2);

    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = 'triangle'; tone.frequency.value = 180;
    toneGain.gain.setValueAtTime(volume * 0.45, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    tone.connect(toneGain).connect(dest);
    tone.start(time); tone.stop(time + 0.12);
  } else if (type === 'hihat') {
    // Metallic noise hihat
    const len = ctx.sampleRate * 0.06;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-15 * i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.22, time);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 10000; bp.Q.value = 1;
    src.connect(hp).connect(bp).connect(gain).connect(dest);
    src.start(time); src.stop(time + 0.06);
  } else {
    // Percussion: rim/clave sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + 0.04);
    gain.gain.setValueAtTime(volume * 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 5;
    osc.connect(bp).connect(gain).connect(dest);
    osc.start(time); osc.stop(time + 0.07);
  }
}

// Layered synth note with detuned oscillators and proper ADSR
function synthNote(
  ctx: OfflineAudioContext, freq: number, time: number, duration: number,
  volume: number, waves: OscillatorType[], detuneCents: number,
  dest: AudioNode, filterFreq?: number, filterQ?: number
) {
  const attack = Math.min(0.04, duration * 0.08);
  const decay = Math.min(0.1, duration * 0.15);
  const sustainLevel = 0.7;
  const release = Math.min(0.15, duration * 0.25);
  const sustainTime = Math.max(0, duration - attack - decay - release);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, time);
  masterGain.gain.linearRampToValueAtTime(volume, time + attack);
  masterGain.gain.linearRampToValueAtTime(volume * sustainLevel, time + attack + decay);
  masterGain.gain.setValueAtTime(volume * sustainLevel, time + attack + decay + sustainTime);
  masterGain.gain.linearRampToValueAtTime(0, time + duration);

  let target: AudioNode = dest;
  if (filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq * 0.5, time);
    filter.frequency.linearRampToValueAtTime(filterFreq, time + attack + decay * 0.5);
    filter.frequency.linearRampToValueAtTime(filterFreq * 0.6, time + duration);
    filter.Q.value = filterQ || 1;
    filter.connect(dest);
    target = filter;
  }

  masterGain.connect(target);

  const volPerOsc = 1 / waves.length;
  waves.forEach((wave, i) => {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    // Detune each layer slightly for richness
    const spread = (i - (waves.length - 1) / 2) * detuneCents;
    osc.detune.value = spread;
    const oscGain = ctx.createGain();
    oscGain.gain.value = volPerOsc;
    osc.connect(oscGain).connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  });
}

// Pad: long evolving tone
function synthPad(
  ctx: OfflineAudioContext, freq: number, time: number, duration: number,
  volume: number, wave: OscillatorType, dest: AudioNode
) {
  const attack = Math.min(1.5, duration * 0.3);
  const release = Math.min(1.5, duration * 0.3);

  // 3 detuned oscillators for lush pad
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    osc.detune.value = (i - 1) * 7;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume / 3, time + attack);
    gain.gain.setValueAtTime(volume / 3, time + duration - release);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800 + Math.random() * 400;
    filter.Q.value = 0.5;

    osc.connect(filter).connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
}

function renderAudio(config: GenerationConfig, bpm: number, rootMidi: number, scaleType: string): Promise<{ buffer: AudioBuffer; bpm: number; rootMidi: number; scaleType: string }> {
  const style1 = config.style || 'Pop';
  const style2 = config.style2;
  const blendRatio = config.blendRatio ?? 0.5;
  const duration = config.durationSeconds || 30;
  const stepDuration = 60 / bpm / 4;
  const sampleRate = 44100;
  const totalSamples = sampleRate * (duration + 3); // extra for reverb tail
  const ctx = new OfflineAudioContext(2, totalSamples, sampleRate);

  const scale = SCALES[scaleType as keyof typeof SCALES] || SCALES.major;
  
  // Get params (blended if two genres)
  const params1 = getStyleParams(style1);
  const params = style2 ? blendParams(params1, getStyleParams(style2), blendRatio) : params1;
  
  // Get drum pattern (blended if two genres)
  const drums1 = DRUM_PATTERNS[style1] || DRUM_PATTERNS.Pop;
  const drums = style2 ? blendDrums(drums1, DRUM_PATTERNS[style2] || DRUM_PATTERNS.Pop, blendRatio) : drums1;
  
  // Get chord progression (blend: alternate bars)
  const prog1 = PROGRESSIONS[style1] || PROGRESSIONS.Pop;
  const prog2 = style2 ? (PROGRESSIONS[style2] || PROGRESSIONS.Pop) : prog1;

  const stepsPerBar = 16;
  const bars = Math.ceil(duration / (stepsPerBar * stepDuration));
  const totalSteps = bars * stepsPerBar;

  // === EFFECTS CHAIN ===
  // Compressor -> Master
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;
  compressor.connect(ctx.destination);

  // Master gain
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(compressor);

  // Reverb
  const reverbIR = createReverbIR(ctx, params.reverbDecay, sampleRate);
  const convolver = ctx.createConvolver();
  convolver.buffer = reverbIR;
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = params.reverbMix;
  convolver.connect(reverbGain).connect(masterGain);

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - params.reverbMix * 0.5;
  dryGain.connect(masterGain);

  // Send bus: everything goes to both dry and reverb
  const sendBus = ctx.createGain();
  sendBus.gain.value = 1;
  sendBus.connect(dryGain);
  sendBus.connect(convolver);

  // Delay
  const delay = ctx.createDelay(2);
  delay.delayTime.value = params.delayTime;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = params.delayFeedback;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass'; delayFilter.frequency.value = 2500;
  delay.connect(delayFilter).connect(delayFeedback).connect(delay);
  delay.connect(sendBus);

  // Melody send (goes to delay too)
  const melodySend = ctx.createGain();
  melodySend.gain.value = 1;
  melodySend.connect(sendBus);
  melodySend.connect(delay);

  // Drum bus (less reverb)
  const drumBus = ctx.createGain();
  drumBus.gain.value = 1;
  drumBus.connect(dryGain);
  // Only a touch of reverb on drums
  const drumReverbSend = ctx.createGain();
  drumReverbSend.gain.value = 0.1;
  drumBus.connect(drumReverbSend);
  drumReverbSend.connect(convolver);

  // === DRUMS ===
  for (let step = 0; step < totalSteps; step++) {
    const time = step * stepDuration;
    if (time >= duration) break;
    const patIdx = step % 16;
    // Slight humanization
    const humanize = (Math.random() - 0.5) * 0.008;
    const t = Math.max(0, time + humanize);
    const velVar = 0.85 + Math.random() * 0.3;
    if (drums.kick[patIdx]) synthDrum(ctx, 'kick', t, params.drumVol * velVar, drumBus);
    if (drums.snare[patIdx]) synthDrum(ctx, 'snare', t, params.drumVol * velVar, drumBus);
    if (drums.hihat[patIdx]) synthDrum(ctx, 'hihat', t, params.drumVol * velVar, drumBus);
    if (drums.perc[patIdx]) synthDrum(ctx, 'perc', t, params.drumVol * velVar * 0.7, drumBus);
  }

  // === BASS ===
  for (let bar = 0; bar < bars; bar++) {
    const prog = bar % 2 === 0 || !style2 ? prog1 : prog2;
    const chordIdx = bar % prog.length;
    const chord = prog[chordIdx];
    const bassNote = rootMidi - 12 + chord[0];
    const barTime = bar * stepsPerBar * stepDuration;
    if (barTime >= duration) break;
    
    for (let i = 0; i < 4; i++) {
      const t = barTime + i * 4 * stepDuration;
      if (t >= duration) break;
      const noteDur = stepDuration * 3.5;
      synthNote(ctx, midiToFreq(bassNote), t, noteDur, params.bassVol, params.bassWaves, params.bassDetune, sendBus, params.filterFreq * 0.4, 1);
      
      // Sub bass
      if (params.useSubBass) {
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.value = midiToFreq(bassNote - 12);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(params.bassVol * 0.4, t);
        subGain.gain.setValueAtTime(params.bassVol * 0.4, t + noteDur * 0.8);
        subGain.gain.linearRampToValueAtTime(0, t + noteDur);
        subOsc.connect(subGain).connect(dryGain); // sub bass direct, no reverb
        subOsc.start(t);
        subOsc.stop(t + noteDur + 0.01);
      }
    }
  }

  // === CHORDS ===
  for (let bar = 0; bar < bars; bar++) {
    const prog = bar % 2 === 0 || !style2 ? prog1 : prog2;
    const chordIdx = bar % prog.length;
    const chord = prog[chordIdx];
    const barTime = bar * stepsPerBar * stepDuration;
    if (barTime >= duration) break;

    if (params.arpSpeed > 0) {
      // Arpeggiated chords
      const arpStep = stepDuration * (4 / params.arpSpeed);
      let arpIdx = 0;
      for (let t = barTime; t < barTime + stepsPerBar * stepDuration && t < duration; t += arpStep) {
        const interval = chord[arpIdx % chord.length];
        const freq = midiToFreq(rootMidi + interval);
        synthNote(ctx, freq, t, arpStep * 0.85, params.chordVol * 0.8, params.chordWaves, params.chordDetune, sendBus, params.filterFreq, params.filterQ);
        arpIdx++;
      }
    } else {
      // Sustained chords
      for (const interval of chord) {
        const freq = midiToFreq(rootMidi + interval);
        synthNote(ctx, freq, barTime, stepsPerBar * stepDuration * 0.9, params.chordVol, params.chordWaves, params.chordDetune, sendBus, params.filterFreq, params.filterQ);
      }
    }
  }

  // === PAD ===
  if (params.usePad) {
    for (let bar = 0; bar < bars; bar += 2) {
      const prog = bar % 4 < 2 || !style2 ? prog1 : prog2;
      const chordIdx = bar % prog.length;
      const chord = prog[chordIdx];
      const barTime = bar * stepsPerBar * stepDuration;
      const padDur = Math.min(stepsPerBar * stepDuration * 2, duration - barTime);
      if (barTime >= duration || padDur <= 0) break;
      
      for (const interval of chord.slice(0, 3)) {
        const freq = midiToFreq(rootMidi - 12 + interval);
        synthPad(ctx, freq, barTime, padDur, params.padVol, params.padWave, sendBus);
      }
    }
  }

  // === MELODY ===
  if (!config.instrumental || Math.random() < 0.7) {
    const melodyNotes = generateMelodyNotes(scale, bars, stepsPerBar, rootMidi + 12);
    for (const n of melodyNotes) {
      const time = n.step * stepDuration;
      if (time >= duration) break;
      const dur = n.duration * stepDuration;
      synthNote(ctx, midiToFreq(n.note), time, dur * 0.9, params.melodyVol, params.melodyWaves, params.melodyDetune, melodySend, params.filterFreq, params.filterQ);
    }
  }

  // Fade out last 1.5s
  const fadeStart = duration - 1.5;
  masterGain.gain.setValueAtTime(0.85, fadeStart);
  masterGain.gain.linearRampToValueAtTime(0, duration);

  return ctx.startRendering().then(buffer => ({ buffer, bpm, rootMidi, scaleType }));
}

export async function generateMusic(config: GenerationConfig): Promise<GeneratedTrack> {
  const style = config.style || 'Pop';
  const style2 = config.style2;
  
  // BPM: blend if two genres
  const [bpmMin1, bpmMax1] = BPM_RANGES[style] || [110, 130];
  let bpmMin = bpmMin1, bpmMax = bpmMax1;
  if (style2) {
    const [bpmMin2, bpmMax2] = BPM_RANGES[style2] || [110, 130];
    const ratio = config.blendRatio ?? 0.5;
    bpmMin = Math.round(lerp(bpmMin1, bpmMin2, ratio));
    bpmMax = Math.round(lerp(bpmMax1, bpmMax2, ratio));
  }
  const bpm = bpmMin + Math.floor(Math.random() * (bpmMax - bpmMin));

  const scaleType = ['Jazz', 'Blues', 'Lo-fi'].includes(style) ? 'blues'
    : ['Metal', 'Hip-Hop', 'Trap'].includes(style) ? 'minor'
    : ['Ambient'].includes(style) ? 'pentatonic'
    : ['Classical'].includes(style) ? randomFromArray(['major', 'harmonicMinor'] as const)
    : Math.random() < 0.4 ? 'minor' : 'major';

  const roots = [48, 50, 52, 53, 55, 57];
  const rootMidi = randomFromArray(roots);

  const { buffer } = await renderAudio(config, bpm, rootMidi, scaleType);
  const wavBlob = audioBufferToWav(buffer);
  const audioUrl = URL.createObjectURL(wavBlob);

  const titleNames = [
    "Digital Dreams", "Neon Pulse", "Midnight Flow", "Crystal Waves",
    "Electric Soul", "Velvet Sky", "Shadow Dance", "Solar Wind",
    "Deep Horizon", "Golden Hour", "Infinite Loop", "Silent Storm",
    "Future Echo", "Cosmic Dust", "Urban Jungle", "Quantum Beat",
    "Neon Horizon", "Astral Drift", "Vapor Trail", "Chrome Sky",
  ];

  const styleName = style2 ? `${style} × ${style2}` : style;

  return {
    id: crypto.randomUUID(),
    title: config.title || randomFromArray(titleNames),
    style: styleName,
    duration: config.durationSeconds,
    audioBlob: wavBlob,
    audioUrl,
    _bpm: bpm,
    _rootMidi: rootMidi,
    _scaleType: scaleType,
  };
}

export async function extendTrack(existingTrack: GeneratedTrack, additionalSeconds: number): Promise<GeneratedTrack> {
  const bpm = existingTrack._bpm || 120;
  const rootMidi = existingTrack._rootMidi || 48;
  const scaleType = existingTrack._scaleType || 'major';
  const newDuration = existingTrack.duration + additionalSeconds;

  // Parse blended style
  let style = existingTrack.style;
  let style2: string | undefined;
  if (style.includes(' × ')) {
    const parts = style.split(' × ');
    style = parts[0];
    style2 = parts[1];
  }

  const config: GenerationConfig = {
    style,
    style2,
    blendRatio: 0.5,
    durationSeconds: newDuration,
    instrumental: false,
    title: existingTrack.title,
  };

  const { buffer } = await renderAudio(config, bpm, rootMidi, scaleType);
  const wavBlob = audioBufferToWav(buffer);

  if (existingTrack.audioUrl.startsWith('blob:')) {
    URL.revokeObjectURL(existingTrack.audioUrl);
  }

  const audioUrl = URL.createObjectURL(wavBlob);

  return {
    ...existingTrack,
    duration: newDuration,
    audioBlob: wavBlob,
    audioUrl,
  };
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
