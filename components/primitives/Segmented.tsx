"use client";

export interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange?: (value: T) => void;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      className="flex gap-0.5 rounded-[14px] bg-[var(--color-paper-2)] p-1"
      role="radiogroup"
    >
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange?.(o)}
            className="flex-1 cursor-pointer border-none px-3 py-2.5 text-[13px] font-semibold transition-colors"
            style={{
              background: active ? "#fff" : "transparent",
              borderRadius: "calc(var(--radius-md) - 4px)",
              color: active ? "var(--color-ink)" : "var(--color-ink-3)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,.10)" : "none",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
