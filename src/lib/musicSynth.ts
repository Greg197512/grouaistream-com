const NOTE_FREQ: Record<string, number> = {};
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
for (let octave = 0; octave <= 8; octave++) {
  for (let i = 0; i < NOTES.length; i++) {
    const midi = octave * 12 + i + 12;
    NOTE_FREQ[`${NOTES[i]}${octave}`] = 440 * Math.pow(2, (midi - 69) / 12);
    if (NOTES[i].includes("#")) {
      const flat = NOTES[(i + 1) % 12] + "b";
      NOTE_FREQ[`${flat}${octave}`] = NOTE_FREQ[`${NOTES[i]}${octave}`];
    }
  }
}

function noteToFreq(note: string): number {
  return NOTE_FREQ[note] || 440;
}

interface Score {
  bpm: number;
  key: string;
  scale: string;
  duration: number;
  swing?: number;
  melody: { note: string; beat: number; dur: number; vel?: number }[];
  chords: { notes: string[]; beat: number; dur: number }[];
  bass: { note: string; beat: number; dur: number; vel?: number }[];
  drums: { kick: number[]; snare: number[]; hihat: number[]; clap?: number[] };
  synth: {
    melody: OscillatorType;
    pad: OscillatorType;
    bass: OscillatorType;
    filterCutoff?: number;
    reverbMix?: number;
  };
}

function createReverb(ctx: OfflineAudioContext, time: number): ConvolverNode {
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * time);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-3 * i / len) * 0.3;
    }
  }
  conv.buffer = buf;
  return conv;
}

function playNote(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  vel: number,
  filterFreq?: number,
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  const attack = Math.min(0.02, duration * 0.1);
  const release = Math.min(0.15, duration * 0.3);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vel * 0.3, startTime + attack);
  gain.gain.setValueAtTime(vel * 0.3, startTime + duration - release);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  if (filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = 1;
    osc.connect(filter).connect(gain).connect(dest);
  } else {
    osc.connect(gain).connect(dest);
  }

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function playChord(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  notes: string[],
  startTime: number,
  duration: number,
  type: OscillatorType,
) {
  for (const note of notes) {
    const freq = noteToFreq(note);
    if (freq > 0) playNote(ctx, dest, freq, startTime, duration, type, 0.5);
  }
}

function playDrum(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  type: "kick" | "snare" | "hihat" | "clap",
  time: number,
) {
  if (type === "kick") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, time);
    g.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
    osc.connect(g).connect(dest);
    osc.start(time);
    osc.stop(time + 0.3);
  } else if (type === "snare") {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;
    noise.connect(hp).connect(g).connect(dest);
    noise.start(time);

    const body = ctx.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(180, time);
    body.frequency.exponentialRampToValueAtTime(80, time + 0.06);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.4, time);
    bg.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
    body.connect(bg).connect(dest);
    body.start(time);
    body.stop(time + 0.15);
  } else if (type === "hihat") {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, time);
    g.gain.exponentialRampToValueAtTime(0.01, time + 0.04);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 8000;
    bp.Q.value = 2;
    noise.connect(bp).connect(g).connect(dest);
    noise.start(time);
  } else if (type === "clap") {
    for (let j = 0; j < 3; j++) {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      const g = ctx.createGain();
      const t = time + j * 0.012;
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2500;
      noise.connect(bp).connect(g).connect(dest);
      noise.start(t);
    }
  }
}

function bufferToWav(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const sr = buffer.sampleRate;
  const bps = 2;
  const dataSize = len * ch * bps;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true);
  ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * bps, true); v.setUint16(32, ch * bps, true);
  v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, dataSize, true);
  const channels: Float32Array[] = [];
  for (let c = 0; c < ch; c++) channels.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      v.setInt16(o, Math.max(-1, Math.min(1, channels[c][i])) * 0x7FFF, true);
      o += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export async function renderScore(score: Score): Promise<string> {
  const sampleRate = 44100;
  const totalSamples = Math.ceil(score.duration * sampleRate);
  const ctx = new OfflineAudioContext(2, totalSamples, sampleRate);
  const beatDur = 60 / score.bpm;

  const reverb = createReverb(ctx, 1.5);
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = score.synth.reverbMix ?? 0.3;
  reverb.connect(reverbGain).connect(ctx.destination);

  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.7;
  dryGain.connect(ctx.destination);

  const melodyBus = ctx.createGain();
  melodyBus.gain.value = 0.8;
  melodyBus.connect(dryGain);
  melodyBus.connect(reverb);

  const padBus = ctx.createGain();
  padBus.gain.value = 0.4;
  padBus.connect(dryGain);
  padBus.connect(reverb);

  const bassBus = ctx.createGain();
  bassBus.gain.value = 0.7;
  bassBus.connect(dryGain);

  const drumBus = ctx.createGain();
  drumBus.gain.value = 0.9;
  drumBus.connect(dryGain);

  const fc = score.synth.filterCutoff ?? 3000;

  for (const n of score.melody) {
    const t = n.beat * beatDur;
    if (t >= score.duration) continue;
    const d = Math.min(n.dur * beatDur, score.duration - t);
    playNote(ctx, melodyBus, noteToFreq(n.note), t, d, score.synth.melody, n.vel ?? 0.7, fc);
  }

  for (const c of score.chords) {
    const t = c.beat * beatDur;
    if (t >= score.duration) continue;
    const d = Math.min(c.dur * beatDur, score.duration - t);
    playChord(ctx, padBus, c.notes, t, d, score.synth.pad);
  }

  for (const n of score.bass) {
    const t = n.beat * beatDur;
    if (t >= score.duration) continue;
    const d = Math.min(n.dur * beatDur, score.duration - t);
    playNote(ctx, bassBus, noteToFreq(n.note), t, d, score.synth.bass, n.vel ?? 0.8);
  }

  const drumTypes = ["kick", "snare", "hihat", "clap"] as const;
  for (const dt of drumTypes) {
    const beats = score.drums[dt];
    if (!beats) continue;
    for (const b of beats) {
      const t = b * beatDur;
      if (t >= score.duration) continue;
      playDrum(ctx, drumBus, dt, t);
    }
  }

  const rendered = await ctx.startRendering();

  // Limiter pass
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const d = rendered.getChannelData(ch);
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0.95) {
      const scale = 0.9 / peak;
      for (let i = 0; i < d.length; i++) d[i] *= scale;
    }
  }

  const blob = bufferToWav(rendered);
  return URL.createObjectURL(blob);
}
