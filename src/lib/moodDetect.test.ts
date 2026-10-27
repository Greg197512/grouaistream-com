import { describe, expect, it } from "vitest";
import { analyzeMood, moodFromDetector, timeOfDayMood } from "./moodDetect";
import { SONG_STRUCTURES, sectionsFromLyrics, structureToLyrics, structureToPrompt } from "./songStructures";

describe("analiza nastroju", () => {
  it("filmowy opis z górami → epicki na czele, wysoka pewność", () => {
    const a = analyzeMood("Cinematic ambient journey through the mountains, sweeping strings and soft piano, building into an epic climax");
    expect(a.top[0]).toBe("epic");
    expect(a.confidence).toBeGreaterThan(70);
    expect(a.scores[0].pct).toBeGreaterThanOrEqual(a.scores[1].pct);
  });
  it("polski opis: spokojny lo-fi do nauki → spokojny", () => {
    expect(analyzeMood("spokojny lo-fi do nauki, deszcz za oknem").top[0]).toBe("chill");
  });
  it("brak słów nastroju → zero pewności", () => {
    expect(analyzeMood("xyz 123").confidence).toBe(0);
  });
  it("nastrój z detektora i pory dnia", () => {
    expect(moodFromDetector("Radosny", "Pop")).toBe("happy");
    expect(moodFromDetector("Zrelaksowany", "House")).toBe("chill");
    expect(timeOfDayMood(23).mood).toBe("chill");
    expect(timeOfDayMood(8).mood).toBe("happy");
  });
});

describe("struktury utworu", () => {
  it("szablon tekstu ma znaczniki, a odczyt je rozpoznaje", () => {
    const pop = SONG_STRUCTURES[0];
    const lyrics = structureToLyrics(pop, "pl");
    expect(lyrics).toContain("[Zwrotka 1]");
    expect(lyrics).toContain("[Refren]");
    const secs = sectionsFromLyrics(lyrics);
    expect(secs).toHaveLength(pop.sections.length);
    expect(secs.filter((x) => x.kind === "chorus")).toHaveLength(3);
    expect(structureToPrompt(pop, "en")).toMatch(/^structure: intro, verse 1, pre-chorus, chorus/);
  });
});
