"use client";

export interface BriefGateProps {
  role: "builder" | "guider";
}

/**
 * Glassy overlay shown over the canvas (and tray) until the player
 * has opened their secret brief. Lifts the moment they tap the
 * sealed envelope. The "don't share contents" framing lives here +
 * inside the open envelope so it lands twice.
 */
export function BriefGate({ role }: BriefGateProps) {
  const roleLabel = role === "builder" ? "builder" : "guider";
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{
        background: "rgba(255, 250, 240, 0.78)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div
        className="t-card flex max-w-[440px] flex-col items-center gap-3 px-6 py-6 text-center"
        style={{ background: "#fff" }}
      >
        <span
          aria-hidden="true"
          className="grid h-12 w-12 place-items-center rounded-full text-[24px]"
          style={{
            background: "var(--color-tint-red)",
            color: "var(--color-t-red)",
          }}
        >
          ✉
        </span>
        <h2 className="t-display text-[22px] font-bold">
          Open your {roleLabel} brief first
        </h2>
        <p
          className="text-[13px] text-[var(--color-ink-2)]"
          style={{ lineHeight: 1.5 }}
        >
          Your secret rules are in the envelope at the top right. Read them
          before you start — and remember: <b>don&apos;t share the contents
          of your brief with your partner</b>. They have a different one.
          You can answer their yes / no questions like a game of 20
          questions.
        </p>
        <span
          className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]"
          aria-hidden="true"
        >
          ↗ tap the envelope
        </span>
      </div>
    </div>
  );
}
