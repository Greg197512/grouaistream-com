import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        not: () => ({
          limit: () => Promise.resolve({
            data: [
              { id: "1", title: "A", artist: "X", duration: 180, audio_url: "https://r2/1.mp3", cover_url: null, genre: "Hip-Hop" },
              { id: "2", title: "B", artist: "Y", duration: 200, audio_url: "https://r2/2.mp3", cover_url: null, genre: "Lo-fi" },
              { id: "3", title: "C", artist: "Z", duration: 220, audio_url: "https://r2/3.mp3", cover_url: null, genre: "Rap" },
              { id: "4", title: "D", artist: "W", duration: 240, audio_url: "https://r2/4.mp3", cover_url: null, genre: "Dance" },
              { id: "5", title: "E", artist: "V", duration: 260, audio_url: "https://r2/5.mp3", cover_url: null, genre: "Ambient" },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/trackSnapshot", () => ({ loadTrackSnapshot: async () => [] }));

import { dayMood, stationNameFor, buildDailyRadio } from "./radioDaily";

describe("dayMood (dzień tygodnia → nastrój)", () => {
  it("czwartek, piątek, sobota → energia (party)", () => {
    expect(dayMood(4)).toBe("party");
    expect(dayMood(5)).toBe("party");
    expect(dayMood(6)).toBe("party");
  });
  it("niedziela → spokój (calm)", () => {
    expect(dayMood(0)).toBe("calm");
  });
  it("poniedziałek–środa → mix", () => {
    expect([1, 2, 3].map(dayMood)).toEqual(["mixed", "mixed", "mixed"]);
  });
  it("nazwy stacji odpowiadają nastrojowi", () => {
    expect(stationNameFor("party")).toMatch(/Weekend/);
    expect(stationNameFor("calm")).toMatch(/Niedziela/);
  });
});

describe("buildDailyRadio", () => {
  it("zwraca playlistę z utworami i kotwicę startu o północy (Warszawa)", async () => {
    const r = await buildDailyRadio("public");
    expect(r).not.toBeNull();
    expect(r!.tracks.length).toBeGreaterThan(0);
    // Kotwica to północ czasu polskiego, czyli 22:00 lub 23:00 UTC dnia poprzedniego
    const hourUTC = new Date(r!.startedAtISO).getUTCHours();
    expect([22, 23]).toContain(hourUTC);
    expect(r!.dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("jest deterministyczna w obrębie dnia (ten sam porządek dla wszystkich)", async () => {
    const a = await buildDailyRadio("public");
    const b = await buildDailyRadio("public");
    expect(a!.tracks.map((t) => t.id)).toEqual(b!.tracks.map((t) => t.id));
  });

  it("nie zwraca dwóch kolejnych utworów tego samego wykonawcy (gdy katalog to pozwala)", async () => {
    const r = await buildDailyRadio("public");
    for (let i = 1; i < r!.tracks.length; i++) {
      expect(r!.tracks[i].artist).not.toBe(r!.tracks[i - 1].artist);
    }
  });
});
