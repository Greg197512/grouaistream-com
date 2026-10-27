import { describe, expect, it } from "vitest";
import { chordShape, noteToFret, parseChord, pluckString, TUNINGS, tunerReading } from "./guitar";
import { yinPitch } from "./autotune";

const STD = TUNINGS[0].strings;
const SR = 44_100;

describe("akordy", () => {
  it("rozpoznaje nazwy akordów", () => {
    expect(parseChord("Am7")).toEqual({ root: 9, type: "m7" });
    expect(parseChord("F#")).toEqual({ root: 6, type: "" });
    expect(parseChord("Bbmaj7")).toEqual({ root: 10, type: "maj7" });
    expect(parseChord("H")).toBeNull();
  });
  it("chwyty w stroju standard zawierają dźwięki akordu i bas na prymie", () => {
    for (const name of ["C", "G", "Am", "E", "D", "F", "Em", "A7"]) {
      const shape = chordShape(name, STD)!;
      expect(shape, name).not.toBeNull();
      const c = parseChord(name)!;
      const first = shape.findIndex((f) => f >= 0);
      expect((STD[first] + shape[first]) % 12, `${name} bas`).toBe(c.root);
      expect(shape.filter((f) => f >= 0).length).toBeGreaterThanOrEqual(3);
    }
  });
  it("kapodaster przesuwa chwyt", () => {
    const shape = chordShape("D", STD, 2)!;
    expect(shape.every((f) => f === -1 || f >= 2)).toBe(true);
  });
});

describe("struna i stroik", () => {
  it("synteza struny brzmi na zadanej wysokości (A2 = 110 Hz)", () => {
    const x = pluckString(110, SR, 1, { brightness: 0.6, pickPos: 0.2, sustain: 0.6, palmMute: false });
    expect(Math.abs(yinPitch(x, 4000, 2000, SR, 50, 500) - 110)).toBeLessThan(1.5);
  });
  it("tłumienie dłonią gasi dźwięk szybciej", () => {
    const rms = (a: Float32Array, from: number) => Math.sqrt(a.slice(from, from + 2000).reduce((s, v) => s + v * v, 0) / 2000);
    const open = pluckString(196, SR, 1, { brightness: 0.6, pickPos: 0.2, sustain: 0.6, palmMute: false });
    const muted = pluckString(196, SR, 1, { brightness: 0.6, pickPos: 0.2, sustain: 0.6, palmMute: true });
    expect(rms(muted, 20000)).toBeLessThan(rms(open, 20000) * 0.2);
  });
  it("nuta → struna/próg, odczyt stroika", () => {
    expect(noteToFret(64, STD)).toEqual({ string: 5, fret: 0 });
    expect(noteToFret(45, STD)).toEqual({ string: 1, fret: 0 });
    const r = tunerReading(111, STD);
    expect(r.note).toBe("A2");
    expect(r.string).toBe(1);
    expect(r.stringCents).toBeGreaterThan(10);
  });
});
