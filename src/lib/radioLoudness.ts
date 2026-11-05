// Głośność utworów radia z pomiaru w GitHub Actions (public/radio-loudness.json, EBU R128).
// Radio wyrównuje głośność do −14 LUFS (ścisza głośne, lekko podgłaśnia ciche) i pomija martwe/ciche pliki.
export type LoudEntry = { l?: number; s?: number; d?: number | null; dead?: boolean; why?: string };
export type LoudReport = { updatedAt: string | null; checked: number; dead: number; silent: number; tracks: Record<string, LoudEntry> };

const TARGET = -14;
let cache: Promise<LoudReport | null> | null = null;
let data: LoudReport | null = null;

export function loadLoudness(timeoutMs = 3000): Promise<LoudReport | null> {
  if (!cache) {
    cache = Promise.race([
      fetch("/radio-loudness.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]).then((j) => { data = j as LoudReport | null; return data; });
  }
  return cache;
}

/** Plik martwy albo cichy (puste nagranie, >40% ciszy) — nie dawać na antenę. */
export function isOffAir(e: LoudEntry | undefined): boolean {
  if (!e) return false;
  if (e.dead) return true;
  if (typeof e.l === "number" && e.l < -40) return true;
  return !!(e.d && e.s && e.s / e.d > 0.4);
}

export function excludedIds(r: LoudReport | null): Set<string> {
  return new Set(Object.entries(r?.tracks ?? {}).filter(([, e]) => isOffAir(e)).map(([id]) => id));
}

/** Mnożnik głośności utworu (0,3–1,4); 1, gdy brak pomiaru. Głośność elementu i tak jest ograniczona do 1. */
export function trackGain(id: string | null | undefined): number {
  const l = id ? data?.tracks?.[id]?.l : undefined;
  if (typeof l !== "number") return 1;
  return Math.min(1.4, Math.max(0.3, Math.pow(10, (TARGET - l) / 20)));
}
