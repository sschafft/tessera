"use client";

import { memo } from "react";
import { Tile, type TileColor, type TileShape } from "@/components/canvas/Tile";
import { BUILDER_SHAPES } from "@/lib/pattern/palette";
import { RotationRadio } from "./RotationRadio";

export type DockTargetKind = "phantom" | "piece" | null;

export interface DockProps {
  /** "phantom" = arming a new placement, "piece" = editing one, null = idle. */
  targetKind: DockTargetKind;
  /** Cell label for the active target (e.g. "B3"). Null when idle. */
  targetLabel: string | null;
  shape: TileShape;
  color: TileColor;
  rotation: number;
  palette: TileColor[];
  onShape: (s: TileShape) => void;
  onColor: (c: TileColor) => void;
  onRotation: (r: number) => void;
  /** Clear the active target (cancel phantom / stop editing). */
  onCancel: () => void;
  /** Commit a phantom — ignored unless targetKind === "phantom". */
  onPlace: () => void;
  /** Exit edit mode — ignored unless targetKind === "piece". */
  onDoneEditing: () => void;
  /** Remove the targeted piece — ignored unless targetKind === "piece". */
  onRemove: () => void;
}

/**
 * Builder UX foundation (Variation E): the single, always-visible
 * left dock that controls *whatever* is the current target on the
 * board.
 *
 * - target=null  → dock is dim, shape/colour/rotation update the
 *                   defaults for the next phantom; action area shows
 *                   a "tap a cell" placeholder.
 * - target=phantom → dock lights up, controls mutate the phantom in
 *                   place; primary CTA is `＋ Place at <cell>`.
 * - target=piece → dock controls mutate the placed piece directly
 *                   (via the parent's applyOptimisticPatch); CTAs are
 *                   `⌫ Remove` and `Done editing`.
 *
 * The same control surface across all three states is the whole
 * point — no Add-mode / Edit-mode toggle, no mental shift. See
 * design/PRD §6.4 (post-v1.4).
 */
function DockImpl({
  targetKind,
  targetLabel,
  shape,
  color,
  rotation,
  palette,
  onShape,
  onColor,
  onRotation,
  onCancel,
  onPlace,
  onDoneEditing,
  onRemove,
}: DockProps) {
  const hasTarget = targetKind !== null;
  const cellChipText = targetLabel ?? "—";
  const subtitle =
    targetKind === "piece"
      ? "this piece"
      : targetKind === "phantom"
        ? "next piece"
        : "no target";

  return (
    <div
      className="flex flex-col gap-3 rounded-[16px] p-3.5"
      style={{
        background: "#fff",
        border: hasTarget
          ? "1.5px solid var(--color-ink)"
          : "1.5px solid var(--color-line)",
        boxShadow: "0 4px 0 rgba(0,0,0,.10)",
        transition: "border-color .15s ease",
      }}
    >
      {/* Header: cell-label chip + role + cancel link */}
      <div className="flex items-center gap-2.5">
        <span
          className="t-mono text-[9px] font-bold uppercase"
          style={{
            letterSpacing: ".12em",
            padding: "3px 9px",
            borderRadius: 99,
            background: hasTarget
              ? "var(--color-ink)"
              : "var(--color-paper-2)",
            color: hasTarget ? "#fff" : "var(--color-ink-3)",
            transition: "background .15s ease, color .15s ease",
          }}
        >
          {cellChipText}
        </span>
        <span
          className="text-[12px] font-semibold"
          style={{ color: "var(--color-ink-2)" }}
        >
          {subtitle}
        </span>
        <span className="flex-1" />
        {hasTarget && (
          <button
            type="button"
            onClick={onCancel}
            className="t-mono bg-transparent text-[10px] underline"
            style={{ color: "var(--color-ink-3)", border: "none", padding: 0 }}
          >
            cancel
          </button>
        )}
      </div>

      {/* Big preview tile */}
      <div
        className="grid place-items-center rounded-[12px]"
        style={{
          height: 96,
          background: hasTarget ? "#fff" : "var(--color-paper-2)",
          border: `1.5px dashed ${hasTarget ? "var(--color-line-2)" : "var(--color-line)"}`,
          opacity: hasTarget ? 1 : 0.5,
          transition: "opacity .15s ease, background .15s ease",
        }}
      >
        <Tile
          kind={shape}
          color={color}
          x={0}
          y={0}
          size={64}
          rotate={rotation * 90}
          style={{ position: "static" }}
        />
      </div>

      {/* Shape picker */}
      <Section label="shape">
        <div className="grid grid-cols-4 gap-1.5">
          {BUILDER_SHAPES.map((s) => {
            const on = shape === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onShape(s)}
                className="grid aspect-square place-items-center rounded-[10px] transition-colors"
                style={{
                  background: on ? "var(--color-paper-2)" : "#fff",
                  border: `1.5px solid ${on ? "var(--color-ink)" : "var(--color-line)"}`,
                  boxShadow: on ? "0 2px 0 rgba(0,0,0,.10)" : "none",
                  cursor: "pointer",
                }}
                aria-pressed={on}
                aria-label={s}
              >
                <Tile
                  kind={s}
                  color={color}
                  x={0}
                  y={0}
                  size={28}
                  rotate={rotation * 90}
                  style={{ position: "static" }}
                />
              </button>
            );
          })}
        </div>
      </Section>

      {/* Colour picker */}
      <Section label="colour">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${Math.min(palette.length, 4)}, 1fr)`,
          }}
        >
          {palette.map((c) => {
            const on = color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onColor(c)}
                className="aspect-square rounded-[8px] transition-shadow"
                style={{
                  background: `var(--color-t-${c})`,
                  border: on
                    ? "2.5px solid var(--color-ink)"
                    : "2.5px solid #fff",
                  boxShadow: on
                    ? "0 2px 0 rgba(0,0,0,.20)"
                    : "0 2px 0 rgba(0,0,0,.10)",
                  cursor: "pointer",
                }}
                aria-pressed={on}
                aria-label={c}
              />
            );
          })}
        </div>
      </Section>

      {/* Rotation radio */}
      <Section label="rotation">
        <RotationRadio
          value={rotation}
          onChange={onRotation}
          shape={shape}
          color={color}
        />
      </Section>

      {/* Action area — varies by target kind */}
      <div className="flex gap-2 pt-1">
        {targetKind === "piece" ? (
          <>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-[12px] px-3.5 text-[13px] font-bold transition-colors"
              style={{
                height: 44,
                background: "var(--color-tint-red)",
                color: "var(--color-t-red)",
                border: "none",
                cursor: "pointer",
              }}
            >
              ⌫ Remove
            </button>
            <button
              type="button"
              onClick={onDoneEditing}
              className="flex-1 rounded-[12px] text-[13px] font-bold transition-transform"
              style={{
                height: 44,
                background: "var(--color-ink)",
                color: "#fff",
                border: "none",
                boxShadow: "0 4px 0 rgba(0,0,0,.10)",
                cursor: "pointer",
              }}
            >
              Done editing
            </button>
          </>
        ) : targetKind === "phantom" ? (
          <button
            type="button"
            onClick={onPlace}
            className="flex-1 rounded-[12px] text-[13px] font-bold transition-transform"
            style={{
              height: 44,
              background: "var(--color-t-red)",
              color: "#fff",
              border: "none",
              boxShadow: "0 4px 0 rgba(0,0,0,.10)",
              cursor: "pointer",
            }}
          >
            ＋ Place at {targetLabel}
          </button>
        ) : (
          <div
            className="t-mono grid flex-1 place-items-center rounded-[12px] text-[11px]"
            style={{
              height: 44,
              background: "transparent",
              border: "1.5px dashed var(--color-line-2)",
              color: "var(--color-ink-3)",
              padding: "0 12px",
              lineHeight: 1.4,
              textAlign: "center",
            }}
          >
            tap a cell to place
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Kbd>R</Kbd>
        <span className="text-[10px]" style={{ color: "var(--color-ink-3)" }}>
          rotate
        </span>
        <Kbd>Esc</Kbd>
        <span className="text-[10px]" style={{ color: "var(--color-ink-3)" }}>
          cancel
        </span>
        <Kbd>Enter</Kbd>
        <span className="text-[10px]" style={{ color: "var(--color-ink-3)" }}>
          {targetKind === "phantom" ? "place" : "confirm"}
        </span>
        {targetKind === "piece" && (
          <>
            <Kbd>Del</Kbd>
            <span
              className="text-[10px]"
              style={{ color: "var(--color-ink-3)" }}
            >
              remove
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="t-mono text-[9px] font-bold uppercase"
        style={{ letterSpacing: ".1em", color: "var(--color-ink-3)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="t-mono text-[10px] font-bold"
      style={{
        padding: "1px 5px",
        borderRadius: 4,
        background: "var(--color-paper-2)",
        color: "var(--color-ink-2)",
        border: "1px solid var(--color-line)",
        borderBottomWidth: 2,
      }}
    >
      {children}
    </span>
  );
}

export const Dock = memo(DockImpl);
