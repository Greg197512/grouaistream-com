import { useEffect, useRef } from "react";
import { getAudioTap, resumeTap } from "@/lib/audioTap";

// Haptic bass — telefon wibruje na basie/dropie („poczuj drop").
// Web Audio robi „tap" (odczep) na elemencie audio playera: source -> destination
// (dźwięk BEZ zmian) + osobno source -> analyser (tylko odczyt). navigator.vibrate
// działa na Androidzie (iOS/desktop nie wspiera — wtedy hook nic nie robi).
// Opt-in: aktywne tylko gdy enabled=true. Nie rusza logiki playera.
export function useHapticBass(audioEl: HTMLAudioElement | null, enabled: boolean) {
  const rafRef = useRef<number | null>(null);
  const lastVib = useRef(0);
  const prevBass = useRef(0);

  useEffect(() => {
    if (!enabled || !audioEl) return;
    const nav = navigator as any;
    if (typeof nav === "undefined" || typeof nav.vibrate !== "function") return; // brak wibracji (iOS/desktop)

    let analyser: AnalyserNode | null = null;
    let data: Uint8Array | null = null;
    try {
      // WSPÓLNY tap audio (jedno źródło na element — patrz lib/audioTap).
      // Bez tego kolidowaliśmy z useAudioAnalyser (drugie createMediaElementSource
      // rzucało błąd). Dla cross-origin tap = null → haptyka po prostu nieaktywna,
      // a dźwięk pozostaje nietknięty.
      const tap = getAudioTap(audioEl);
      if (!tap) return;
      resumeTap(tap);
      analyser = tap.ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      tap.source.connect(analyser); // tylko odczyt (nie do głośnika)
      data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch {
      return; // nie udało się — audio playera nietknięte
    }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (!analyser || !data) return;
      analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
      let bass = 0;
      for (let i = 0; i < 5; i++) bass += data[i]; // najniższe pasma
      bass /= 5;
      const rising = bass - prevBass.current;
      prevBass.current = bass;
      const now = performance.now();
      // wibruj gdy mocny bas i wyraźny wzrost (drop/uderzenie), z odstępem
      if (bass > 190 && rising > 10 && now - lastVib.current > 150) {
        lastVib.current = now;
        const strength = bass > 235 ? 45 : 26;
        nav.vibrate(strength);
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { analyser?.disconnect(); } catch { /* */ }
    };
  }, [audioEl, enabled]);
}
