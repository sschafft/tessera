"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tile } from "@/components/canvas/Tile";
import { JoinCallCta } from "./JoinCallCta";

export interface GameEndedViewProps {
  code: string;
  workshopName: string;
}

interface PairSummary {
  pair_id: string;
  builder: string | null;
  guider: string | null;
  correct: number;
  total: number;
  placed: number;
  extras: number;
  complete: boolean;
  total_score: number;
  rounds: Array<{
    index: number;
    correct: number;
    total: number;
    score: number;
  }>;
}

export function GameEndedView({ code, workshopName }: GameEndedViewProps) {
  const [summary, setSummary] = useState<PairSummary[] | null>(null);
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const [whiteboardUrl, setWhiteboardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/games/${code}/summary`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.pairs)) setSummary(d.pairs);
        else setError(d.error ?? "Could not load summary.");
        if (typeof d.video_call_url === "string") setCallUrl(d.video_call_url);
        if (typeof d.whiteboard_url === "string")
          setWhiteboardUrl(d.whiteboard_url);
      })
      .catch(() => setError("Could not load summary."));
  }, [code]);

  return (
    <section className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 px-6 py-12 text-center">
      <div className="relative" style={{ width: 110, height: 110 }}>
        <Tile kind="hex" color="yellow" x={0} y={5} size={100} rotate={-8} />
        <Tile kind="tri-up" color="red" x={20} y={-2} size={60} rotate={12} />
        <Tile kind="sq" color="green" x={70} y={70} size={40} rotate={6} />
      </div>
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        GAME OVER
      </div>
      <h1 className="t-display text-[36px]">Thanks for playing.</h1>
      <p
        className="text-[15px] text-[var(--color-ink-2)]"
        style={{ lineHeight: 1.5 }}
      >
        <b>{workshopName}</b> is complete. Hop back on the call to debrief —
        what did the briefs reveal? Where did the picture diverge? What
        surprised you?
      </p>

      {callUrl && (
        <JoinCallCta
          videoCallUrl={callUrl}
          whiteboardUrl={whiteboardUrl}
          size="md"
        />
      )}

      {summary && summary.length > 0 && (
        <div className="t-card flex w-full flex-col gap-3 p-5 text-left">
          <span
            className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]"
            style={{ letterSpacing: ".15em" }}
          >
            Pair leaderboard
          </span>
          <ul className="flex flex-col gap-2.5">
            {summary.map((p, i) => {
              const isWinner = i === 0 && p.total_score > 0;
              return (
                <li
                  key={p.pair_id}
                  className="flex flex-col gap-1.5 rounded-[12px] px-3 py-2.5"
                  style={{
                    background: isWinner
                      ? "var(--color-tint-green)"
                      : "var(--color-paper-2)",
                    border: `1.5px solid ${
                      isWinner
                        ? "var(--color-t-green)"
                        : "var(--color-line)"
                    }`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="t-mono w-6 text-[14px] font-bold"
                      style={{ color: "var(--color-ink-3)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[14px] font-bold">
                      {p.builder ?? "?"} ↔ {p.guider ?? "?"}
                    </span>
                    <span
                      className="t-display text-[20px] font-bold"
                      style={{
                        color: isWinner
                          ? "var(--color-t-green)"
                          : "var(--color-ink)",
                      }}
                    >
                      {p.total_score} pt{Math.abs(p.total_score) === 1 ? "" : "s"}
                    </span>
                  </div>
                  {p.rounds.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-9 text-[11px] text-[var(--color-ink-3)]">
                      {p.rounds.map((r) => (
                        <span
                          key={r.index}
                          className="t-mono rounded-full bg-white px-2 py-0.5"
                          style={{ border: "1px solid var(--color-line)" }}
                        >
                          R{r.index} · {r.correct}/{r.total} · {r.score}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {summary && summary.length === 0 && (
        <p className="t-mono text-[11px] text-[var(--color-ink-3)]">
          No pairs recorded for this game.
        </p>
      )}

      {error && (
        <p className="text-[12px] text-[var(--color-t-red)]">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="t-btn t-btn--primary">
          ← Back to home
        </Link>
        <Link
          href="/facilitator-guide"
          className="t-btn t-btn--ghost t-btn--sm"
        >
          Facilitator guide
        </Link>
      </div>
    </section>
  );
}
