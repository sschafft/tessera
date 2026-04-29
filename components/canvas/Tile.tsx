import { memo, type CSSProperties } from "react";

export type TileShape =
  | "tri-up"
  | "tri-dn"
  | "sq"
  | "rhomb"
  | "trap"
  | "hex"
  | "pent";

export type TileColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "teal";

const PALETTE: Record<TileColor, string> = {
  red: "var(--color-t-red)",
  orange: "var(--color-t-orange)",
  yellow: "var(--color-t-yellow)",
  green: "var(--color-t-green)",
  blue: "var(--color-t-blue)",
  purple: "var(--color-t-purple)",
  pink: "var(--color-t-pink)",
  teal: "var(--color-t-teal)",
};

const PATHS: Record<TileShape, string> = {
  "tri-up": "M50 6 L94 88 L6 88 Z",
  "tri-dn": "M6 12 L94 12 L50 94 Z",
  sq: "M8 8 H92 V92 H8 Z",
  rhomb: "M30 8 H92 L70 92 H8 Z",
  trap: "M22 14 H78 L94 86 H6 Z",
  hex: "M50 4 L92 28 L92 72 L50 96 L8 72 L8 28 Z",
  pent: "M50 6 L94 38 L78 90 L22 90 L6 38 Z",
};

export interface TileProps {
  kind: TileShape;
  color?: TileColor;
  /** Absolute x position in px relative to the parent positioned ancestor. */
  x: number;
  /** Absolute y position in px relative to the parent positioned ancestor. */
  y: number;
  /** Width and height of the tile bounding box in px. */
  size?: number;
  /** Rotation in degrees, applied around the tile centre. */
  rotate?: number;
  /** Render as a translucent ghost (drag preview / "next piece" hint). */
  ghost?: boolean;
  /** Render in muted greyscale-tinted form (Prototype super-power). */
  prototype?: boolean;
  /** When non-null, renders a small green/red badge at top-right indicating correctness. */
  correct?: boolean | null;
  style?: CSSProperties;
}

/**
 * Tile — a single absolutely-positioned SVG polygon. Pieces are stored in
 * grid coords (q, r) elsewhere; this component takes pixel coords because
 * it is also used decoratively (landing page hero, brief envelopes).
 *
 * React.memo'd so re-renders on the canvas (cursor hover, GC effects)
 * don't churn every Tile when the underlying scalar props are
 * identical to the previous render.
 */
function TileImpl({
  kind,
  color = "blue",
  x,
  y,
  size = 56,
  rotate = 0,
  ghost = false,
  prototype = false,
  correct = null,
  style,
}: TileProps) {
  const colorVar = PALETTE[color];
  const fill = ghost
    ? "rgba(0,0,0,.06)"
    : prototype
      ? `color-mix(in oklab, ${colorVar} 35%, #d8d2c4)`
      : colorVar;
  const stroke = ghost ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.20)";
  const dash = ghost ? "4 3" : prototype ? "3 4" : undefined;
  const path = PATHS[kind];

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        transform: `rotate(${rotate}deg)`,
        transformOrigin: "center",
        filter: ghost ? "none" : "drop-shadow(0 2px 0 rgba(0,0,0,.10))",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ overflow: "visible" }}
      >
        <path
          d={path}
          fill={fill}
          stroke={stroke}
          strokeWidth={ghost ? 1.5 : 2.5}
          strokeLinejoin="round"
          strokeDasharray={dash}
        />
        {correct === true && (
          <circle cx="80" cy="20" r="9" fill="#46b86a" stroke="#fff" strokeWidth="2.5" />
        )}
        {correct === false && (
          <circle cx="80" cy="20" r="9" fill="#ee3a3a" stroke="#fff" strokeWidth="2.5" />
        )}
      </svg>
    </div>
  );
}

export const Tile = memo(TileImpl);
