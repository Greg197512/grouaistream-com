import { describe, expect, it } from "vitest";
import { planChallenge } from "./weekendChallenge";

const base = { uploads: { last: 10, prev: 10 }, ratings: { last: 40, prev: 40 }, mood_sessions: { last: 5, prev: 20 }, studio_tracks: { last: 8, prev: 6 }, listens: { last: 300, prev: 280 } };

describe("weekend challenge algorithm", () => {
  it("boosts the activity that drops the most", () => {
    const p = planChallenge(base, null, new Date("2026-11-05T12:00:00"));
    expect(p.activity_type).toBe("mood_sessions");
    expect(p.target_count).toBeGreaterThanOrEqual(3);
    expect(p.target_count).toBeLessThanOrEqual(7);
    expect(p.reward_amount).toBeGreaterThanOrEqual(1);
    expect(p.reward_amount).toBeLessThanOrEqual(5);
    expect(new Date(p.ends_at).getDay()).toBe(0); // niedziela
  });
  it("does not repeat the last challenge", () => {
    const p = planChallenge(base, "mood_sessions");
    expect(p.activity_type).not.toBe("mood_sessions");
  });
});
