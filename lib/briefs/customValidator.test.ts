import { describe, expect, it } from "vitest";
import {
  CUSTOM_RULES_MAX,
  CUSTOM_RULE_MAX,
  CUSTOM_TITLE_MAX,
  sanitiseCustomBrief,
} from "./customValidator";

describe("sanitiseCustomBrief", () => {
  it("returns null on empty / missing inputs (caller decides)", () => {
    expect(sanitiseCustomBrief(null)).toBeNull();
    expect(sanitiseCustomBrief(undefined)).toBeNull();
    expect(sanitiseCustomBrief({})).toBeNull();
    expect(sanitiseCustomBrief({ title: "   ", rules: [] })).toBeNull();
  });

  it("happy-path returns trimmed title + filtered rules", () => {
    const r = sanitiseCustomBrief({
      title: "  Title  ",
      rules: ["  one  ", " ", "two"],
    });
    expect(r).toEqual({ title: "Title", rules: ["one", "two"] });
  });

  it("rejects when title overflows", () => {
    const r = sanitiseCustomBrief({
      title: "x".repeat(CUSTOM_TITLE_MAX + 1),
      rules: ["one"],
    });
    expect(r).toEqual({ error: "title_too_long" });
  });

  it("rejects when title set but no rules survive", () => {
    const r = sanitiseCustomBrief({ title: "Title", rules: ["", "  "] });
    expect(r).toEqual({ error: "rules_required" });
  });

  it("rejects when rules count overflows", () => {
    const tooMany = Array.from({ length: CUSTOM_RULES_MAX + 1 }, (_, i) =>
      `rule ${i + 1}`,
    );
    const r = sanitiseCustomBrief({ title: "Title", rules: tooMany });
    expect(r).toEqual({ error: "too_many_rules" });
  });

  it("rejects when any single rule overflows", () => {
    const r = sanitiseCustomBrief({
      title: "Title",
      rules: ["x".repeat(CUSTOM_RULE_MAX + 1)],
    });
    expect(r).toEqual({ error: "rule_too_long" });
  });
});
