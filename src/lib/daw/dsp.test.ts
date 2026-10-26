import { describe, expect, it } from "vitest";
import { analyzeVocal, chordNotes, DRUM_PRESETS, smartVocalFx, snap } from "./dsp";

const SR = 44_100;

/** „Głos”: ton 220 Hz z harmonicznymi, frazy przerywane ciszą z cichym szumem i dudnieniem 50 Hz. */
function fakeVocal(level: number, hum: number) {
  const x = new Float32Array(SR * 4);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const phrase = Math.floor(t * 2) % 2 === 0 ? 1 : 0;
    const voice = Math.sin(2 * Math.PI * 220 * t) + 0.3 * Math.sin(2 * Math.PI * 660 * t) + 0.15 * Math.sin(2 * Math.PI * 2640 * t);
    x[i] = phrase * level * voice + hum * Math.sin(2 * Math.PI * 50 * t) + 0.001 * (Math.random() - 0.5);
  }
  return x;
}

describe("analiza głosu i inteligentne ustawienia", () => {
  it("cichy głos z dudnieniem: wzmocnienie, bramka i mocniejszy filtr", () => {
    const a = analyzeVocal(fakeVocal(0.03, 0.01), SR);
    expect(a.rmsDb).toBeLessThan(-25);
    const s = smartVocalFx(a);
    expect(s.gainDb).toBeGreaterThan(5);
    expect(s.fx.gate).toBeGreaterThan(-90);
    expect(s.fx.hpf).toBeGreaterThanOrEqual(100);
    expect(s.notes.length).toBeGreaterThan(0);
  });

  it("głośny czysty głos: bez wzmacniania", () => {
    const s = smartVocalFx(analyzeVocal(fakeVocal(0.3, 0), SR));
    expect(s.gainDb).toBeLessThanOrEqual(2);
  });
});

describe("harmonia i siatka", () => {
  it("akord a-moll w C-dur (stopień vi)", () => {
    const { chord, bass } = chordNotes(0, 9, true);
    expect(chord).toEqual([69, 72, 76]);
    expect(bass).toBe(45);
  });
  it("wzorce mają 16 kroków, przyciąganie do siatki", () => {
    for (const p of Object.values(DRUM_PRESETS)) for (const row of Object.values(p)) expect(row).toHaveLength(16);
    expect(snap(1.26, 0.5)).toBe(1.5);
    expect(snap(-1, 0.5)).toBe(0);
  });
});
