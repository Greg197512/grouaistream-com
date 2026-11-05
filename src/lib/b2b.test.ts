import { describe, expect, it } from "vitest";
import { b2bRef, b2bStepIndex } from "./b2b";

describe("b2b flow", () => {
  it("maps status + payment to timeline step", () => {
    expect(b2bStepIndex("received", "pending")).toBe(0);
    expect(b2bStepIndex("offer_sent", "pending")).toBe(1);
    expect(b2bStepIndex("confirmed", "pending")).toBe(1);
    expect(b2bStepIndex("confirmed", "paid")).toBe(2);
    expect(b2bStepIndex("in_progress", "paid")).toBe(3);
    expect(b2bStepIndex("completed", "paid")).toBe(4);
  });
  it("builds a short transfer reference", () => {
    expect(b2bRef("0a1b2c3d-4e5f-6789-abcd-ef0123456789")).toBe("B2B-0A1B2C3D");
  });
});
