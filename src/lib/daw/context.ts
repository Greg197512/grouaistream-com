// Wspólny AudioContext GrouAI Studio i szyna wyjściowa studia (DAW, gitara, instrumenty).
// Szyna ma analizator — z niego rysujemy widmo na żywo w nagłówku studia.

let ctx: AudioContext | null = null;
let bus: { input: GainNode; analyser: AnalyserNode } | null = null;

export const getCtx = () => (ctx ??= new AudioContext({ latencyHint: "interactive" }));

/** Wejście szyny studia: wszystko, co gra w studiu, trafia tutaj (→ analizator → głośniki). */
export function studioBus() {
  const c = getCtx();
  if (!bus) {
    const input = c.createGain();
    const analyser = c.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    input.connect(analyser).connect(c.destination);
    bus = { input, analyser };
  }
  return bus;
}

/** Analizator szyny tylko, jeśli kontekst już istnieje (nie tworzy go przed gestem użytkownika). */
export const studioAnalyser = () => (ctx ? studioBus().analyser : null);

/** Wysyłka gotowego nagrania do DAW (okno DAW wstawia je jako nową ścieżkę w miejscu wskaźnika). */
export type DawInsert = { name: string; buffer: AudioBuffer; kind: "audio" | "vocal" | "instrument" };
export const DAW_INSERT_EVENT = "grouai:daw-insert";
export const sendToDaw = (detail: DawInsert) => window.dispatchEvent(new CustomEvent<DawInsert>(DAW_INSERT_EVENT, { detail }));

/** Kontekst bez tworzenia (pętle rysujące nie powinny go uruchamiać przed gestem użytkownika). */
export const getCtxIfReady = () => ctx;

/** Tempo projektu DAW — gitara i instrumenty grają w tym samym tempie. */
export const DAW_BPM_EVENT = "grouai:daw-bpm";
let bpm = 100;
export const dawBpm = () => bpm;
export function publishBpm(v: number) {
  if (v === bpm) return;
  bpm = v;
  window.dispatchEvent(new CustomEvent<number>(DAW_BPM_EVENT, { detail: v }));
}
