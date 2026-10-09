import { describe, expect, it } from "vitest";
import { weeklyArtwork } from "./weeklyArtwork";

describe("weekly artwork", () => {
  it("keeps the same artwork throughout a UTC week", () => {
    expect(weeklyArtwork(Date.UTC(2026, 9, 5))).toBe(weeklyArtwork(Date.UTC(2026, 9, 11, 23, 59)));
  });
  it("changes on Monday and cycles safely", () => {
    const start = Date.UTC(2026, 9, 5);
    expect(weeklyArtwork(start)).not.toBe(weeklyArtwork(start + 604800000));
    expect(weeklyArtwork(start)).toBe(weeklyArtwork(start + 3 * 604800000));
    expect(weeklyArtwork(start - 604800000)).toBeTruthy();
  });
});