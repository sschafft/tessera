"use client";

import { useEffect, useState } from "react";

export interface ShareJoinLinkProps {
  code: string;
}

/**
 * Shareable "join this game" affordance for the GM. The URL points at
 * `/g/[code]/join` which is the regular join form — it just bypasses
 * the home page so the player doesn't have to type the code.
 */
export function ShareJoinLink({ code }: ShareJoinLinkProps) {
  const [origin, setOrigin] = useState("");
  const [copiedKind, setCopiedKind] = useState<"link" | "code" | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = origin ? `${origin}/g/${code}/join` : "";
  const linkPreview = origin
    ? `${origin.replace(/^https?:\/\//, "")}/g/${code}/join`
    : `…/g/${code}/join`;

  const copy = async (kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(kind === "link" ? link : code);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind(null), 1500);
    } catch {
      setCopiedKind(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-5 pt-4 pb-3">
      <div
        className="flex items-baseline justify-between"
        style={{ marginTop: -2 }}
      >
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Invite players
        </span>
        <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
          no logins needed
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => copy("code")}
          title="Copy game code"
          className="t-mono inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-[14px] font-bold tracking-wide hover:bg-[var(--color-paper-2)]"
        >
          {code}
          <span
            className="t-mono text-[9px] font-normal uppercase tracking-widest text-[var(--color-ink-3)]"
          >
            {copiedKind === "code" ? "copied!" : "tap to copy"}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => copy("link")}
        disabled={!link}
        title="Copy share link"
        className="t-mono group flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[11px] disabled:opacity-50"
        style={{
          background: "var(--color-tint-yellow)",
          color: "#7a5b00",
          border: "1.5px solid var(--color-t-yellow)",
        }}
      >
        <span aria-hidden="true">🔗</span>
        <span className="flex-1 break-all">{linkPreview}</span>
        <span className="font-bold uppercase tracking-widest text-[10px]">
          {copiedKind === "link" ? "✓ copied" : "copy"}
        </span>
      </button>
      <span className="t-mono text-[10px] leading-tight text-[var(--color-ink-3)]">
        Players land directly on the join form — no code to type.
      </span>
    </div>
  );
}
