import { describe, expect, it } from "vitest";
import { timerPhaseFor } from "./timerPhase";

describe("timerPhaseFor", () => {
  it("returns idle when the round isn't running", () => {
    expect(timerPhaseFor(600, false)).toBe("idle");
    expect(timerPhaseFor(0, false)).toBe("idle");
  });

  it("returns normal above the warning threshold", () => {
    expect(timerPhaseFor(600, true)).toBe("normal");
    expect(timerPhaseFor(121, true)).toBe("normal");
  });

  it("returns warning at and below 2 minutes", () => {
    expect(timerPhaseFor(120, true)).toBe("warning");
    expect(timerPhaseFor(60, true)).toBe("warning");
    expect(timerPhaseFor(31, true)).toBe("warning");
  });

  it("returns urgent at and below 30s", () => {
    expect(timerPhaseFor(30, true)).toBe("urgent");
    expect(timerPhaseFor(15, true)).toBe("urgent");
    expect(timerPhaseFor(11, true)).toBe("urgent");
  });

  it("returns critical at and below 10s", () => {
    expect(timerPhaseFor(10, true)).toBe("critical");
    expect(timerPhaseFor(1, true)).toBe("critical");
    expect(timerPhaseFor(0, true)).toBe("critical");
  });
});
