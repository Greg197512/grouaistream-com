import { useRef, useCallback, useEffect, useState } from "react";

export interface AudioLevels {
  bass: number;       // 0-1
  mid: number;        // 0-1
  treble: number;     // 0-1
  overall: number;    // 0-1
  frequencies: number[]; // 0-1 array for equalizer bars
  rawBass: number;    // unnormalized for peak detection
  isReal: boolean;    // true = real analyser, false = simulated
}

const EMPTY_LEVELS: AudioLevels = {
  bass: 0, mid: 0, treble: 0, overall: 0, frequencies: new Array(18).fill(0), rawBass: 0, isReal: false,
};

// Simulated music-like levels for YouTube/fallback mode
function generateSimulatedLevels(time: number, barCount: number): AudioLevels {
  const t = time / 1000;
  
  // Simulate bass hits ~120 BPM
  const beatPhase = (t * 2) % 1;
  const bassHit = Math.pow(Math.max(0, 1 - beatPhase * 2.5), 1.5);
  const bass = 0.4 + bassHit * 0.55 + Math.sin(t * 1.7) * 0.12;
  
  // Mid with melody-like variation
  const mid = 0.35 + Math.sin(t * 3.1) * 0.18 + Math.sin(t * 5.3) * 0.12 + bassHit * 0.2;
  
  // Treble with shimmer
  const treble = 0.25 + Math.sin(t * 7.7) * 0.15 + Math.sin(t * 11.3) * 0.1 + bassHit * 0.15;
  
  const overall = bass * 0.5 + mid * 0.35 + treble * 0.15;

  // Per-bar frequencies with natural distribution
  const frequencies: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const normalizedPos = i / barCount;
    let base: number;
    
    if (normalizedPos < 0.33) {
      // Bass range - strong hits
      base = bass * (0.8 + Math.sin(t * 2.3 + i * 0.8) * 0.25);
    } else if (normalizedPos < 0.66) {
      // Mid range
      base = mid * (0.7 + Math.sin(t * 4.1 + i * 1.2) * 0.3);
    } else {
      // Treble range
      base = treble * (0.6 + Math.sin(t * 6.7 + i * 1.5) * 0.35);
    }
    
    // Add per-bar variation
    base += Math.sin(t * (3 + i * 0.7)) * 0.1;
    frequencies.push(Math.max(0.08, Math.min(1, base)));
  }

  return {
    bass: Math.min(1, bass),
    mid: Math.min(1, mid),
    treble: Math.min(1, treble),
    overall: Math.min(1, overall),
    frequencies,
    rawBass: bass * 255,
    isReal: false,
  };
}

export function useAudioAnalyser(audioElement: HTMLAudioElement | null, isPlaying: boolean, isVideoMode = false, barCount = 18) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const hasRealAnalyserRef = useRef(false);
  const [levels, setLevels] = useState<AudioLevels>(EMPTY_LEVELS);

  const isCrossOriginMedia = useCallback((element: HTMLAudioElement | null) => {
    if (!element) return true;

    const sourceUrl = element.currentSrc || element.src;
    if (!sourceUrl) return false;

    try {
      const parsedUrl = new URL(sourceUrl, window.location.href);
      return parsedUrl.origin !== window.location.origin;
    } catch {
      return true;
    }
  }, []);

  // Connect audio element to analyser (only once per element)
  const connect = useCallback(() => {
    if (!audioElement || connectedElementRef.current === audioElement) return;

    // Cross-origin media can become silent when routed through MediaElementAudioSourceNode.
    // Keep native playback and use simulated analyser values instead.
    if (isCrossOriginMedia(audioElement)) {
      hasRealAnalyserRef.current = false;
      connectedElementRef.current = audioElement;
      return;
    }

    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;

      const analyser = ctx.createAnalyser();
      // Higher resolution for honest, lively spectrum
      analyser.fftSize = 1024;
      // Lower smoothing = more reactive bars (was 0.75)
      analyser.smoothingTimeConstant = 0.55;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;

      const source = ctx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceRef.current = source;
      connectedElementRef.current = audioElement;
      hasRealAnalyserRef.current = true;
    } catch (e) {
      console.warn("AudioAnalyser connect failed:", e);
      hasRealAnalyserRef.current = false;
    }
  }, [audioElement, isCrossOriginMedia]);

  useEffect(() => {
    if (!isPlaying) {
      setLevels(EMPTY_LEVELS);
      return;
    }

    // Video mode, no audio element, or cross-origin audio -> simulated fallback
    const useSimulated = isVideoMode || !audioElement || isCrossOriginMedia(audioElement);

    if (!useSimulated) {
      connect();
      // If connect failed, fall back to simulated
    }

    const analyser = !useSimulated ? analyserRef.current : null;
    const useReal = analyser && hasRealAnalyserRef.current;

    if (useReal && ctxRef.current?.state === "suspended") {
      ctxRef.current.resume();
    }

    const bufferLength = analyser?.frequencyBinCount ?? 128;
    const dataArray = useReal ? new Uint8Array(bufferLength) : null;

    const tick = () => {
      if (useReal && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);

        // Honest bass/mid/treble bands by perceptual frequency split
        // sub/bass: 0-250Hz, mid: 250Hz-4kHz, treble: 4kHz-20kHz (assuming 48kHz sr)
        const bassEnd = Math.max(2, Math.floor(bufferLength * 0.06));
        const midEnd = Math.max(bassEnd + 2, Math.floor(bufferLength * 0.42));

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
        const overall = bass * 0.45 + mid * 0.4 + treble * 0.15;

        // Logarithmic bin distribution — honest representation of human hearing.
        // Each bar covers a band in log-frequency space (like a true equalizer).
        const minBin = 1;
        const maxBin = bufferLength;
        const logMin = Math.log(minBin);
        const logMax = Math.log(maxBin);
        const frequencies: number[] = [];
        for (let b = 0; b < barCount; b++) {
          const lo = Math.floor(Math.exp(logMin + (logMax - logMin) * (b / barCount)));
          const hi = Math.max(lo + 1, Math.floor(Math.exp(logMin + (logMax - logMin) * ((b + 1) / barCount))));
          let peak = 0;
          let sum = 0;
          const span = Math.min(hi, bufferLength) - lo;
          for (let j = lo; j < Math.min(hi, bufferLength); j++) {
            const v = dataArray[j];
            if (v > peak) peak = v;
            sum += v;
          }
          // Blend peak (lively) with average (stable) — gamma curve for visible dynamics
          const avg = sum / Math.max(1, span);
          const blended = (peak * 0.65 + avg * 0.35) / 255;
          frequencies.push(Math.pow(blended, 0.7));
        }

        setLevels({
          bass: Math.min(1, bass * 1.15),
          mid: Math.min(1, mid * 1.1),
          treble: Math.min(1, treble * 1.2),
          overall: Math.min(1, overall),
          frequencies,
          rawBass: bassSum / Math.max(1, bassEnd),
          isReal: true,
        });
      } else {
        // Simulated fallback
        setLevels(generateSimulatedLevels(Date.now(), barCount));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, audioElement, isVideoMode, connect, barCount]);

  return levels;
}
