import { describe, expect, it } from "vitest";
import { parsePairsCsv } from "./pairs";

describe("parsePairsCsv — required columns", () => {
  it("parses the canonical 4-column header without brief overrides", () => {
    const csv = [
      "name,email,team_name,role",
      "Avery,avery@example.com,Otters,builder",
      "Bri,bri@example.com,Otters,guider",
    ].join("\n");
    const { rows, errors } = parsePairsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.brief_title).toBeNull();
    expect(rows[0]!.brief_rules).toEqual([]);
  });

  it("rejects when required columns are missing", () => {
    const csv = ["name,team_name", "Avery,Otters"].join("\n");
    const { errors } = parsePairsCsv(csv);
    expect(errors[0]?.message).toMatch(/missing required column/);
  });
});

describe("parsePairsCsv — brief override columns", () => {
  it("reads brief_title + brief_rules per row when present", () => {
    const csv = [
      "name,email,team_name,role,brief_title,brief_rules",
      'Avery,avery@example.com,Otters,builder,Distracted,"Talk about anything else.|Only respond if asked."',
      "Bri,bri@example.com,Otters,guider,Nautical,Use port and starboard not left and right.",
    ].join("\n");
    const { rows, errors } = parsePairsCsv(csv);
    expect(errors).toEqual([]);
    const builder = rows.find((r) => r.role === "builder")!;
    const guider = rows.find((r) => r.role === "guider")!;
    expect(builder.brief_title).toBe("Distracted");
    expect(builder.brief_rules).toEqual([
      "Talk about anything else.",
      "Only respond if asked.",
    ]);
    expect(guider.brief_title).toBe("Nautical");
    expect(guider.brief_rules).toEqual([
      "Use port and starboard not left and right.",
    ]);
  });

  it("treats empty brief cells as null/empty", () => {
    const csv = [
      "name,email,team_name,role,brief_title,brief_rules",
      "Avery,avery@example.com,Otters,builder,,",
      "Bri,bri@example.com,Otters,guider,Title,One.|Two.",
    ].join("\n");
    const { rows, errors } = parsePairsCsv(csv);
    expect(errors).toEqual([]);
    const builder = rows.find((r) => r.role === "builder")!;
    expect(builder.brief_title).toBeNull();
    expect(builder.brief_rules).toEqual([]);
  });

  it("trims whitespace and drops empty rule fragments", () => {
    const csv = [
      "name,email,team_name,role,brief_title,brief_rules",
      'Avery,avery@example.com,Otters,builder,T1,"  one  | two | | three "',
      "Bri,bri@example.com,Otters,guider,,",
    ].join("\n");
    const { rows, errors } = parsePairsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]!.brief_rules).toEqual(["one", "two", "three"]);
  });
});
