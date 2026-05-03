"use client";

import { memo } from "react";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";

export interface RotationRadioProps {
  value: number;
  onChange: (rot: number) => void;
  shape: TileShape;
  color: TileColor;
  disabled?: boolean;
}

/**
 * Builder UX foundation: rotation as a 4-segment radio control with
 * actual rotated tile previews in each segment. Random-access — no
 * "cycle through" friction. Replaces the inline rotation row added in
 * PR #71. Pinned to the same dock as shape + colour so all three
 * controls live in one place.
 */
function RotationRadioImpl({
  value,
  onChange,
  shape,
  color,
  disabled = false,
}: RotationRadioProps) {
  return (
    <div
      className="flex gap-1 rounded-full p-1"
      style={{ background: "var(--color-paper-2)" }}
      role="radiogroup"
      aria-label="Rotation"
    >
      {[0, 1, 2, 3].map((r) => {
        const on = value === r;
        return (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            className="flex h-10 flex-1 items-center justify-center rounded-full border-0 transition-colors disabled:opacity-50"
            style={{
              background: on ? "var(--color-ink)" : "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            role="radio"
            aria-checked={on}
            aria-label={`Rotate ${r * 90}°`}
            title={`Rotate ${r * 90}° (R cycles)`}
          >
            <Tile
              kind={shape}
              color={color}
              x={0}
              y={0}
              size={20}
              rotate={r * 90}
              style={{
                position: "static",
                filter: on ? "none" : "saturate(0.85)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

export const RotationRadio = memo(RotationRadioImpl);
