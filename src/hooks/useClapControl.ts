import { useEffect, useRef, useCallback } from "react";

interface UseClapControlOptions {
  enabled: boolean;
  onSingleClap: () => void;
  onDoubleClap: () => void;
}

// Much higher threshold to avoid music triggering false claps
const CLAP_THRESHOLD = 0.55;
const PEAK_COOLDOWN_MS = 250;
const DOUBLE_CLAP_WINDOW_MS = 500;
// Claps are very short transients — if the signal stays loud for longer, it's music not a clap
const CLAP_MAX_DURATION_MS = 60;

export function useClapControl({ enabled, onSingleClap, onDoubleClap }: UseClapControlOptions) {
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastPeakRef = useRef(0);
  const clapTimesRef = useRef<number[]>([]);
  const clapDecisionTimerRef = useRef<number | null>(null);
  const peakStartRef = useRef(0);
  const wasPeakRef = useRef(false);

  // Check if music is currently playing — if so, ignore peaks entirely
  const isMusicPlaying = useCallback(() => {
    const musicAudio = document.querySelector("audio[data-player='main']") as HTMLAudioElement | null;
    return musicAudio && !musicAudio.paused && musicAudio.volume > 0.05;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const cleanup = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (clapDecisionTimerRef.current) {
        clearTimeout(clapDecisionTimerRef.current);
        clapDecisionTimerRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (contextRef.current) {
        contextRef.current.close().catch(() => undefined);
        contextRef.current = null;
      }
      clapTimesRef.current = [];
      lastPeakRef.current = 0;
    };

    const detectLoop = () => {
      if (!analyserRef.current) return;

      const analyser = analyserRef.current;
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);

      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);

      const now = performance.now();
      const isPeak = rms > CLAP_THRESHOLD;
      const cooledDown = now - lastPeakRef.current > PEAK_COOLDOWN_MS;

      // Track peak duration — claps are very short, music sustains
      if (isPeak && !wasPeakRef.current) {
        peakStartRef.current = now;
        wasPeakRef.current = true;
      } else if (!isPeak && wasPeakRef.current) {
        const peakDuration = now - peakStartRef.current;
        wasPeakRef.current = false;

        // Only count as clap if: short transient, cooled down, music not playing
        if (peakDuration < CLAP_MAX_DURATION_MS && cooledDown && !isMusicPlaying()) {
          lastPeakRef.current = now;

          clapTimesRef.current = [...clapTimesRef.current, now].filter(
            (time) => now - time <= DOUBLE_CLAP_WINDOW_MS,
          );

          if (clapDecisionTimerRef.current) {
            clearTimeout(clapDecisionTimerRef.current);
          }

          clapDecisionTimerRef.current = window.setTimeout(() => {
            const count = clapTimesRef.current.filter(
              (time) => performance.now() - time <= DOUBLE_CLAP_WINDOW_MS,
            ).length;

            if (count >= 2) {
              onDoubleClap();
            } else if (count === 1) {
              onSingleClap();
            }

            clapTimesRef.current = [];
          }, DOUBLE_CLAP_WINDOW_MS);
        }
      }

      rafRef.current = requestAnimationFrame(detectLoop);
    };

    const start = async () => {
      if (!navigator?.mediaDevices?.getUserMedia) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const context = new AudioContext();
        contextRef.current = context;

        const source = context.createMediaStreamSource(stream);
        sourceRef.current = source;

        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.2;
        analyserRef.current = analyser;

        source.connect(analyser);
        detectLoop();
      } catch {
        cleanup();
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, onSingleClap, onDoubleClap, isMusicPlaying]);
}
