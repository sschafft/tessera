import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, required, children, htmlFor }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-2)]">
          {label}
          {required && (
            <span className="ml-1 text-[var(--color-t-red)]">*</span>
          )}
        </span>
        {hint && (
          <span className="text-[11px] text-[var(--color-ink-3)]">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}
