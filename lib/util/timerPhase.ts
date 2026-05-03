/**
 * Round-timer phase derived from seconds remaining. Single source of
 * truth so the player top-bar and the GM master-bar tick through the
 * same thresholds.
 *
 *   normal   — plenty of time, calm gray chip.
 *   warning  — < 2 min, tinted amber. "We're in the back half."
 *   urgent   — < 30 s, red + jiggle. "Wrap it up."
 *   critical — < 10 s, red + faster jiggle. "Right now."
 *
 * Returns `idle` when the round isn't running so callers can short-circuit
 * instead of computing styles for a stopped timer.
 */
export type TimerPhase =
  | "idle"
  | "normal"
  | "warning"
  | "urgent"
  | "critical";

export function timerPhaseFor(remainingSec: number, running: boolean): TimerPhase {
  if (!running) return "idle";
  if (remainingSec <= 10) return "critical";
  if (remainingSec <= 30) return "urgent";
  if (remainingSec <= 120) return "warning";
  return "normal";
}

export interface TimerPhaseStyle {
  background: string;
  color: string;
  boxShadow: string;
  animation: string;
}

/**
 * Inline styles for the timer chip in each phase. Kept here so the
 * GM and player chips stay visually identical without copy-paste
 * drift.
 */
export function timerPhaseStyle(phase: TimerPhase): TimerPhaseStyle {
  switch (phase) {
    case "warning":
      return {
        background: "var(--color-tint-orange)",
        color: "var(--color-t-orange)",
        boxShadow: "inset 0 0 0 1.5px var(--color-t-orange)",
        animation: "tessera-attention 1400ms ease-in-out infinite",
      };
    case "urgent":
      return {
        background: "var(--color-tint-red)",
        color: "var(--color-t-red)",
        boxShadow: "inset 0 0 0 1.5px var(--color-t-red)",
        animation: "tessera-jiggle 700ms ease-in-out infinite",
      };
    case "critical":
      return {
        background: "var(--color-t-red)",
        color: "#fff",
        boxShadow: "inset 0 0 0 1.5px var(--color-t-red)",
        animation: "tessera-jiggle 380ms ease-in-out infinite",
      };
    case "idle":
    case "normal":
    default:
      return {
        background: "var(--color-paper-2)",
        color: "inherit",
        boxShadow: "none",
        animation: "none",
      };
  }
}
