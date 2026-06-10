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
  /** Self-chosen pair name (e.g. "The Pelicans"); null when unnamed. */
  display_name: string | null;
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

// The aggregated friction-attribution card was removed 2026-06-10
// with the survey redesign. The reflection data is still collected
// per round_surveys for post-hoc analysis, but no longer surfaced on
// the GameEndedView — anonymised round means felt anonymous in the
// wrong way, the per-pair conversation belongs on the call.

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
        WORKSHOP COMPLETE
      </div>
      <h1 className="t-display text-[36px]">The game ends; the workshop begins.</h1>
      <p
        className="text-[15px] text-[var(--color-ink-2)]"
        style={{ lineHeight: 1.5 }}
      >
        <b>{workshopName}</b> is wrapped. The score below is one read on the
        room — but the real signal is what each pair noticed about how they
        talked past each other. Stay on the call and walk through the
        prompts together.
      </p>

      <JoinCallCta
        videoCallUrl={callUrl}
        whiteboardUrl={whiteboardUrl}
        size="md"
      />

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
                      {p.display_name && p.display_name.length > 0
                        ? p.display_name
                        : `${p.builder ?? "?"} ↔ ${p.guider ?? "?"}`}
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

      <div className="t-card flex w-full flex-col gap-2.5 p-5 text-left">
        <span
          className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]"
          style={{ letterSpacing: ".15em" }}
        >
          Debrief prompts · for the call
        </span>
        <p className="text-[12px] text-[var(--color-ink-3)]">
          Pick one — they go in order from <i>tactical</i> to <i>structural</i>.
          The last one is the hardest; sit with it.
        </p>
        <ul className="flex flex-col gap-2">
          {[
            "Read your brief out loud. What did your partner think they were hearing?",
            "Where did the picture first diverge from the goal? When did you notice — and what did you stop asking each other after that?",
            "Which of these constraints — translation, time pressure, hidden rules — actually exist on your team today?",
          ].map((q, i) => (
            <li
              key={i}
              className="rounded-[10px] px-3 py-2 text-[13px]"
              style={{
                background: "var(--color-paper-2)",
                color: "var(--color-ink)",
                lineHeight: 1.4,
              }}
            >
              <span
                className="t-mono mr-2 text-[11px] font-bold"
                style={{ color: "var(--color-ink-3)" }}
              >
                {i + 1}.
              </span>
              {/* Explicit {" "} so screen readers and innerText
                  capture a space between the numeral and the prompt
                  — the mr-2 only handles visual spacing. */}
              {" "}{q}
            </li>
          ))}
        </ul>
      </div>

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
