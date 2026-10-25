// Łańcuch efektów per ścieżka — Web Audio API, zero zależności zewnętrznych.
// Działa identycznie w trybie na żywo (AudioContext) i przy offline-renderze
// miksu (OfflineAudioContext), bo oba implementują ten sam interfejs BaseAudioContext.

export type TrackFx = {
  eqLow: number; // dB, -12..+12 — pasmo niskie (~120 Hz shelf)
  eqMid: number; // dB, -12..+12 — pasmo średnie (~1 kHz peak)
  eqHigh: number; // dB, -12..+12 — pasmo wysokie (~8 kHz shelf)
  compress: number; // 0..100 — ile kompresji (0 = wyłączona)
  reverb: number; // 0..100 — ile pogłosu domieszane do sygnału
  delay: number; // 0..100 — ile echa domieszane
};

export const DEFAULT_FX: TrackFx = { eqLow: 0, eqMid: 0, eqHigh: 0, compress: 0, reverb: 0, delay: 0 };

// Krótki, syntetyczny impuls pogłosowy (wykładniczo zanikający szum) —
// nie wymaga pliku IR, brzmi jak mała/średnia sala.
function makeImpulse(ctx: BaseAudioContext, seconds = 2.2, decay = 3.2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/** Buduje łańcuch EQ(3-pasmowy) → kompresor → (suche + pogłos + echo) → output.
 *  Zwraca węzeł wejściowy (podłącz tu źródło) — reszta jest już połączona z `destination`. */
export function buildFxChain(ctx: BaseAudioContext, fx: TrackFx, destination: AudioNode): AudioNode {
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf"; low.frequency.value = 120; low.gain.value = fx.eqLow;

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.9; mid.gain.value = fx.eqMid;

  const high = ctx.createBiquadFilter();
  high.type = "highshelf"; high.frequency.value = 8000; high.gain.value = fx.eqHigh;

  low.connect(mid).connect(high);

  // Kompresor — im wyższy suwak, tym niższy próg i większy stosunek.
  const comp = ctx.createDynamicsCompressor();
  const amt = Math.max(0, Math.min(100, fx.compress)) / 100;
  comp.threshold.value = -6 - amt * 34; // 0 → -6dB .. 100 → -40dB
  comp.ratio.value = 1 + amt * 11; // 0 → 1:1 .. 100 → 12:1
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  high.connect(comp);

  // Suchy sygnał zawsze w miksie.
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;
  comp.connect(dryGain).connect(destination);

  if (fx.reverb > 0) {
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx);
    const wetGain = ctx.createGain();
    wetGain.gain.value = (fx.reverb / 100) * 0.9;
    comp.connect(convolver).connect(wetGain).connect(destination);
  }

  if (fx.delay > 0) {
    const delayNode = ctx.createDelay(1.5);
    delayNode.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const wetGain = ctx.createGain();
    wetGain.gain.value = (fx.delay / 100) * 0.7;
    comp.connect(delayNode);
    delayNode.connect(feedback).connect(delayNode); // pętla echa
    delayNode.connect(wetGain).connect(destination);
  }

  return low; // podłącz źródło tutaj
}

export const FX_IS_DEFAULT = (fx: TrackFx) =>
  fx.eqLow === 0 && fx.eqMid === 0 && fx.eqHigh === 0 && fx.compress === 0 && fx.reverb === 0 && fx.delay === 0;
