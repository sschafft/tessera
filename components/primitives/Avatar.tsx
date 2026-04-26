import type { TileColor } from "@/components/canvas/Tile";

export interface AvatarProps {
  name: string;
  color?: TileColor;
  size?: number;
  /** Outer ring colour, useful for stacked avatars. */
  ring?: string;
}

/**
 * Avatar — single-letter coloured circle. We take the first character of
 * the display name, uppercased, and tint with one of the palette colours.
 */
export function Avatar({ name, color = "blue", size = 32, ring }: AvatarProps) {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  return (
    <div
      className="t-display flex flex-shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `var(--color-t-${color})`,
        fontWeight: 700,
        fontSize: size * 0.45,
        boxShadow: ring ? `0 0 0 3px ${ring}` : "none",
      }}
    >
      {initial}
    </div>
  );
}
