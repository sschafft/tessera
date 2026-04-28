"use client";

export interface JoinCallCtaProps {
  /**
   * The facilitator's call link. When null OR a placeholder host
   * (example.com etc), the component renders nothing so the parent
   * can lay out without reserving space for a CTA that won't appear.
   */
  videoCallUrl: string | null;
  whiteboardUrl: string | null;
  /** Larger primary style (default) on waiting screens; smaller for inline use. */
  size?: "lg" | "md";
}

/**
 * Domains we treat as placeholder / non-real video URLs. The host
 * form only persists real http(s) URLs so this is mostly for the
 * playtest agents' meet.example.com and the rare GM who pasted a
 * sentinel before realising the field is now optional.
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
 * screens. Renders nothing when no URL is configured (or when the URL
 * is a placeholder) — facilitators may coordinate the call link
 * out-of-band, and a missing CTA is cleaner than a "no link configured"
 * yellow note repeated across every player view.
 */
export function JoinCallCta({
  videoCallUrl,
  whiteboardUrl,
  size = "lg",
}: JoinCallCtaProps) {
  const big = size === "lg";
  if (!videoCallUrl || isPlaceholderUrl(videoCallUrl)) {
    // Whiteboard alone still warrants a small CTA so observers can
    // pop the scratch board up without the call link.
    if (whiteboardUrl) {
      return (
        <a
          href={whiteboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="t-mono text-[12px] underline"
          style={{ color: "var(--color-ink-3)" }}
        >
          Open the whiteboard ↗
        </a>
      );
    }
    return null;
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
