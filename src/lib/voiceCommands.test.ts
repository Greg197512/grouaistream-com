import { describe, expect, it } from "vitest";
import { isConversational, isExplicitDjPhrase, parseVoiceCommand } from "./voiceCommands";

const kind = (phrase: string) => parseVoiceCommand(phrase)?.kind ?? null;

describe("voice commands", () => {
  it("understands transport commands in Polish and English", () => {
    expect(kind("pauza")).toBe("pause");
    expect(kind("Pauza!")).toBe("pause");
    expect(kind("zatrzymaj muzykę")).toBe("pause");
    expect(kind("pause")).toBe("pause");
    expect(kind("stop")).toBe("pause");
    expect(kind("graj")).toBe("resume");
    expect(kind("play")).toBe("resume");
    expect(kind("wznów")).toBe("resume");
    expect(kind("następny")).toBe("next");
    expect(kind("nastepny utwor")).toBe("next");
    expect(kind("next")).toBe("next");
    expect(kind("poprzednia")).toBe("previous");
    expect(kind("previous")).toBe("previous");
  });

  it("ignores case, diacritics and small recognition mistakes", () => {
    expect(kind("GŁOŚNIEJ")).toBe("volume_up");
    expect(kind("glosniej")).toBe("volume_up");
    expect(kind("ciszej")).toBe("volume_down");
    expect(kind("nestepny")).toBe("next");
    expect(parseVoiceCommand("puść jazz")).toMatchObject({ kind: "play", query: "jazz" });
    expect(parseVoiceCommand("Pusc ROCK")).toMatchObject({ kind: "play", query: "rock" });
  });

  it("plays a genre, mood or artist instead of only resuming", () => {
    expect(parseVoiceCommand("graj rock")).toMatchObject({ kind: "play", query: "rock" });
    expect(parseVoiceCommand("play jazz")).toMatchObject({ kind: "play", query: "jazz" });
    expect(parseVoiceCommand("puść coś smutnego")).toMatchObject({ kind: "play", mood: "sad" });
    expect(parseVoiceCommand("zagraj Queen")).toMatchObject({ kind: "play", query: "queen" });
    expect(parseVoiceCommand("play backstreet boys")?.kind).toBe("play");
    expect(parseVoiceCommand("play backstreet boys")).toMatchObject({ query: "backstreet boys" });
  });

  it("starts radio, studio and party mode", () => {
    expect(kind("włącz radio")).toBe("radio");
    expect(kind("start radio")).toBe("radio");
    expect(kind("radio na żywo")).toBe("radio");
    expect(kind("otwórz studio")).toBe("studio");
    expect(kind("open studio")).toBe("studio");
    expect(kind("party mode")).toBe("party");
    expect(kind("tryb imprezy")).toBe("party");
    expect(kind("stop radio")).toBe("pause");
  });

  it("sets volume and mute without treating them as stop", () => {
    expect(parseVoiceCommand("głośność na 50")).toMatchObject({ kind: "volume_set", percent: 50 });
    expect(parseVoiceCommand("set volume to 30")).toMatchObject({ kind: "volume_set", percent: 30 });
    expect(kind("wycisz")).toBe("mute");
    expect(kind("mute")).toBe("mute");
    expect(kind("volume up")).toBe("volume_up");
    expect(kind("volume down")).toBe("volume_down");
    expect(kind("nonstop")).toBeNull();
  });

  it("keeps Dutch and Ukrainian basics", () => {
    expect(kind("pauzeer")).toBe("pause");
    expect(kind("volgende")).toBe("next");
    expect(kind("speel")).toBe("resume");
    expect(parseVoiceCommand("speel disco")).toMatchObject({ kind: "play", query: "disco" });
    expect(kind("пауза")).toBe("pause");
    expect(kind("наступний")).toBe("next");
  });

  it("does not steal questions or bare chatter", () => {
    expect(isConversational("jaka jest pogoda")).toBe(true);
    expect(isConversational("what's up")).toBe(true);
    expect(parseVoiceCommand("co to jest rock")).toBeNull();
    expect(isExplicitDjPhrase("puść rock")).toBe(false);
    expect(isExplicitDjPhrase("zrób set techno")).toBe(true);
    expect(parseVoiceCommand("Aurora, następny", { assistantName: "Aurora" })?.kind).toBe("next");
  });

  it("opens a page only when asked, and shuts the assistant down on request", () => {
    expect(parseVoiceCommand("otwórz bibliotekę")).toMatchObject({ kind: "navigate", route: "/library" });
    expect(parseVoiceCommand("home")).toMatchObject({ kind: "navigate", route: "/" });
    expect(kind("wyłącz się")).toBe("shutdown");
    expect(kind("graj dalej")).toBe("resume");
  });
});
