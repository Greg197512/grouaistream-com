import { describe, expect, it } from "vitest";
import { readPresence } from "./radioCallin";
import { callLine, callerLabel } from "./radioHost";

describe("telefony od słuchaczy", () => {
  it("kolejka: studio online + dzwoniący od najstarszego", () => {
    const r = readPresence({
      a: [{ role: "caller", callId: "2", name: "Ola", city: "", lang: "pl", at: 20 }],
      s: [{ role: "studio", at: 1 }],
      b: [{ role: "caller", callId: "1", name: "Jan", city: "Gdańsk", lang: "nl", at: 10 }],
      x: [{ role: "host" }],
    });
    expect(r.studioOnline).toBe(true);
    expect(r.callers.map((c) => c.name)).toEqual(["Jan", "Ola"]);
    expect(readPresence({}).studioOnline).toBe(false);
  });
  it("zapowiedź Novy w języku słuchacza, bez wulgarnych imion", () => {
    expect(callLine("on", "pl", "Ania", "Gdańsk")).toBe("Mamy telefon! Na linii Ania, Gdańsk. Cześć, jesteś na antenie GrouaRadio!");
    expect(callLine("on", "en", "Tom", "")).toContain("On the line, Tom.");
    expect(callLine("off", "nl", "Sanne")).toBe("Bedankt voor het bellen, Sanne! Terug naar de muziek.");
    expect(callLine("on", "pl", "Kurwa", "x")).toContain("słuchacz");
    expect(callerLabel("Ania 🔥 https://spam.pl")).toBe("Ania");
  });
});
