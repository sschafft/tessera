"use client";

export interface ComplexitySliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const COMPLEXITY_HINTS = [
  "",
  "icebreaker",
  "icebreaker",
  "casual",
  "casual",
  "workshop",
  "workshop",
  "difficult",
  "punishing",
] as const;

export function complexityHint(v: number): string {
  return COMPLEXITY_HINTS[v] ?? "";
}

function colorForLevel(i: number): string {
  if (i <= 2) return "var(--color-t-green)";
  if (i <= 4) return "var(--color-t-yellow)";
  if (i <= 6) return "var(--color-t-orange)";
  return "var(--color-t-red)";
}

export function ComplexitySlider({
  value,
  onChange,
  min = 1,
  max = 8,
}: ComplexitySliderProps) {
  const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div
      className="flex items-center gap-1.5"
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      {levels.map((i) => {
        const active = i <= value;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className="t-mono h-9 flex-1 cursor-pointer rounded-lg border-none text-[11px] font-bold transition-colors"
            style={{
              background: active
                ? colorForLevel(i)
                : "var(--color-paper-2)",
              color: active ? "#fff" : "var(--color-ink-3)",
            }}
            aria-label={`Complexity ${i}`}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
}
