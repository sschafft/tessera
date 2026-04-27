"use client";

export interface JoinCallCtaProps {
  videoCallUrl: string;
  whiteboardUrl: string | null;
  /** Larger primary style (default) on waiting screens; smaller for inline use. */
  size?: "lg" | "md";
}

/**
 * Domains we treat as placeholder / non-real video URLs. Surface a
 * "no call configured" hint instead of rendering a CTA that links into
 * the void. example.com / example.org / localhost reach this when a GM
 * filled the form with a sentinel during testing.
 */
const PLACEHOLDER_HOSTS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "127.0.0.1",
]);

function isPlaceholderUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return [...PLACEHOLDER_HOSTS].some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return true;
  }
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
  const placeholder = isPlaceholderUrl(videoCallUrl);
  if (placeholder) {
    return (
      <div
        className="flex flex-col items-center gap-1 rounded-[10px] px-4 py-3 text-center"
        style={{
          background: "var(--color-tint-yellow)",
          color: "#7a5b00",
          maxWidth: 360,
        }}
      >
        <span className="text-[13px] font-semibold">
          No video call configured
        </span>
        <span className="text-[12px]" style={{ lineHeight: 1.4 }}>
          The facilitator hasn&apos;t set a real video link yet
          ({new URL(videoCallUrl).hostname}). Hop into your usual call and
          ping them.
        </span>
      </div>
    );
  }
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
