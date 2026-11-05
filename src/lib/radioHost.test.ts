import { describe, expect, it } from "vitest";
import { AI_DISCLOSURE, cleanForAir, decideHost, hostLine, initialHostState, safeForAir } from "./radioHost";

const t = (title: string, artist = "GrouAI") => ({ title, artist });

describe("prezenterka: kiedy mówi", () => {
  it("powitanie, potem co 4 utwory, zmiana bloku i pełna godzina", () => {
    let s = initialHostState();
    const step = (block: any, hour: number, min: number) => { const r = decideHost(s, { block, hour, ms: min * 60_000 }); s = r.next; return r.kind; };
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
    const back = hostLine({ kind: "back", lang: "pl", hour: 21, minute: 5, block: "evening", dj: false, seed: 0, prev: t("Bass Night (Official Video)", "DJ Groua"), next: t("Neon Rain") });
    expect(back).toBe("To było „Bass Night, DJ Groua”. A teraz „Neon Rain, GrouAI”.");
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
