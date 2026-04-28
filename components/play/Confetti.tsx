"use client";

import { useId } from "react";

export interface ConfettiProps {
  /**
   * Burst size. `small` is the per-correct-piece partial-success
   * sprinkle (~24 pieces). `large` is the full-solve celebration
   * (~96 pieces, longer travel).
   */
  intensity?: "small" | "large";
}

// Tessera's brand palette — same order as the builder's colour
// picker, so the confetti reads as "made of your own pieces" rather
// than generic carnival.
const PALETTE = [
  "var(--color-t-red)",
  "var(--color-t-orange)",
  "var(--color-t-yellow)",
  "var(--color-t-green)",
  "var(--color-t-blue)",
  "var(--color-t-purple)",
];

/**
 * Confetti burst from the parent's relative centre. Pure CSS — each
 * piece animates `translate(0,0) → translate(var(--cx), var(--cy))`
 * with a rotation, then fades. To re-fire, give the component a
 * fresh React `key` so it unmounts + remounts and the keyframes
 * restart from scratch (e.g. `<Confetti key={result.at} />`).
 *
 * pointer-events: none on the wrapper so confetti can rain over the
 * canvas without eating clicks.
 */
export function Confetti({ intensity = "small" }: ConfettiProps) {
  const count = intensity === "large" ? 96 : 24;
  const baseDistance = intensity === "large" ? 280 : 130;
  // useId is unique-per-mount so the @keyframes name doesn't collide
  // when two Confetti components live on the page (partial + major).
  // Strip the colon/dash characters React 19 sometimes emits so the
  // name is a valid CSS identifier.
  const id = useId().replace(/[^a-zA-Z0-9_]/g, "_");
  const pieces = Array.from({ length: count }, (_, j) => {
    // Spread pieces around a circle with a touch of jitter so they
    // don't form perfect concentric rings.
    const angle = (Math.PI * 2 * j) / count + ((j * 13) % 7) * 0.05;
    const distance = baseDistance + ((j * 47) % 110);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - (intensity === "large" ? 40 : 0);
    const color = PALETTE[j % PALETTE.length]!;
    const duration = 900 + ((j * 53) % 700);
    const delay = (j * 13) % (intensity === "large" ? 240 : 80);
    const rotate = (j * 37) % 360;
    const size = (j % 3) * 2 + 6; // 6, 8, 10 px
    return { x, y, color, duration, delay, rotate, size, j };
  });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ zIndex: 60 }}
    >
      {pieces.map((p) => (
        <span
          key={p.j}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.j % 2 === 0 ? 1 : "50%",
            // The CSS variables let the @keyframes do the maths
            // without needing per-piece keyframes.
            ["--cx" as never]: `${p.x}px`,
            ["--cy" as never]: `${p.y}px`,
            ["--rot" as never]: `${p.rotate}deg`,
            transform: "translate(-50%, -50%)",
            animation: `tessera-confetti-${id} ${p.duration}ms ${p.delay}ms cubic-bezier(.2,.7,.4,1) forwards`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes tessera-confetti-${id} {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(0deg) scale(0.6);
          }
          12% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(60deg) scale(1);
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform:
              translate(calc(-50% + var(--cx)), calc(-50% + var(--cy)))
              rotate(calc(var(--rot) + 720deg))
              scale(0.7);
          }
        }
      `}</style>
    </div>
  );
}
