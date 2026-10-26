import { describe, expect, it } from "vitest";
import { barSeconds, cutSample, estimateBpm, peaks, runsOf } from "./stemsWorkbench";

const SR = 22_050;

describe("estimateBpm", () => {
  it("rozpoznaje tempo regularnych uderzeń", () => {
    const bpm = 128;
    const x = new Float32Array(SR * 12);
    const period = Math.round((60 / bpm) * SR);
    for (let t = 0; t < x.length; t += period) for (let i = 0; i < 400 && t + i < x.length; i++) x[t + i] = Math.sin(i / 3) * (1 - i / 400);
    expect(Math.abs(estimateBpm(x, SR) - bpm)).toBeLessThanOrEqual(2);
  });
});

describe("runsOf", () => {
  it("łączy sąsiednie kafelki w odcinki", () => {
    expect(runsOf([true, true, false, true, false, true, true, true])).toEqual([[0, 2], [3, 1], [5, 3]]);
    expect(runsOf([false, false])).toEqual([]);
  });
});

describe("cutSample", () => {
  it("wycina, odwraca i wycisza brzegi", () => {
    const ch = Float32Array.from({ length: 100 }, (_, i) => i / 100);
    const [s] = cutSample([ch], 100, { start: 0.1, length: 0.5, reverse: true, fadeInMs: 0, fadeOutMs: 100, gain: 1 });
    expect(s.length).toBe(50);
    expect(s[0]).toBeCloseTo(0.59, 5); // odwrócone: zaczyna od końca wycinka
    expect(s[49]).toBe(0); // koniec wyciszony
  });
});

describe("pomocnicze", () => {
  it("długość taktu i szczyty", () => {
    expect(barSeconds(120)).toBe(2);
    expect(Array.from(peaks(Float32Array.from([0, -1, 0.5, 0.2]), 2))).toEqual([1, 0.5]);
  });
});
