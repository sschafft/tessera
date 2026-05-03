import { describe, expect, it } from "vitest";
import { AI_PARTICIPANT_CAP_MAX, usesAIBriefs } from "./limits";

describe("usesAIBriefs", () => {
  it("returns true when builder side is gemini", () => {
    expect(usesAIBriefs("gemini", "library")).toBe(true);
  });

  it("returns true when guider side is gemini", () => {
    expect(usesAIBriefs("library", "gemini")).toBe(true);
  });

  it("returns true when both sides are gemini", () => {
    expect(usesAIBriefs("gemini", "gemini")).toBe(true);
  });

  it("returns false for library + gm combos", () => {
    expect(usesAIBriefs("library", "library")).toBe(false);
    expect(usesAIBriefs("library", "gm")).toBe(false);
    expect(usesAIBriefs("gm", "library")).toBe(false);
    expect(usesAIBriefs("gm", "gm")).toBe(false);
  });

  it("treats null/undefined as off", () => {
    expect(usesAIBriefs(null, null)).toBe(false);
    expect(usesAIBriefs(undefined, undefined)).toBe(false);
    expect(usesAIBriefs(null, "gemini")).toBe(true);
  });
});

describe("AI_PARTICIPANT_CAP_MAX", () => {
  it("is 15 — the documented worst-case-fits-30s ceiling", () => {
    expect(AI_PARTICIPANT_CAP_MAX).toBe(15);
  });
});
