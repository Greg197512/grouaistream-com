/** Krótka fanfara syntezowana w przeglądarce (bez plików audio). Wołać po geście użytkownika. */
export function playFanfare() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const out = ctx.createGain(); out.gain.value = 0.18; out.connect(ctx.destination);
    // C5 E5 G5 C6 ... G5 C6 E6 + akord końcowy
    const seq: [number, number, number][] = [
      [523.25, 0, .16], [523.25, .18, .16], [523.25, .36, .16], [659.25, .54, .34], [783.99, .92, .22], [659.25, 1.18, .16], [783.99, 1.36, .5],
      [1046.5, 1.95, .9],
    ];
    const tone = (f: number, t0: number, d: number, type: OscillatorType = "sawtooth") => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(out);
      const t = ctx.currentTime + t0;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.start(t); o.stop(t + d + .05);
    };
    seq.forEach(([f, t, d]) => { tone(f, t, d); tone(f / 2, t, d, "triangle"); });
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 1.95, 1.2, "square"));
    setTimeout(() => ctx.close().catch(() => {}), 4000);
  } catch { /* brak audio */ }
}
