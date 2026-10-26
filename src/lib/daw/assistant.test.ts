import { describe, expect, it } from "vitest";
import { applyFxChange, parseAiJson, parseCommandLocally, tipsFor, type DawState } from "./assistant";
import { FLAT_FX } from "./dsp";

const state: DawState = {
  bpm: 100, tracks: [{ name: "Wokal", kind: "vocal", clips: 1, recorded: true, processed: false, autotuned: false, muted: false }],
  micOn: false, monitor: false, speakers: false, armed: false, clipping: false, saved: false,
};

describe("lokalny parser poleceń", () => {
  it("głos cieplejszy i więcej pogłosu → zmiany efektów wokalu", () => {
    const r = parseCommandLocally("Zrób głos cieplejszy i więcej pogłosu", state);
    expect(r.actions).toEqual([{ type: "fx", track: "Wokal", add: { eqLow: 2, eqHigh: -1, air: -1, reverb: 20 }, set: {} }]);
  });
  it("perkusja, tempo, bas w tonacji", () => {
    const r = parseCommandLocally("dodaj perkusję hip-hop na 8 taktów, tempo 90 i bas w A-moll", state);
    expect(r.actions).toContainEqual({ type: "bpm", value: 90 });
    expect(r.actions).toContainEqual({ type: "drums", style: "Hip-hop", bars: 8 });
    expect(r.actions).toContainEqual({ type: "harmony", part: "bass", key: "A", progression: "minor", bars: 8 });
  });
  it("autotune w C-dur i obróbka", () => {
    const r = parseCommandLocally("autotune w C-dur i popraw mój głos", state);
    expect(r.actions).toContainEqual({ type: "autotune", track: "Wokal", key: "C", scale: "major", strength: 0.8, speedMs: 40 });
    expect(r.actions).toContainEqual({ type: "smart", track: "Wokal" });
  });
  it("niezrozumiałe polecenie → podpowiedź", () => {
    expect(parseCommandLocally("xyz", state).actions).toHaveLength(0);
  });
});

describe("pomocnicze", () => {
  it("zmiany efektów mieszczą się w zakresach suwaków", () => {
    const fx = applyFxChange({ ...FLAT_FX, reverb: 90 }, { gate: -50 }, { reverb: 20, presence: 3 });
    expect(fx.reverb).toBe(100);
    expect(fx.gate).toBe(-50);
    expect(fx.presence).toBe(3);
  });
  it("JSON z odpowiedzi modelu w bloku kodu", () => {
    expect(parseAiJson('```json\n{"reply":"Ok","actions":[{"type":"bpm","value":90}]}\n```')).toEqual({ reply: "Ok", actions: [{ type: "bpm", value: 90 }] });
    expect(parseAiJson("bez json")).toBeNull();
  });
  it("podpowiedzi: nagranie bez obróbki i niezapisany projekt", () => {
    const ids = tipsFor(state).map((t) => t.id);
    expect(ids).toContain("smart-Wokal");
    expect(ids).toContain("save");
  });
});
