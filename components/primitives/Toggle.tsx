"use client";

export interface ToggleProps {
  label: string;
  sub?: string;
  on: boolean;
  onChange?: (on: boolean) => void;
}

export function Toggle({ label, sub, on, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange?.(!on)}
      className="relative flex cursor-pointer flex-col gap-1 rounded-[14px] border-[1.5px] p-3.5 text-left transition-colors"
      style={{
        borderColor: on ? "var(--color-ink)" : "var(--color-line)",
        background: on ? "#fff" : "var(--color-paper-2)",
      }}
    >
      <span className="text-[13px] font-semibold text-[var(--color-ink)]">
        {label}
      </span>
      {sub && (
        <span className="text-[11px] text-[var(--color-ink-3)]">{sub}</span>
      )}
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.5px] text-[12px] font-bold text-white"
        style={{
          background: on ? "var(--color-t-green)" : "transparent",
          borderColor: on ? "var(--color-t-green)" : "var(--color-line-2)",
        }}
      >
        {on ? "✓" : ""}
      </span>
    </button>
  );
}
