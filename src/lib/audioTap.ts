// Wspólny „tap" audio dla całej aplikacji.
//
// Problem, który to rozwiązuje: `createMediaElementSource(el)` można wywołać
// dla danego elementu <audio> TYLKO RAZ. Dwa hooki (useAudioAnalyser i
// useHapticBass) robiły to niezależnie → drugie wywołanie rzucało
// InvalidStateError, co potrafiło uciszyć dźwięk albo rozstroić wizualizer
// („skakanie"). Tutaj tworzymy kontekst + źródło DOKŁADNIE RAZ na element
// (cache na samym elemencie) i współdzielimy je. Każdy konsument podłącza
// własny AnalyserNode od wspólnego źródła (źródło może mieć wiele odbiorników).
//
// Ważne: dla mediów cross-origin (pliki z R2/hub) routowanie przez Web Audio
// wycisza dźwięk (brak CORS na strumieniu) — dlatego dla nich NIE tworzymy
// tapa i zwracamy null. Konsumenci wtedy używają trybu symulowanego.

interface AudioTap {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
}

interface TappedEl extends HTMLAudioElement {
  __grouaiTap?: AudioTap | null; // null = świadomie pominięty (cross-origin/brak API)
}

function isCrossOrigin(el: HTMLAudioElement): boolean {
  const src = el.currentSrc || el.src;
  if (!src) return false;
  try {
    return new URL(src, window.location.href).origin !== window.location.origin;
  } catch {
    return true;
  }
}

/**
 * Zwraca współdzielony { ctx, source } dla elementu audio albo null, gdy tap
 * jest niemożliwy/niewskazany (cross-origin, brak Web Audio). Tworzy zasoby
 * tylko raz; kolejne wywołania zwracają ten sam obiekt. Źródło jest podłączone
 * do wyjścia (ctx.destination), więc dźwięk gra normalnie.
 */
export function getAudioTap(el: HTMLAudioElement | null): AudioTap | null {
  if (!el) return null;
  const tapped = el as TappedEl;
  if (tapped.__grouaiTap !== undefined) return tapped.__grouaiTap; // już rozstrzygnięte (obiekt lub null)

  if (isCrossOrigin(el)) {
    tapped.__grouaiTap = null; // nie ruszamy dźwięku cross-origin
    return null;
  }

  const AC: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) {
    tapped.__grouaiTap = null;
    return null;
  }

  try {
    const ctx = new AC();
    const source = ctx.createMediaElementSource(el);
    source.connect(ctx.destination); // dźwięk bez zmian trafia do głośnika
    const tap: AudioTap = { ctx, source };
    tapped.__grouaiTap = tap;
    return tap;
  } catch {
    // np. element już podłączony w innym kontekście — pomijamy tap
    tapped.__grouaiTap = null;
    return null;
  }
}

/** Wznów kontekst, jeśli został zawieszony (wymóg autoplay policy). */
export function resumeTap(tap: AudioTap | null): void {
  if (tap && tap.ctx.state === "suspended") void tap.ctx.resume().catch(() => {});
}
