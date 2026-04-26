import type { TileColor } from "@/components/canvas/Tile";

export type Role = "Builder" | "Guider" | "Observer" | "Game master";

const ROLE_COLOR: Record<Role, TileColor> = {
  Builder: "orange",
  Guider: "blue",
  Observer: "purple",
  "Game master": "red",
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
        color: `var(--color-t-${c})`,
        filter: "brightness(.7)",
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
