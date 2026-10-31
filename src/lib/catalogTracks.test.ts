import { describe, expect, it } from "vitest";
import { isRadioOnlyTrack, omitRadioOnlyTracks } from "./catalogTracks";

describe("isRadioOnlyTrack", () => {
  it("zostawia zwykły utwór", () => {
    expect(isRadioOnlyTrack({ title: "Midnight Drive", audio_url: "https://r2.dev/tracks/1.mp3" })).toBe(false);
  });

  it("rozpoznaje tytuł Nocnej Rozmowy", () => {
    expect(isRadioOnlyTrack({ title: "Nocna Rozmowa 31.10", audio_url: "https://r2.dev/tracks/x.mp3" })).toBe(true);
    expect(isRadioOnlyTrack({ title: "nocna-rozmowa", audio_url: null })).toBe(true);
  });

  it("rozpoznaje plik audio odcinka", () => {
    expect(isRadioOnlyTrack({
      title: "Rozmowa",
      audio_url: "https://pub.r2.dev/tracks/1761000000-nocna-rozmowa-2026-10-31.mp3",
    })).toBe(true);
  });

  it("szanuje flagę catalog_hidden", () => {
    expect(isRadioOnlyTrack({ title: "Cokolwiek", audio_url: "https://r2/a.mp3", catalog_hidden: true })).toBe(true);
  });
});

describe("omitRadioOnlyTracks", () => {
  it("wycina tylko odcinki", () => {
    const rows = omitRadioOnlyTracks([
      { title: "Hit", audio_url: "https://r2/hit.mp3" },
      { title: "Nocna Rozmowa 30.10", audio_url: "https://r2/tracks/t-nocna-rozmowa-2026-10-30.mp3" },
    ]);
    expect(rows.map((r) => r.title)).toEqual(["Hit"]);
  });
});
