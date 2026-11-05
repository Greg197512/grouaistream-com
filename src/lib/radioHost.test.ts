import { describe, expect, it } from "vitest";
import type { BlockId } from "./radioClock";
import { AI_DISCLOSURE, FUN, cleanForAir, decideHost, hostLine, initialHostState, pickJoke, safeForAir, wantsJoke } from "./radioHost";

const t = (title: string, artist = "GrouAI") => ({ title, artist });

describe("prezenterka: kiedy mówi", () => {
  it("powitanie, potem co 4 utwory, zmiana bloku i pełna godzina", () => {
    let s = initialHostState();
    const step = (block: BlockId, hour: number, min: number) => { const r = decideHost(s, { block, hour, ms: min * 60_000 }); s = r.next; return r.kind; };
    expect(step("day", 12, 0)).toBe("welcome");
    expect(step("day", 12, 3)).toBeNull();
    expect(step("day", 12, 6)).toBeNull();
    expect(step("day", 12, 9)).toBeNull();
    expect(step("day", 12, 12)).toBe("back");          // 4. utwór od ostatniej kwestii
    expect(step("day", 13, 14)).toBeNull();             // pełna godzina, ale za krótko od ostatniej (6 min)
    expect(step("day", 13, 19)).toBeNull();             // godzina już „zaliczona” (lastHour = 13)
    expect(step("afternoon", 16, 40)).toBe("block");    // zmiana bloku zawsze
  });
});

describe("prezenterka: teksty", () => {
  it("zapowiedź z tytułami, czas i ujawnienie AI w 4 językach", () => {
    const back = hostLine({ kind: "back", lang: "pl", hour: 21, minute: 5, block: "evening", dj: false, seed: 1, prev: t("Bass Night (Official Video)", "DJ Groua"), next: t("Neon Rain") });
    expect(back).toBe("Przed chwilą „Bass Night, DJ Groua”. Lecimy dalej: „Neon Rain, GrouAI”.");
    const hour = hostLine({ kind: "hour", lang: "en", hour: 9, minute: 0, block: "morning", dj: false, seed: 0, next: null });
    expect(hour).toContain("09:00");
    expect(hour).toMatch(/AI voice/);
    const block = hostLine({ kind: "block", lang: "nl", hour: 18, minute: 0, block: "weekend-disco", dj: true, seed: 1, next: t("Groove") });
    expect(block).toContain("weekenddisco");
    expect(block).toContain("hiphop en disco");
    expect(hostLine({ kind: "welcome", lang: "ua", hour: 1, minute: 0, block: "night", dj: false, seed: 0 })).toContain("ШІ");
    for (const l of ["pl", "en", "nl", "ua"] as const) expect(AI_DISCLOSURE[l]).toMatch(/AI|ШІ/);
  });
  it("filtr treści: pomija wulgarne tytuły i linki, czyści dopiski", () => {
    expect(safeForAir("Fuck this")).toBe(false);
    expect(safeForAir("zobacz https://x.pl")).toBe(false);
    expect(cleanForAir("Track_01 (Official Lyric Video) 🔥.mp3")).toBe("Track 01");
    const line = hostLine({ kind: "back", lang: "pl", hour: 1, minute: 0, block: "night", dj: false, seed: 0, prev: t("Kurwa mać"), next: t("Spokój") });
    expect(line).not.toMatch(/kurw/i);
    expect(line).toContain("Spokój");
    expect(hostLine({ kind: "back", lang: "pl", hour: 1, minute: 0, block: "night", dj: false, seed: 0, prev: null, next: null })).toBeNull();
  });
});

describe("prezenterka: humor", () => {
  it("żartuje czasami (ok. co trzecią kwestię), nie zawsze", () => {
    const n = Array.from({ length: 60 }, (_, i) => wantsJoke(i, 12)).filter(Boolean).length;
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(30);
  });
  it("żart pasuje do pory i bloku, wszystkie przechodzą filtr treści", () => {
    expect([...FUN.pl.morning, ...FUN.pl.general]).toContain(pickJoke("pl", "morning", 7, false, 0));
    expect(FUN.pl.general).not.toContain(FUN.pl.morning[0]);
    expect([...FUN.en.weekend, ...FUN.en.general]).toContain(pickJoke("en", "weekend-disco", 20, false, 1));
    expect([...FUN.nl.dj, ...FUN.nl.general]).toContain(pickJoke("nl", "weekend-hiphop", 21, true, 2));
    for (const l of ["pl", "en", "nl", "ua"] as const) for (const arr of Object.values(FUN[l])) for (const j of arr) expect(safeForAir(j)).toBe(true);
    const line = hostLine({ kind: "hour", lang: "pl", hour: 0, minute: 0, block: "night", dj: false, seed: 0, next: null });
    expect(line).toMatch(/głos AI/);
    expect(FUN.pl.night.concat(FUN.pl.general).some((j) => line!.includes(j))).toBe(true);
  });
});
