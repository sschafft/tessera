"use client";

import { Field } from "@/components/primitives/Field";

export type BreakoutProvider = "none" | "google_meet" | "jitsi";

const BREAKOUT_PROVIDER_OPTIONS = [
  {
    value: "none" as const,
    label: "No breakouts",
    sub: "Pairs stay in the main room",
  },
  {
    value: "google_meet" as const,
    label: "Google Meet",
    sub: "Requires participant emails · GM signs in",
  },
  {
    value: "jitsi" as const,
    label: "Jitsi",
    sub: "Free · no sign-in for anyone",
  },
] satisfies Array<{ value: BreakoutProvider; label: string; sub: string }>;

/**
 * Three-option radio for breakout-room provider. Shared between the
 * regular host form (LandingTabs) and the CSV upload modal so both
 * surfaces present the same affordances and disabled-state copy when
 * Google Meet isn't configured on the deployment.
 */
export function BreakoutProviderPicker({
  provider,
  onChange,
  googleMeetAvailable,
  disabled = false,
  label = "Breakout rooms",
  hint = "Each builder/guider pair gets a private call link",
}: {
  provider: BreakoutProvider;
  onChange: (p: BreakoutProvider) => void;
  googleMeetAvailable: boolean;
  /** Disable every option (e.g. submitting). */
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-1.5">
        {BREAKOUT_PROVIDER_OPTIONS.map((opt) => {
          const active = provider === opt.value;
          const optDisabled =
            disabled ||
            (opt.value === "google_meet" && !googleMeetAvailable);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (optDisabled) return;
                onChange(opt.value);
              }}
              disabled={optDisabled}
              className="flex items-start gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors"
              style={{
                background: active
                  ? "var(--color-tint-blue)"
                  : "var(--color-paper-2)",
                border: active
                  ? "1.5px solid var(--color-t-blue)"
                  : "1.5px solid var(--color-line)",
                opacity: optDisabled ? 0.5 : 1,
                cursor: optDisabled ? "not-allowed" : "pointer",
              }}
              aria-pressed={active}
              aria-disabled={optDisabled}
            >
              <span
                className="mt-0.5 inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full"
                style={{
                  border: active
                    ? "4px solid var(--color-t-blue)"
                    : "1.5px solid var(--color-line)",
                  background: "#fff",
                }}
                aria-hidden
              />
              <span className="flex flex-col gap-0.5">
                <span
                  className="text-[13px] font-semibold"
                  style={{
                    color: active
                      ? "var(--color-t-blue)"
                      : "var(--color-ink)",
                  }}
                >
                  {opt.label}
                </span>
                <span className="text-[11px] text-[var(--color-ink-3)]">
                  {opt.value === "google_meet" && !googleMeetAvailable
                    ? "Not configured on this deployment"
                    : opt.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}
