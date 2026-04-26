import type { TileColor } from "@/components/canvas/Tile";

export type Role = "Builder" | "Guider" | "Observer" | "Game master";

const ROLE_COLOR: Record<Role, TileColor> = {
  Builder: "orange",
  Guider: "blue",
  Observer: "purple",
  "Game master": "red",
};

/**
 * Per-role darker text colours so the pill reads cleanly against the
 * tinted background without `filter: brightness()` muddying it.
 */
const ROLE_TEXT: Record<TileColor, string> = {
  red: "#a92626",
  orange: "#a55810",
  yellow: "#7a5b00",
  green: "#2c7a44",
  blue: "#1c54a8",
  purple: "#5a3aa8",
  pink: "#a8447a",
  teal: "#117c79",
};

export interface RoleChipProps {
  role: Role;
  color?: TileColor;
}

export function RoleChip({ role, color }: RoleChipProps) {
  const c = color ?? ROLE_COLOR[role];
  return (
    <span
      className="t-chip"
      style={{
        background: `var(--color-tint-${c})`,
        color: ROLE_TEXT[c],
        fontWeight: 700,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: `var(--color-t-${c})`,
        }}
      />
      {role}
    </span>
  );
}
