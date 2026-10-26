import { describe, expect, it } from "vitest";
import {
  cleanLyrics, cleanTitle, encodeWav16, integratedLufs, isExplicit, masterForRelease, releaseChecks, truePeakDb,
} from "./releasePrep";

const SR = 44_100;
const sine = (amp: number, sec: number, f = 1000) =>
  Float32Array.from({ length: Math.round(SR * sec) }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / SR));

describe("cleanLyrics", () => {
  it("usuwa znaczniki sekcji, etykiety i dopiski generatora", () => {
    const raw = "[Verse 1]\nIdę przez miasto\n(Chorus)\nRefren: Śpiewaj ze mną (x2)\n\n\n[Outro]\nKoniec dnia\nWygenerowano przez Suno AI";
    expect(cleanLyrics(raw)).toBe("Idę przez miasto\nŚpiewaj ze mną\n\nKoniec dnia");
  });
  it("pusty tekst zostaje pusty", () => {
    expect(cleanLyrics(null)).toBe("");
  });
});

describe("cleanTitle", () => {
  it("usuwa emoji i dopiski AI, poprawia krzyczące tytuły", () => {
    expect(cleanTitle("🔥 NOCNA JAZDA (Suno AI v5)")).toBe("Nocna Jazda");
    expect(cleanTitle("Tu i Teraz")).toBe("Tu i Teraz");
  });
});

describe("isExplicit", () => {
  it("wykrywa wulgaryzmy", () => {
    expect(isExplicit("co za kurwa dzień")).toBe(true);
    expect(isExplicit("piękny dzień")).toBe(false);
  });
});

describe("głośność i mastering", () => {
  it("sinus 1 kHz o amplitudzie 0,1 w stereo ≈ −20 LUFS", () => {
    const s = sine(0.1, 3);
    expect(integratedLufs([s, s], SR)).toBeCloseTo(-20, 0);
  });

  it("mastering doprowadza do −14 LUFS i true peak ≤ −1 dBTP", () => {
    const quiet = sine(0.05, 4, 220);
    const loudBurst = sine(0.9, 4, 330);
    const mix = quiet.map((v, i) => v + (i % SR < SR / 10 ? loudBurst[i] : 0));
    const r = masterForRelease([mix, Float32Array.from(mix)], SR);
    expect(Math.abs(r.lufs + 14)).toBeLessThanOrEqual(1);
    expect(r.truePeak).toBeLessThanOrEqual(-0.95);
    expect(truePeakDb(r.channels)).toBe(r.truePeak);
  });

  it("WAV 16 bit ma poprawny nagłówek i rozmiar", () => {
    const s = sine(0.5, 0.1);
    const wav = encodeWav16([s, s], SR);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(v.getUint32(24, true)).toBe(SR);
    expect(v.getUint16(34, true)).toBe(16);
    expect(wav.length).toBe(44 + s.length * 4);
  });
});

describe("releaseChecks", () => {
  it("przechodzi dla poprawnego pakietu i wskazuje braki", () => {
    const base = { title: "Tu i Teraz", artist: "Greg", durationSec: 185, sampleRate: SR, channels: 2, lufs: -14.2, truePeak: -1.1, coverSize: 3000, lyrics: "Idę przez miasto", instrumental: false };
    expect(releaseChecks(base).every((c) => c.ok)).toBe(true);
    const bad = releaseChecks({ ...base, coverSize: null, lyrics: "[Verse]\nla la" });
    expect(bad.filter((c) => !c.ok).map((c) => c.id)).toEqual(["cover", "lyrics"]);
  });
});
