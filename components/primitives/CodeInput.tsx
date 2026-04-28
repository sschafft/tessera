"use client";

import { useId } from "react";

export interface CodeInputProps {
  /** Current value, e.g. "HEX-934". Auto-uppercased + auto-hyphenated on input. */
  value: string;
  onChange?: (value: string) => void;
  /** Show as read-only display when no onChange handler provided. */
  readOnly?: boolean;
}

const ALLOWED = /[A-HJ-NP-Z2-9]/g;

/**
 * Auto-format a raw string into XXX-NNN. Drops anything outside our
 * code alphabet (no I, O, 0, 1), then hyphenates after the first 3
 * chars. Tolerates pasting "keb 4ha", "kEb-4hA", or "KEB4HA".
 */
function normalizeCodeInput(raw: string): string {
  const cleaned = raw.toUpperCase().match(ALLOWED)?.join("") ?? "";
  const head = cleaned.slice(0, 3);
  const tail = cleaned.slice(3, 6);
  return tail ? `${head}-${tail}` : head;
}

/**
 * CodeInput — single robust text input that visually evokes the
 * fixed XXX-NNN format. Auto-uppercases + auto-hyphenates as the
 * user types or pastes. Tolerates whitespace, lowercase, and
 * missing/extra hyphens.
 */
export function CodeInput({ value, onChange, readOnly }: CodeInputProps) {
  const id = useId();
  const isInteractive = !readOnly && Boolean(onChange);

  return (
    <input
      id={id}
      aria-label="Game code"
      readOnly={!isInteractive}
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      inputMode="text"
      maxLength={10}
      placeholder="XXX-NNN"
      value={value}
      onChange={(e) => onChange?.(normalizeCodeInput(e.target.value))}
      className="t-mono w-full text-center"
      style={{
        height: 60,
        padding: "0 16px",
        border: "1.5px solid var(--color-ink)",
        borderRadius: 12,
        background: "#fff",
        fontFamily: "var(--font-display)",
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: ".15em",
        outline: "none",
        textTransform: "uppercase",
      }}
    />
  );
}
