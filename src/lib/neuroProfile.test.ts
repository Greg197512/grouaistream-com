import { describe, expect, it } from "vitest";
import { build } from "./neuroProfile";

const T = (id: string, genre: string, mood: string, bpm: number, energy: number, title = id) =>
  ({ id, title, artist: "A", genre, mood, bpm, energy, duration: 200 });

describe("neuro profile", () => {
  it("ranks genres by plays/likes, finds replays and times", () => {
    const tracks = new Map([
      ["a", T("a", "Hip-Hop", "energetic", 128, 0.8, "Beat")],
      ["b", T("b", "Pop", "happy", 110, 0.6)],
      ["c", T("c", "Jazz", "calm", 80, 0.3)],
    ]);
    const plays = [
      ...Array.from({ length: 5 }, (_, i) => ({ track_id: "a", played_at: `2026-11-0${i + 1}T21:00:00`, skipped: false, duration_played: 190, mood_detected: null })),
      { track_id: "b", played_at: "2026-11-02T08:00:00", skipped: false, duration_played: 100, mood_detected: "happy" },
      { track_id: "c", played_at: "2026-11-02T09:00:00", skipped: true, duration_played: 10, mood_detected: null },
    ];
    const p = build(plays, ["a"], [{ mood: "energetic" }], tracks);
    expect(p.top_genres?.[0]).toBe("Hip-Hop");
    expect(p.moods?.[0]).toBe("energia");
    expect(p.listening_times?.[0]).toMatch(/^wieczór/);
    expect(p.dopamine_triggers?.join(" ")).toMatch(/powroty: Beat \(5×\)/);
    expect(p.energy).toMatch(/wysoka/);
    expect(p.summary).toMatch(/wieczorem/);
    expect(p.recommendation).toMatch(/trap/);
  });
});
