"use client";

import { useId } from "react";

export interface CodeInputProps {
  /** Current value, e.g. "HEX-934". Auto-uppercased on input. */
  value: string;
  onChange?: (value: string) => void;
  /** Show as read-only display when no onChange handler provided. */
  readOnly?: boolean;
}

const PATTERN = /^[A-Z]{0,3}-?[A-Z0-9]{0,3}$/;

/**
 * CodeInput — fixed-width 7-cell display for the XXX-NNN game code.
 * The hyphen is rendered as a separator cell, never editable. When
 * readOnly is true (or no onChange given), it's a passive display.
 */
export function CodeInput({ value, onChange, readOnly }: CodeInputProps) {
  const id = useId();
  const padded = value.padEnd(7, " ");
  const chars = padded.split("");
  const isInteractive = !readOnly && Boolean(onChange);

  return (
    <div className="flex items-center gap-1.5">
      {isInteractive && (
        <input
          id={id}
          aria-label="Game code"
          className="absolute h-px w-px opacity-0"
          maxLength={7}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            if (next === "" || PATTERN.test(next)) {
              onChange?.(next);
            }
          }}
        />
      )}
      <label htmlFor={id} className="contents">
        {chars.map((c, i) => {
          const isHyphen = i === 3;
          return (
            <span
              key={i}
              className="grid place-items-center"
              style={{
                width: 44,
                height: 52,
                borderRadius: 10,
                border: isHyphen ? "none" : "1.5px solid var(--color-ink)",
                background: isHyphen ? "transparent" : "#fff",
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 700,
                cursor: isInteractive ? "text" : "default",
              }}
            >
              {isHyphen ? "–" : c.trim() || ""}
            </span>
          );
        })}
      </label>
    </div>
  );
}
