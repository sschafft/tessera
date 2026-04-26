import type { TileColor } from "@/components/canvas/Tile";

export interface BulletProps {
  color: TileColor;
  label: string;
}

export function Bullet({ color, label }: BulletProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: `var(--color-t-${color})` }}
      />
      {label}
    </span>
  );
}
