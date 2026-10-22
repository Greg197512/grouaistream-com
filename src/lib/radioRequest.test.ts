import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { parseRadioRequest } from "./radioRequest";

// 22 paź 2026, 10:00 UTC = 12:00 w Warszawie (CEST, UTC+2)
const NOW = new Date("2026-10-22T10:00:00Z");

const warsawHM = (d: Date) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(d);

describe("parseRadioRequest", () => {
  it("rozpoznaje wykonawcę i tytuł z godziną", () => {
    const p = parseRadioRequest("zagraj Kult - Dziewczyna o 20:30", NOW);
    expect(p?.kind).toBe("song");
    if (p?.kind !== "song") throw new Error();
    expect(p.artist).toBe("Kult");
    expect(p.title).toBe("Dziewczyna");
    expect(warsawHM(p.playAt)).toBe("20:30");
  });

  it("godzina bez minut i przejście na następny dzień", () => {
    const p = parseRadioRequest("puść Dziewczyna Kult o 9", NOW);
    expect(warsawHM(p!.playAt)).toBe("09:00");
    // 9:00 już minęło (jest 12:00) → jutro
    expect(p!.playAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(p!.playAt.getTime() - NOW.getTime()).toBeLessThan(24 * 3600_000);
  });

  it("'teraz' oznacza start od razu (w ciągu kilku sekund)", () => {
    const p = parseRadioRequest("zagraj teraz Kult - Dziewczyna", NOW);
    expect(p!.playAt.getTime() - NOW.getTime()).toBeLessThanOrEqual(10_000);
  });

  it("bez godziny też gra od razu", () => {
    const p = parseRadioRequest("zagraj Kult - Dziewczyna", NOW);
    expect(p!.playAt.getTime() - NOW.getTime()).toBeLessThanOrEqual(10_000);
  });

  it("link YouTube: wyciąga ID i nie zostawia śmieci w tytule", () => {
    const p = parseRadioRequest("zagraj https://youtu.be/dQw4w9WgXcQ o 19:15", NOW);
    expect(p?.kind).toBe("youtube");
    if (p?.kind !== "youtube") throw new Error();
    expect(p.youtubeId).toBe("dQw4w9WgXcQ");
    expect(p.title).toBe("Wideo z YouTube");
    expect(warsawHM(p.playAt)).toBe("19:15");
  });

  it("zwykłe pytania i rozmowa nie są prośbą o utwór", () => {
    expect(parseRadioRequest("jaka jest pogoda", NOW)).toBeNull();
    expect(parseRadioRequest("", NOW)).toBeNull();
  });
});
