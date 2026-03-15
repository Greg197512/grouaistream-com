/**
 * Algorithmic Music Generator using Web Audio API
 * Generates beats, melodies, chords, and bass lines in various styles
 */

// Musical scales (semitone intervals from root)
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

// Chord progressions per style
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

// BPM ranges per style
const BPM_RANGES: Record<string, [number, number]> = {
  Pop: [110, 130],
  Rock: [120, 150],
  "Hip-Hop": [80, 100],
  Electronic: [125, 140],
  Jazz: [100, 140],
  Classical: [70, 110],
  "Lo-fi": [70, 90],
  Ambient: [60, 80],
  Metal: [140, 180],
  "R&B": [85, 105],
  Reggae: [70, 90],
  Trap: [130, 160],
  House: [120, 130],
  Disco: [115, 130],
  Indie: [100, 130],
  Country: [100, 130],
};

// Drum patterns per style (16 steps: kick, snare, hihat)
const DRUM_PATTERNS: Record<string, { kick: number[]; snare: number[]; hihat: number[] }> = {
  Pop:        { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
  Rock:       { kick: [1,0,0,0, 1,0,0,0, 1,0,1,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
  "Hip-Hop":  { kick: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
  Electronic: { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1] },
  Jazz:       { kick: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0], snare: [0,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,1,0], hihat: [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0] },
  Classical:  { kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], hihat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
  "Lo-fi":    { kick: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
  Ambient:    { kick: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], hihat: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
  Metal:      { kick: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
  "R&B":      { kick: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] },
  Reggae:     { kick: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0], snare: [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
  Trap:       { kick: [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] },
  House:      { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] },
  Disco:      { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
  Indie:      { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
  Country:    { kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
};

export interface GenerationConfig {
  style: string;
  durationSeconds: number;
  instrumental: boolean;
  title?: string;
}

export interface GeneratedTrack {
  id: string;
  title: string;
  style: string;
  duration: number;
  audioBlob: Blob;
  audioUrl: string;
  // Internal state for extending
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

function generateMelodyNotes(scale: number[], bars: number, stepsPerBar: number, rootMidi: number): { note: number; step: number; duration: number }[] {
  const notes: { note: number; step: number; duration: number }[] = [];
  const totalSteps = bars * stepsPerBar;

  for (let step = 0; step < totalSteps; ) {
    if (Math.random() < 0.3) {
      step++;
      continue;
    }
    const degree = Math.floor(Math.random() * scale.length);
    const octaveShift = Math.random() < 0.3 ? 12 : 0;
    const note = rootMidi + scale[degree] + octaveShift;
    const dur = randomFromArray([1, 1, 2, 2, 4]);
    const actualDur = Math.min(dur, totalSteps - step);
    notes.push({ note, step, duration: actualDur });
    step += actualDur;
  }
  return notes;
}

function synthDrum(ctx: OfflineAudioContext, type: 'kick' | 'snare' | 'hihat', time: number, volume: number) {
  if (type === 'kick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
    gain.gain.setValueAtTime(volume * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.3);
  } else if (type === 'snare') {
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.15);
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    oscGain.gain.setValueAtTime(volume * 0.4, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
  } else {
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.05);
  }
}

function synthNote(
  ctx: OfflineAudioContext,
  freq: number,
  time: number,
  duration: number,
  volume: number,
  waveform: OscillatorType = 'sine',
  useFilter = false
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = waveform;
  osc.frequency.value = freq;

  const attack = Math.min(0.05, duration * 0.1);
  const release = Math.min(0.1, duration * 0.3);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + attack);
  gain.gain.setValueAtTime(volume, time + duration - release);
  gain.gain.linearRampToValueAtTime(0, time + duration);

  if (useFilter) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800 + Math.random() * 1200;
    filter.Q.value = 2;
    osc.connect(filter).connect(gain).connect(ctx.destination);
  } else {
    osc.connect(gain).connect(ctx.destination);
  }
  osc.start(time);
  osc.stop(time + duration + 0.01);
}

function getWaveforms(style: string): { melody: OscillatorType; chord: OscillatorType; bass: OscillatorType } {
  switch (style) {
    case 'Rock': case 'Metal': return { melody: 'sawtooth', chord: 'sawtooth', bass: 'square' };
    case 'Electronic': case 'House': case 'Trap': return { melody: 'sawtooth', chord: 'square', bass: 'sawtooth' };
    case 'Jazz': case 'Lo-fi': case 'R&B': return { melody: 'triangle', chord: 'sine', bass: 'triangle' };
    case 'Classical': case 'Ambient': return { melody: 'sine', chord: 'sine', bass: 'sine' };
    default: return { melody: 'triangle', chord: 'sine', bass: 'square' };
  }
}

function renderAudio(config: GenerationConfig, bpm: number, rootMidi: number, scaleType: string): Promise<{ buffer: AudioBuffer; bpm: number; rootMidi: number; scaleType: string }> {
  const style = config.style || 'Pop';
  const duration = config.durationSeconds || 30;
  const stepDuration = 60 / bpm / 4;
  const sampleRate = 44100;
  const totalSamples = sampleRate * duration;
  const ctx = new OfflineAudioContext(2, totalSamples, sampleRate);

  const scale = SCALES[scaleType as keyof typeof SCALES] || SCALES.major;
  const waveforms = getWaveforms(style);
  const progression = PROGRESSIONS[style] || PROGRESSIONS.Pop;
  const drums = DRUM_PATTERNS[style] || DRUM_PATTERNS.Pop;
  const stepsPerBar = 16;
  const bars = Math.ceil(duration / (stepsPerBar * stepDuration));
  const totalSteps = bars * stepsPerBar;

  // DRUMS
  const drumVolume = style === 'Ambient' || style === 'Classical' ? 0.05 : 0.35;
  for (let step = 0; step < totalSteps; step++) {
    const time = step * stepDuration;
    if (time >= duration) break;
    const patIdx = step % 16;
    if (drums.kick[patIdx]) synthDrum(ctx, 'kick', time, drumVolume);
    if (drums.snare[patIdx]) synthDrum(ctx, 'snare', time, drumVolume);
    if (drums.hihat[patIdx]) synthDrum(ctx, 'hihat', time, drumVolume);
  }

  // BASS
  const bassVolume = 0.2;
  for (let bar = 0; bar < bars; bar++) {
    const chordIdx = bar % progression.length;
    const chord = progression[chordIdx];
    const bassNote = rootMidi - 12 + chord[0];
    const barTime = bar * stepsPerBar * stepDuration;
    if (barTime >= duration) break;
    for (let i = 0; i < 4; i++) {
      const t = barTime + i * 4 * stepDuration;
      if (t >= duration) break;
      synthNote(ctx, midiToFreq(bassNote), t, stepDuration * 3.5, bassVolume, waveforms.bass, true);
    }
  }

  // CHORDS
  const chordVolume = 0.1;
  for (let bar = 0; bar < bars; bar++) {
    const chordIdx = bar % progression.length;
    const chord = progression[chordIdx];
    const barTime = bar * stepsPerBar * stepDuration;
    if (barTime >= duration) break;
    for (const interval of chord) {
      const freq = midiToFreq(rootMidi + interval);
      synthNote(ctx, freq, barTime, stepsPerBar * stepDuration * 0.9, chordVolume, waveforms.chord);
    }
  }

  // MELODY
  if (!config.instrumental || Math.random() < 0.7) {
    const melodyNotes = generateMelodyNotes(scale, bars, stepsPerBar, rootMidi + 12);
    const melodyVolume = 0.15;
    for (const n of melodyNotes) {
      const time = n.step * stepDuration;
      if (time >= duration) break;
      const dur = n.duration * stepDuration;
      synthNote(ctx, midiToFreq(n.note), time, dur * 0.9, melodyVolume, waveforms.melody);
    }
  }

  return ctx.startRendering().then(buffer => ({ buffer, bpm, rootMidi, scaleType }));
}

export async function generateMusic(config: GenerationConfig): Promise<GeneratedTrack> {
  const style = config.style || 'Pop';
  const [bpmMin, bpmMax] = BPM_RANGES[style] || [110, 130];
  const bpm = bpmMin + Math.floor(Math.random() * (bpmMax - bpmMin));

  const scaleType = ['Jazz', 'Blues', 'Lo-fi'].includes(style) ? 'blues'
    : ['Metal', 'Hip-Hop', 'Trap'].includes(style) ? 'minor'
    : ['Ambient'].includes(style) ? 'pentatonic'
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
  ];

  return {
    id: crypto.randomUUID(),
    title: config.title || randomFromArray(titleNames),
    style,
    duration: config.durationSeconds,
    audioBlob: wavBlob,
    audioUrl,
    _bpm: bpm,
    _rootMidi: rootMidi,
    _scaleType: scaleType,
  };
}

/**
 * Extend an existing track by generating additional seconds and concatenating
 */
export async function extendTrack(existingTrack: GeneratedTrack, additionalSeconds: number): Promise<GeneratedTrack> {
  const bpm = existingTrack._bpm || 120;
  const rootMidi = existingTrack._rootMidi || 48;
  const scaleType = existingTrack._scaleType || 'major';
  const newDuration = existingTrack.duration + additionalSeconds;

  // Re-render the full track at the new duration to keep coherent
  const config: GenerationConfig = {
    style: existingTrack.style,
    durationSeconds: newDuration,
    instrumental: false,
    title: existingTrack.title,
  };

  const { buffer } = await renderAudio(config, bpm, rootMidi, scaleType);
  const wavBlob = audioBufferToWav(buffer);

  // Revoke old URL
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

// Simple WAV encoder
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
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
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
