import { useRef, useCallback, useEffect, useState } from "react";

export interface AudioLevels {
  bass: number;       // 0-1
  mid: number;        // 0-1
  treble: number;     // 0-1
  overall: number;    // 0-1
  frequencies: number[]; // 0-1 array for equalizer bars
  rawBass: number;    // unnormalized for peak detection
}

const EMPTY_LEVELS: AudioLevels = {
  bass: 0, mid: 0, treble: 0, overall: 0, frequencies: new Array(18).fill(0), rawBass: 0,
};

export function useAudioAnalyser(audioElement: HTMLAudioElement | null, isPlaying: boolean, barCount = 18) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const [levels, setLevels] = useState<AudioLevels>(EMPTY_LEVELS);

  // Connect audio element to analyser (only once per element)
  const connect = useCallback(() => {
    if (!audioElement || connectedElementRef.current === audioElement) return;

    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      const source = ctx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceRef.current = source;
      connectedElementRef.current = audioElement;
    } catch (e) {
      // Already connected or CORS — silently fail
      console.warn("AudioAnalyser connect failed:", e);
    }
  }, [audioElement]);

  // Read frequency data in a loop
  useEffect(() => {
    if (!isPlaying || !audioElement) {
      setLevels(EMPTY_LEVELS);
      return;
    }

    connect();
    const analyser = analyserRef.current;
    if (!analyser) return;

    // Resume context if suspended
    if (ctxRef.current?.state === "suspended") {
      ctxRef.current.resume();
    }

    const bufferLength = analyser.frequencyBinCount; // 128
    const dataArray = new Uint8Array(bufferLength);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);

      // Split into bass/mid/treble ranges
      const bassEnd = Math.floor(bufferLength * 0.15);   // ~0-300Hz
      const midEnd = Math.floor(bufferLength * 0.5);     // ~300-2kHz
      
      let bassSum = 0, midSum = 0, trebleSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
        if (i < bassEnd) bassSum += v;
        else if (i < midEnd) midSum += v;
        else trebleSum += v;
      }

      const bass = bassSum / (bassEnd * 255);
      const mid = midSum / ((midEnd - bassEnd) * 255);
      const treble = trebleSum / ((bufferLength - midEnd) * 255);
      const overall = (bass * 0.5 + mid * 0.35 + treble * 0.15);

      // Build per-bar frequency data
      const barsPerBin = bufferLength / barCount;
      const frequencies: number[] = [];
      for (let b = 0; b < barCount; b++) {
        const start = Math.floor(b * barsPerBin);
        const end = Math.floor((b + 1) * barsPerBin);
        let sum = 0;
        for (let j = start; j < end; j++) sum += dataArray[j];
        frequencies.push(sum / ((end - start) * 255));
      }

      setLevels({ bass, mid, treble, overall, frequencies, rawBass: bassSum / bassEnd });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, audioElement, connect, barCount]);

  return levels;
}
