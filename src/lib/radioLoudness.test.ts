import { describe, expect, it, vi } from "vitest";
import { excludedIds, isOffAir, loadLoudness, trackGain } from "./radioLoudness";
import { planDay } from "./radioClock";

describe("głośność i zdrowie anteny", () => {
  it("martwe i ciche pliki są poza anteną", () => {
    expect(isOffAir({ dead: true })).toBe(true);
    expect(isOffAir({ l: -45 })).toBe(true);
    expect(isOffAir({ l: -12, s: 100, d: 200 })).toBe(true);
    expect(isOffAir({ l: -12, s: 5, d: 200 })).toBe(false);
    expect(isOffAir(undefined)).toBe(false);
    const ex = excludedIds({ updatedAt: "x", checked: 3, dead: 1, silent: 0, tracks: { a: { dead: true }, b: { l: -14 } } });
    expect([...ex]).toEqual(["a"]);
    const pool = ["a", "b", "c"].map((id) => ({ id, title: id, artist: id, duration: 180, audio_url: `https://x/${id}.mp3`, cover_url: null, genre: "Pop" }));
    expect(planDay(pool, 2, "k", ex).items.some((x) => x.track.id === "a")).toBe(false);
  });
  it("wyrównanie do −14 LUFS z limitami", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ updatedAt: "x", checked: 2, dead: 0, silent: 0, tracks: { loud: { l: -8 }, quiet: { l: -20 }, very: { l: -2 } } }))));
    await loadLoudness();
    expect(trackGain("loud")).toBeCloseTo(0.501, 2);
    expect(trackGain("quiet")).toBeCloseTo(1.4, 2);
    expect(trackGain("very")).toBeCloseTo(0.3, 2);
    expect(trackGain("none")).toBe(1);
    vi.unstubAllGlobals();
  });
});
