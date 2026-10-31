import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({}) },
}));

import { pickStoryOverride, type StorySlotRow } from "./radioStories";

const horror = (id: string, created_at: string): StorySlotRow => ({
  id,
  slot: "Horror na wieczór",
  title: `Horror ${id}`,
  audio_url: `https://r2/${id}.mp3`,
  duration_sec: 600,
  air_times: ["21:00:00"],
  created_at,
});

const nocna = (id: string, created_at: string, dur = 720): StorySlotRow => ({
  id,
  slot: "Nocna Rozmowa",
  title: `Nocna Rozmowa ${id}`,
  audio_url: `https://r2/tracks/${id}-nocna-rozmowa.mp3`,
  duration_sec: dur,
  air_times: ["23:00:00"],
  created_at,
});

describe("pickStoryOverride", () => {
  it("poza oknem emisji nie przerywa muzyki", () => {
    // 15 czerwca 2026, 18:00 czasu polskiego (CEST, UTC+2)
    const now = new Date("2026-06-15T16:00:00Z");
    expect(pickStoryOverride([horror("a", "2026-06-01T00:00:00Z"), nocna("b", "2026-06-14T00:00:00Z")], now)).toBeNull();
  });

  it("w oknie horroru bierze rotację dnia, nie najnowszy plik", () => {
    const now = new Date("2026-06-15T19:00:30Z"); // 21:00:30 Warszawa
    const rows = [horror("old", "2026-01-01T00:00:00Z"), horror("new", "2026-06-01T00:00:00Z")];
    const first = pickStoryOverride(rows, now);
    const nextDay = pickStoryOverride(rows, new Date("2026-06-16T19:00:30Z"));
    expect(first?.story.id).not.toBe(nextDay?.story.id);
    expect(first?.offset).toBeGreaterThan(20);
    expect(first?.offset).toBeLessThan(40);
  });

  it("o 23:00 gra najnowszą Nocną Rozmowę, nie archiwum", () => {
    const now = new Date("2026-06-15T21:05:00Z"); // 23:05 Warszawa
    const picked = pickStoryOverride([
      nocna("26", "2026-10-26T22:00:00Z"),
      nocna("31", "2026-10-31T22:00:00Z"),
      nocna("30", "2026-10-30T22:00:00Z"),
    ], now);
    expect(picked?.story.id).toBe("31");
    expect(picked?.offset).toBeGreaterThan(290);
    expect(picked?.offset).toBeLessThan(310);
  });

  it("po końcu odcinka wraca null (muzyka)", () => {
    const now = new Date("2026-06-15T21:30:00Z"); // 23:30, odcinek 12 min już się skończył
    expect(pickStoryOverride([nocna("31", "2026-10-31T22:00:00Z", 720)], now)).toBeNull();
  });
});
