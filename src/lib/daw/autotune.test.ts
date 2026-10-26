import { describe, expect, it } from "vitest";
import { autotune, nearestScaleNote, yinPitch } from "./autotune";

const SR = 44_100;
const tone = (hz: number, sec: number) =>
  Float32Array.from({ length: Math.round(SR * sec) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / SR) + 0.2 * Math.sin((4 * Math.PI * hz * i) / SR));

describe("autotune", () => {
  it("YIN wykrywa wysokość tonu", () => {
    expect(yinPitch(tone(220, 0.5), 2000, 1323, SR)).toBeCloseTo(220, 0);
  });

  it("najbliższa nuta skali C-dur omija dźwięki spoza skali", () => {
    expect(nearestScaleNote(60.7, 0, "major")).toBe(60); // między C a C# → C (C# nie ma w C-dur)
    expect(nearestScaleNote(60.7, 0, "chromatic")).toBe(61);
    expect(nearestScaleNote(68.6, 9, "minor")).toBe(69); // A-moll: G#/A → A
  });

  it("fałszujący dźwięk 452 Hz zostaje ściągnięty do A4 = 440 Hz, długość bez zmian", () => {
    const x = tone(452, 1.5);
    const { out, corrected } = autotune(x, SR, { keyRoot: 0, scale: "chromatic", strength: 1, speedMs: 0 });
    expect(out.length).toBe(x.length);
    expect(corrected).toBeGreaterThan(10);
    expect(Math.abs(yinPitch(out, 30_000, 1323, SR) - 440)).toBeLessThan(3);
  });

  it("siła 0 zostawia dźwięk bez zmian", () => {
    const x = tone(452, 0.8);
    const { out } = autotune(x, SR, { keyRoot: 0, scale: "chromatic", strength: 0, speedMs: 40 });
    expect(Math.abs(yinPitch(out, 15_000, 1323, SR) - 452)).toBeLessThan(2);
  });
});
