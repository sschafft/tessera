"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/primitives/Wordmark";
import { RoleChip, type Role } from "@/components/primitives/RoleChip";
import { Avatar } from "@/components/primitives/Avatar";
import type { TileColor } from "@/components/canvas/Tile";

export interface PlayTopBarProps {
  code: string;
  /** Null while the player is in the lobby with no role assigned. */
  role: Role | null;
  partner: {
    name: string;
    color: TileColor;
    role: string;
  } | null;
  round: {
    started_at: string | null;
    duration_seconds: number;
    status: "pending" | "running" | "ended";
  } | null;
  videoCallUrl: string;
  whiteboardUrl: string | null;
}

export function PlayTopBar({
  code,
  role,
  partner,
  round,
  videoCallUrl,
  whiteboardUrl,
}: PlayTopBarProps) {
  const remaining = useTimer(round);
  const isLastTwoMinutes =
    round?.status === "running" && remaining > 0 && remaining <= 120;
  return (
    <header className="flex h-15 flex-shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        <Wordmark size={20} />
        <span className="h-5 w-px bg-[var(--color-line)]" />
        <span className="t-mono text-[12px] text-[var(--color-ink-3)]">
          game · {code}
        </span>
        {role ? (
          <RoleChip role={role} />
        ) : (
          <span
            className="t-mono rounded-full bg-[var(--color-paper-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-ink-3)]"
            aria-label="Awaiting role assignment"
          >
            in lobby
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span
          className="t-mono rounded-full px-3 py-1.5 text-[14px] font-bold"
          style={{
            background: isLastTwoMinutes
              ? "var(--color-tint-red)"
              : "var(--color-paper-2)",
            color: isLastTwoMinutes ? "var(--color-t-red)" : "inherit",
            boxShadow: isLastTwoMinutes
              ? "inset 0 0 0 1.5px var(--color-t-red)"
              : "none",
            animation: isLastTwoMinutes
              ? "tessera-jiggle 700ms ease-in-out infinite"
              : "none",
            transition: "background 200ms, color 200ms",
          }}
        >
          ⏱ {formatDuration(remaining)}
        </span>
        <LinksBar
          videoCallUrl={videoCallUrl}
          whiteboardUrl={whiteboardUrl}
        />
        {partner && (
          <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-paper-2)] py-1 pl-1 pr-3">
            <Avatar name={partner.name} color={partner.color} size={26} />
            <span className="text-[12px] font-semibold">{partner.name}</span>
            <span className="text-[11px] text-[var(--color-ink-3)]">
              · {partner.role}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

function LinksBar({
  videoCallUrl,
  whiteboardUrl,
}: {
  videoCallUrl: string;
  whiteboardUrl: string | null;
}) {
  return (
    <div className="t-card flex items-center gap-1 p-1.5">
      <a
        href={videoCallUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[var(--color-paper-2)]"
      >
        <span
          className="grid h-[22px] w-[22px] place-items-center rounded-md text-[12px] font-bold text-white"
          style={{ background: "var(--color-t-blue)" }}
        >
          ▶
        </span>
        <span className="flex flex-col text-[12px] font-bold leading-tight">
          Video call
          <span className="t-mono text-[10px] font-normal text-[var(--color-ink-3)]">
            {hostnameOf(videoCallUrl)}
          </span>
        </span>
      </a>
      {whiteboardUrl && (
        <>
          <span className="h-7 w-px bg-[var(--color-line)]" />
          <a
            href={whiteboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[var(--color-paper-2)]"
          >
            <span
              className="grid h-[22px] w-[22px] place-items-center rounded-md text-[12px] font-bold text-white"
              style={{ background: "var(--color-t-purple)" }}
            >
              ▦
            </span>
            <span className="flex flex-col text-[12px] font-bold leading-tight">
              Whiteboard
              <span className="t-mono text-[10px] font-normal text-[var(--color-ink-3)]">
                {hostnameOf(whiteboardUrl)}
              </span>
            </span>
          </a>
        </>
      )}
    </div>
  );
}

function hostnameOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function useTimer(
  round: { started_at: string | null; duration_seconds: number; status: string } | null,
): number {
  // SSR-safe: `now` stays null until the client mounts. Initial server +
  // first client render both compute remaining off the static
  // duration_seconds, so the rendered "X:XX" string matches and React
  // doesn't fire hydration error #418. The interval kicks in after
  // mount and ticks the timer down for real.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!round || round.status !== "running" || !round.started_at) {
    return round?.duration_seconds ?? 0;
  }
  if (now === null) {
    return round.duration_seconds;
  }
  const startedMs = new Date(round.started_at).getTime();
  const elapsed = Math.floor((now - startedMs) / 1000);
  return Math.max(0, round.duration_seconds - elapsed);
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
