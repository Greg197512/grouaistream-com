/**
 * AudioMixer — Mixes two audio files into one using Web Audio API.
 * Supports crossfade, overlay, and beat-sync styles.
 */

export type MixStyle = "crossfade" | "overlay" | "mashup";

export interface MixConfig {
  style?: MixStyle;
  crossfadeDuration?: number; // seconds
  outputDuration?: number; // 0 = auto (length of longer track)
  gainA?: number; // 0-1
  gainB?: number; // 0-1
}

export interface MixResult {
  audioUrl: string;
  duration: number;
  title: string;
}

const audioCtxCache = { ctx: null as AudioContext | null };
const getAudioContext = (): AudioContext => {
  if (!audioCtxCache.ctx || audioCtxCache.ctx.state === "closed") {
    audioCtxCache.ctx = new AudioContext({ sampleRate: 44100 });
  }
  return audioCtxCache.ctx;
};

async function fetchAudioBuffer(url: string): Promise<AudioBuffer> {
  const resp = await fetch(url);
  const arrayBuffer = await resp.arrayBuffer();
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

function applyFadeIn(buffer: Float32Array, sampleRate: number, fadeDuration: number) {
  const fadeSamples = Math.min(Math.floor(fadeDuration * sampleRate), buffer.length);
  for (let i = 0; i < fadeSamples; i++) {
    buffer[i] *= i / fadeSamples;
  }
}

function applyFadeOut(buffer: Float32Array, sampleRate: number, fadeDuration: number) {
  const fadeSamples = Math.min(Math.floor(fadeDuration * sampleRate), buffer.length);
  const start = buffer.length - fadeSamples;
  for (let i = 0; i < fadeSamples; i++) {
    buffer[start + i] *= 1 - i / fadeSamples;
  }
}

export async function mixAudioFiles(
  urlA: string,
  urlB: string,
  config: MixConfig = {}
): Promise<MixResult> {
  const {
    style = "crossfade",
    crossfadeDuration = 3,
    gainA = 0.85,
    gainB = 0.85,
  } = config;

  const [bufferA, bufferB] = await Promise.all([
    fetchAudioBuffer(urlA),
    fetchAudioBuffer(urlB),
  ]);

  const sampleRate = bufferA.sampleRate;
  const channels = Math.max(bufferA.numberOfChannels, bufferB.numberOfChannels);

  let outputLength: number;
  const cfSamples = Math.floor(crossfadeDuration * sampleRate);

  if (style === "crossfade") {
    // A plays, then crossfade zone, then B plays
    outputLength = bufferA.length + bufferB.length - cfSamples;
  } else if (style === "overlay" || style === "mashup") {
    // Both tracks play simultaneously for the length of the longer one
    outputLength = Math.max(bufferA.length, bufferB.length);
  } else {
    outputLength = bufferA.length + bufferB.length;
  }

  const offlineCtx = new OfflineAudioContext(channels, outputLength, sampleRate);

  if (style === "crossfade") {
    // Track A: full, fade out at end
    const sourceA = offlineCtx.createBufferSource();
    sourceA.buffer = bufferA;
    const gainNodeA = offlineCtx.createGain();
    gainNodeA.gain.setValueAtTime(gainA, 0);
    const fadeOutStart = (bufferA.length - cfSamples) / sampleRate;
    gainNodeA.gain.setValueAtTime(gainA, fadeOutStart);
    gainNodeA.gain.linearRampToValueAtTime(0, fadeOutStart + crossfadeDuration);
    sourceA.connect(gainNodeA).connect(offlineCtx.destination);
    sourceA.start(0);

    // Track B: starts at crossfade point, fades in
    const sourceB = offlineCtx.createBufferSource();
    sourceB.buffer = bufferB;
    const gainNodeB = offlineCtx.createGain();
    const bStartTime = fadeOutStart;
    gainNodeB.gain.setValueAtTime(0, bStartTime);
    gainNodeB.gain.linearRampToValueAtTime(gainB, bStartTime + crossfadeDuration);
    sourceB.connect(gainNodeB).connect(offlineCtx.destination);
    sourceB.start(bStartTime);
  } else {
    // Overlay / Mashup — both play from 0
    const sourceA = offlineCtx.createBufferSource();
    sourceA.buffer = bufferA;
    const gainNodeA = offlineCtx.createGain();
    const effectiveGainA = style === "mashup" ? gainA * 0.7 : gainA;
    gainNodeA.gain.setValueAtTime(effectiveGainA, 0);
    sourceA.connect(gainNodeA).connect(offlineCtx.destination);
    sourceA.start(0);

    const sourceB = offlineCtx.createBufferSource();
    sourceB.buffer = bufferB;
    const gainNodeB = offlineCtx.createGain();
    const effectiveGainB = style === "mashup" ? gainB * 0.7 : gainB;
    gainNodeB.gain.setValueAtTime(effectiveGainB, 0);
    sourceB.connect(gainNodeB).connect(offlineCtx.destination);
    sourceB.start(0);

    // Mashup: add slight stereo panning
    if (style === "mashup") {
      const panA = offlineCtx.createStereoPanner?.();
      const panB = offlineCtx.createStereoPanner?.();
      if (panA && panB) {
        panA.pan.setValueAtTime(-0.3, 0);
        panB.pan.setValueAtTime(0.3, 0);
        gainNodeA.disconnect();
        gainNodeB.disconnect();
        gainNodeA.connect(panA).connect(offlineCtx.destination);
        gainNodeB.connect(panB).connect(offlineCtx.destination);
      }
    }
  }

  // Add master compressor
  // Note: OfflineAudioContext doesn't easily allow post-processing chain insertion
  // The gain control above handles clipping prevention

  const renderedBuffer = await offlineCtx.startRendering();

  // Apply master fade in/out
  for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
    const data = renderedBuffer.getChannelData(ch);
    applyFadeIn(data, sampleRate, 0.05); // tiny click prevention
    applyFadeOut(data, sampleRate, 0.8);
  }

  // Encode to WAV
  const wavBlob = audioBufferToWav(renderedBuffer);
  const audioUrl = URL.createObjectURL(wavBlob);
  const duration = Math.round(renderedBuffer.duration);

  return { audioUrl, duration, title: `Mix (${style})` };
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Interleave channels
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
