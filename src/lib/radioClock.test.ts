import { describe, expect, it } from "vitest";
import { blockAt, passesQualityGate, planDay, type ClockTrack } from "./radioClock";

const GENRES = ["Disco", "House", "Hip-Hop", "Pop", "Lo-Fi", "Techno", "Rap", "Rock", "Ambient", "Funk"];
const pool: ClockTrack[] = Array.from({ length: 240 }, (_, i) => ({
  id: `t${String(i).padStart(3, "0")}`, title: `Utwór ${i}`, artist: `Artysta ${i % 17}`,
  duration: 150 + (i % 7) * 20, audio_url: `https://pub.r2.dev/t${i}.mp3`, cover_url: null, genre: GENRES[i % GENRES.length],
}));

describe("ramówka (blockAt)", () => {
  it("dni robocze: noc, poranek, dzień, popołudnie, wieczór", () => {
    expect([2, 7, 12, 17, 21].map((h) => blockAt(2, h))).toEqual(["night", "morning", "day", "afternoon", "evening"]);
  });
  it("weekend od piątku 18:00 do niedzieli 6:00: Disco / Electronic / Hip-Hop", () => {
    expect(blockAt(5, 17)).toBe("afternoon");
    expect(blockAt(5, 18)).toBe("weekend-disco");
    expect(blockAt(6, 19)).toBe("weekend-electronic");
    expect(blockAt(6, 20)).toBe("weekend-hiphop");
    expect(blockAt(0, 5)).toMatch(/^weekend-/);
    expect(blockAt(0, 12)).toBe("sunday");
  });
});

describe("bramka jakości", () => {
  const ok = pool[0];
  it("przepuszcza poprawny utwór i odrzuca złe", () => {
    expect(passesQualityGate(ok)).toBe(true);
    expect(passesQualityGate({ ...ok, audio_url: null })).toBe(false);
    expect(passesQualityGate({ ...ok, audio_url: "https://cdn1.suno.ai/x.mp3" })).toBe(false);
    expect(passesQualityGate({ ...ok, duration: 20 })).toBe(false);
    expect(passesQualityGate({ ...ok, duration: 3600 })).toBe(false);
    expect(passesQualityGate({ ...ok, title: "Nocna Rozmowa #3" })).toBe(false);
    expect(passesQualityGate({ ...ok, duration: null })).toBe(true);
  });
});

describe("planDay", () => {
  const plan = planDay([...pool, { ...pool[0], id: "dead", audio_url: "https://cdn1.suno.ai/a.mp3" }], 6, "2026-11-07:public");
  it("wypełnia całą dobę i liczy odrzucone", () => {
    const last = plan.items[plan.items.length - 1];
    expect(plan.items[0].start).toBe(0);
    expect(last.start).toBeLessThan(86400);
    expect(last.start + (last.track.duration ?? 180)).toBeGreaterThanOrEqual(86400);
    expect(plan.rejected).toBe(1);
    expect(plan.items.some((x) => x.track.id === "dead")).toBe(false);
  });
  it("nie powtarza utworu w oknie i nie daje tego samego artysty pod rząd", () => {
    const seen = new Map<string, number>();
    for (const x of plan.items) {
      const prev = seen.get(x.track.id);
      if (prev !== undefined) expect(x.start - prev).toBeGreaterThanOrEqual(plan.windowSec);
      seen.set(x.track.id, x.start);
    }
    for (let i = 1; i < plan.items.length; i++) expect(plan.items[i].track.artist).not.toBe(plan.items[i - 1].track.artist);
    expect(plan.windowSec).toBeGreaterThanOrEqual(2 * 3600);
  });
  it("w bloku Disco gra disco, w Hip-Hop hip-hop/rap", () => {
    const disco = plan.items.filter((x) => x.block === "weekend-disco");
    const hiphop = plan.items.filter((x) => x.block === "weekend-hiphop");
    expect(disco.length).toBeGreaterThan(0);
    // Gdy gatunek się wyczerpie w oknie bez powtórek, blok dobiera świeże utwory z całej puli.
    const share = (xs: typeof disco, re: RegExp) => xs.filter((x) => re.test(x.track.genre ?? "")).length / xs.length;
    expect(share(disco, /disco|funk/i)).toBeGreaterThan(0.5);
    expect(share(hiphop, /hip|rap/i)).toBeGreaterThan(0.5);
    // Z dużą pulą gatunku blok jest w 100% „czysty”.
    const big = planDay(pool.map((t, i) => ({ ...t, genre: i % 2 ? "Disco" : "Pop" })), 6, "k");
    expect(big.items.filter((x) => x.block === "weekend-disco").every((x) => x.track.genre === "Disco")).toBe(true);
  });
  it("jest deterministyczny, a inny dzień daje inny układ", () => {
    const again = planDay(pool, 6, "2026-11-07:public");
    const plan2 = planDay(pool, 6, "2026-11-07:public");
    expect(again.items.map((x) => x.track.id)).toEqual(plan2.items.map((x) => x.track.id));
    const other = planDay(pool, 6, "2026-11-08:public");
    expect(other.items.map((x) => x.track.id)).not.toEqual(again.items.map((x) => x.track.id));
  });
  it("mała pula: nie zawiesza się i gra dalej", () => {
    const small = planDay(pool.slice(0, 5), 2, "x");
    expect(small.items.length).toBeGreaterThan(100);
  });
});

describe("DJ-miks klubowy", () => {
  it("gdy brakuje disco, blok Disco miksuje electronic/hip-hop (nie pop)", () => {
    const few = [
      ...pool.slice(0, 4).map((t) => ({ ...t, genre: "Disco" })),
      ...pool.slice(4, 120).map((t, i) => ({ ...t, genre: i % 2 ? "House" : "Hip-Hop" })),
      ...pool.slice(120).map((t) => ({ ...t, genre: "Pop" })),
    ];
    const plan = planDay(few, 6, "dj");
    const disco = plan.items.filter((x) => x.block === "weekend-disco");
    expect(disco.some((x) => x.dj)).toBe(true);
    expect(disco.filter((x) => x.dj).every((x) => /house|hip-hop|disco/i.test(x.track.genre ?? ""))).toBe(true);
    expect(disco.filter((x) => /pop/i.test(x.track.genre ?? "")).length).toBe(0);
  });
});
