// Wspólny, lekki dostęp do czujników ruchu telefonu:
//  • subscribeOrientation(cb) — przechył telefonu (gamma L/R, beta przód/tył), znormalizowany −1..1
//  • subscribeShake(cb)       — potrząśnięcie (akcelerometr), z debounce
// Jedna para nasłuchów współdzielona przez wielu subskrybentów. iOS 13+ wymaga
// zgody po geście użytkownika — ensureMotionPermission() prosi o nią przy 1. dotknięciu.
// Wszystko w try/catch: brak czujnika / brak zgody = ciche no-op.

type OrientCb = (t: { gamma: number; beta: number }) => void;
type ShakeCb = () => void;

const orientSubs = new Set<OrientCb>();
const shakeSubs = new Set<ShakeCb>();
let started = false;
let base: { gamma: number; beta: number } | null = null;

// --- shake ---
let lastX = 0, lastY = 0, lastZ = 0, lastShake = 0, primed = false;

function onOrient(e: DeviceOrientationEvent) {
  const gammaRaw = e.gamma ?? 0; // lewo/prawo, -90..90
  const betaRaw = e.beta ?? 0;   // przód/tył, -180..180
  if (!base) base = { gamma: gammaRaw, beta: betaRaw };
  // Względem pozycji startowej, zaklamrowane do rozsądnego zakresu.
  const gamma = Math.max(-1, Math.min(1, (gammaRaw - base.gamma) / 30));
  const beta = Math.max(-1, Math.min(1, (betaRaw - base.beta) / 30));
  orientSubs.forEach((cb) => cb({ gamma, beta }));
}

function onMotion(e: DeviceMotionEvent) {
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const x = a.x ?? 0, y = a.y ?? 0, z = a.z ?? 0;
  if (!primed) { lastX = x; lastY = y; lastZ = z; primed = true; return; }
  const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
  lastX = x; lastY = y; lastZ = z;
  const now = Date.now();
  if (delta > 32 && now - lastShake > 1200) {   // próg potrząśnięcia + debounce
    lastShake = now;
    shakeSubs.forEach((cb) => cb());
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    window.addEventListener("deviceorientation", onOrient, { passive: true });
    window.addEventListener("devicemotion", onMotion, { passive: true });
  } catch { /* */ }
}

/** iOS 13+: poproś o zgodę na czujniki (musi być z gestu). Bezpieczne wielokrotnie. */
export function ensureMotionPermission() {
  try {
    const DOE: any = (window as any).DeviceOrientationEvent;
    const DME: any = (window as any).DeviceMotionEvent;
    if (DOE && typeof DOE.requestPermission === "function") DOE.requestPermission().then(() => start()).catch(() => {});
    if (DME && typeof DME.requestPermission === "function") DME.requestPermission().catch(() => {});
  } catch { /* */ }
  start();
}

// Na urządzeniach bez wymogu zgody wystarczy 1. dotyk, by wystartować nasłuch.
if (typeof window !== "undefined") {
  const kick = () => { ensureMotionPermission(); window.removeEventListener("touchstart", kick); window.removeEventListener("click", kick); };
  window.addEventListener("touchstart", kick, { once: true, passive: true });
  window.addEventListener("click", kick, { once: true });
}

export function subscribeOrientation(cb: OrientCb): () => void {
  orientSubs.add(cb); start();
  return () => orientSubs.delete(cb);
}
export function subscribeShake(cb: ShakeCb): () => void {
  shakeSubs.add(cb); start();
  return () => shakeSubs.delete(cb);
}
