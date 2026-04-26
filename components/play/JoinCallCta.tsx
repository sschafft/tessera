"use client";

export interface JoinCallCtaProps {
  videoCallUrl: string;
  whiteboardUrl: string | null;
  /** Larger primary style (default) on waiting screens; smaller for inline use. */
  size?: "lg" | "md";
}

/**
 * Big primary "Join the video call" button used on the waiting / lobby
 * screens — the single most important action a player has before the
 * round starts. Tessera is a scaffold for a conversation; the
 * conversation has to be happening.
 */
export function JoinCallCta({
  videoCallUrl,
  whiteboardUrl,
  size = "lg",
}: JoinCallCtaProps) {
  const big = size === "lg";
  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={videoCallUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 rounded-full font-semibold transition-transform"
        style={{
          background: "var(--color-t-blue)",
          color: "#fff",
          padding: big ? "16px 28px" : "12px 20px",
          fontSize: big ? 18 : 14,
          boxShadow: "0 4px 0 rgb(0 0 0 / 0.10), 0 10px 22px rgb(60 40 10 / 0.10)",
          textDecoration: "none",
        }}
      >
        <span
          aria-hidden="true"
          className="grid place-items-center rounded-full"
          style={{
            width: big ? 32 : 24,
            height: big ? 32 : 24,
            background: "rgba(255,255,255,0.22)",
            fontSize: big ? 16 : 12,
          }}
        >
          ▶
        </span>
        Join the video call
      </a>
      {whiteboardUrl && (
        <a
          href={whiteboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="t-mono text-[12px] underline"
          style={{ color: "var(--color-ink-3)" }}
        >
          (or open the whiteboard)
        </a>
      )}
    </div>
  );
}
