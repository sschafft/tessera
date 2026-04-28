import { describe, expect, it } from "vitest";
import { scorePlacements } from "./score";
import type { GoalPattern } from "@/lib/pattern/types";

const cfg = (correctPts: number, wrongPts: number) => ({
  correctPts,
  wrongPts,
});

const placement = (
  id: string,
  shape: string,
  color: string,
  q: number,
  r: number,
  rot = 0,
) => ({ id, shape, color, q, r, rot });

describe("scorePlacements — correctness", () => {
  it("counts an exact match as correct", () => {
    const goal: GoalPattern = [
      { shape: "tri-up", color: "red", q: 0, r: 0, rot: 0 },
    ];
    const result = scorePlacements(
      [placement("p1", "tri-up", "red", 0, 0, 0)],
      goal,
      cfg(10, 0),
    );
    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(0);
    expect(result.score).toBe(10);
    expect(result.placements[0]?.correct).toBe(true);
  });

  it("flags wrong-cell placement as wrong", () => {
    const goal: GoalPattern = [
      { shape: "tri-up", color: "red", q: 0, r: 0, rot: 0 },
    ];
    const result = scorePlacements(
      [placement("p1", "tri-up", "red", 1, 1, 0)],
      goal,
      cfg(10, 0),
    );
    expect(result.correct).toBe(0);
    expect(result.wrong).toBe(1);
  });

  it("flags wrong-color same-cell same-shape as wrong", () => {
    const goal: GoalPattern = [
      { shape: "sq", color: "blue", q: 0, r: 0, rot: 0 },
    ];
    const result = scorePlacements(
      [placement("p1", "sq", "red", 0, 0, 0)],
      goal,
      cfg(10, 0),
    );
    expect(result.correct).toBe(0);
    expect(result.wrong).toBe(1);
  });

  it("counts extras beyond the goal as wrong", () => {
    const goal: GoalPattern = [
      { shape: "tri-up", color: "red", q: 0, r: 0, rot: 0 },
    ];
    const result = scorePlacements(
      [
        placement("p1", "tri-up", "red", 0, 0, 0),
        placement("p2", "sq", "blue", 1, 1, 0),
      ],
      goal,
      cfg(10, 0),
    );
    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(1);
    expect(result.total).toBe(1);
  });
});

describe("scorePlacements — rotation symmetry", () => {
  it("squares are correct at every rot value", () => {
    const goal: GoalPattern = [
      { shape: "sq", color: "blue", q: 0, r: 0, rot: 0 },
    ];
    for (const rot of [0, 1, 2, 3]) {
      const result = scorePlacements(
        [placement("p1", "sq", "blue", 0, 0, rot)],
        goal,
        cfg(10, 0),
      );
      expect(result.correct, `sq at rot=${rot}`).toBe(1);
    }
  });

  it("hexagons are correct at every rot value (legacy compatibility)", () => {
    const goal: GoalPattern = [
      { shape: "hex", color: "purple", q: 0, r: 0, rot: 0 },
    ];
    for (const rot of [0, 1, 2, 3]) {
      const result = scorePlacements(
        [placement("p1", "hex", "purple", 0, 0, rot)],
        goal,
        cfg(10, 0),
      );
      expect(result.correct, `hex at rot=${rot}`).toBe(1);
    }
  });

  it("rhomb collapses 0/2 and 1/3 (2-fold symmetry)", () => {
    const goalAtZero: GoalPattern = [
      { shape: "rhomb", color: "green", q: 0, r: 0, rot: 0 },
    ];
    expect(
      scorePlacements(
        [placement("p1", "rhomb", "green", 0, 0, 2)],
        goalAtZero,
        cfg(10, 0),
      ).correct,
    ).toBe(1);
    expect(
      scorePlacements(
        [placement("p1", "rhomb", "green", 0, 0, 1)],
        goalAtZero,
        cfg(10, 0),
      ).correct,
    ).toBe(0);

    const goalAtOne: GoalPattern = [
      { shape: "rhomb", color: "green", q: 0, r: 0, rot: 1 },
    ];
    expect(
      scorePlacements(
        [placement("p1", "rhomb", "green", 0, 0, 3)],
        goalAtOne,
        cfg(10, 0),
      ).correct,
    ).toBe(1);
  });

  it("trapezoids distinguish all four rot values", () => {
    const goal: GoalPattern = [
      { shape: "trap", color: "orange", q: 0, r: 0, rot: 0 },
    ];
    expect(
      scorePlacements(
        [placement("p1", "trap", "orange", 0, 0, 0)],
        goal,
        cfg(10, 0),
      ).correct,
    ).toBe(1);
    for (const rot of [1, 2, 3]) {
      expect(
        scorePlacements(
          [placement("p1", "trap", "orange", 0, 0, rot)],
          goal,
          cfg(10, 0),
        ).correct,
        `trap at rot=${rot} should be wrong against goal rot=0`,
      ).toBe(0);
    }
  });

  it("triangles distinguish all four rot values", () => {
    const goal: GoalPattern = [
      { shape: "tri-up", color: "yellow", q: 0, r: 0, rot: 2 },
    ];
    expect(
      scorePlacements(
        [placement("p1", "tri-up", "yellow", 0, 0, 2)],
        goal,
        cfg(10, 0),
      ).correct,
    ).toBe(1);
    for (const rot of [0, 1, 3]) {
      expect(
        scorePlacements(
          [placement("p1", "tri-up", "yellow", 0, 0, rot)],
          goal,
          cfg(10, 0),
        ).correct,
        `tri-up at rot=${rot} should be wrong against goal rot=2`,
      ).toBe(0);
    }
  });
});

describe("scorePlacements — penalty math", () => {
  it("default config (correctPts=10, wrongPts=0) is zero-penalty", () => {
    const goal: GoalPattern = [
      { shape: "sq", color: "blue", q: 0, r: 0, rot: 0 },
    ];
    const r = scorePlacements(
      [
        placement("p1", "sq", "blue", 0, 0, 0),
        placement("p2", "sq", "red", 1, 1, 0),
      ],
      goal,
      cfg(10, 0),
    );
    expect(r.score).toBe(10);
    expect(r.penaltyApplied).toBe(false);
  });

  it("negative wrongPts subtracts per wrong piece", () => {
    const goal: GoalPattern = [
      { shape: "sq", color: "blue", q: 0, r: 0, rot: 0 },
    ];
    const r = scorePlacements(
      [
        placement("p1", "sq", "blue", 0, 0, 0),
        placement("p2", "sq", "red", 1, 1, 0),
        placement("p3", "sq", "red", 2, 2, 0),
      ],
      goal,
      cfg(10, -2),
    );
    expect(r.correct).toBe(1);
    expect(r.wrong).toBe(2);
    expect(r.score).toBe(10 - 4);
    expect(r.penaltyApplied).toBe(true);
  });

  it("score can go negative when wrongs swamp corrects", () => {
    const goal: GoalPattern = [
      { shape: "sq", color: "blue", q: 0, r: 0, rot: 0 },
    ];
    const placements = Array.from({ length: 10 }, (_, i) =>
      placement(`w${i}`, "sq", "red", i + 5, 0, 0),
    );
    const r = scorePlacements(placements, goal, cfg(10, -5));
    expect(r.correct).toBe(0);
    expect(r.wrong).toBe(10);
    expect(r.score).toBe(-50);
  });

  it("penaltyApplied is false when wrongPts is 0 even with wrongs", () => {
    const goal: GoalPattern = [
      { shape: "sq", color: "blue", q: 0, r: 0, rot: 0 },
    ];
    const r = scorePlacements(
      [placement("p1", "tri-up", "red", 5, 5, 0)],
      goal,
      cfg(10, 0),
    );
    expect(r.wrong).toBe(1);
    expect(r.penaltyApplied).toBe(false);
  });
});

describe("scorePlacements — empty inputs", () => {
  it("returns score=0 for empty placements", () => {
    const r = scorePlacements([], [], cfg(10, -1));
    expect(r.score).toBe(0);
    expect(r.correct).toBe(0);
    expect(r.wrong).toBe(0);
    expect(r.total).toBe(0);
  });

  it("empty placements against non-empty goal: 0/0/total", () => {
    const goal: GoalPattern = [
      { shape: "sq", color: "blue", q: 0, r: 0, rot: 0 },
      { shape: "sq", color: "red", q: 1, r: 1, rot: 0 },
    ];
    const r = scorePlacements([], goal, cfg(10, -1));
    expect(r.correct).toBe(0);
    expect(r.wrong).toBe(0);
    expect(r.total).toBe(2);
    expect(r.score).toBe(0);
  });
});
