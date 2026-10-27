import { describe, expect, it } from "vitest";
import { decodeMidi } from "./instruments";

describe("MIDI", () => {
  it("rozkodowuje nuty, pedał i pitch bend", () => {
    expect(decodeMidi([0x90, 60, 127])).toEqual({ type: "on", note: 60, velocity: 1, channel: 1 });
    expect(decodeMidi([0x99, 36, 0])).toEqual({ type: "off", note: 36, channel: 10 });
    expect(decodeMidi([0xb0, 64, 127])).toEqual({ type: "cc", cc: 64, value: 1, channel: 1 });
    expect(decodeMidi([0xe0, 0, 64])).toEqual({ type: "bend", value: 0, channel: 1 });
    expect(decodeMidi([0xe0, 127, 127])!.type).toBe("bend");
    expect(decodeMidi([0xf8])).toBeNull();
  });
});
