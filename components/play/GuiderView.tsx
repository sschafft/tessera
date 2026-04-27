"use client";

import { useEffect, useState } from "react";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { BriefGate } from "./BriefGate";
import { JoinCallCta } from "./JoinCallCta";
import { PairNameBadge } from "./PairNameBadge";
import type { PlayState } from "./PlayContent";

export interface GuiderViewProps {
  state: PlayState;
}

export function GuiderView({ state }: GuiderViewProps) {
  const briefSignature =
    state.brief?.title ?? (state.brief ? "(present)" : null);
  const [briefOpened, setBriefOpened] = useState(briefSignature === null);
  useEffect(() => {
    setBriefOpened(briefSignature === null);
  }, [briefSignature]);

  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound state={state} />;
  }
  const showCoords = (state.round.complexity ?? 5) <= 4;
  const partnerName = state.partner?.display_name ?? "builder";
  const defaultPairName = `${state.me.display_name} ↔ ${partnerName}`;
  return (
    <section className="relative mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center justify-center gap-6 p-6">
      {state.pair && (
        <div className="absolute left-6 top-6 z-30">
          <PairNameBadge
            code={state.code}
            pairId={state.pair.id}
            displayName={state.pair.display_name}
            defaultName={defaultPairName}
          />
        </div>
      )}
      <div className="absolute right-6 top-6 z-30 flex flex-col gap-3">
        {state.brief && state.brief.role === "guider" && (
          <BriefEnvelope
            role="guider"
            title={state.brief.title}
            rules={state.brief.rules}
            onOpen={() => setBriefOpened(true)}
            emphasize={!briefOpened}
          />
        )}
        {state.partner_brief && (
          <BriefEnvelope
            role={state.partner_brief.role}
            title={state.partner_brief.title}
            rules={state.partner_brief.rules}
            defaultOpen
          />
        )}
      </div>
      <div className="relative">
        <span
          className="t-stamp absolute -left-2 -top-4 z-10"
          style={{
            color: "var(--color-t-red)",
            background: "#fffaf0",
            padding: "5px 12px",
          }}
        >
          ● THE GOAL · only you see this
        </span>
        {state.live_score && (
          <span
            className="t-mono absolute -right-2 -top-4 z-10 rounded-full px-3 py-1 text-[11px] font-bold"
            style={{
              background:
                state.live_score.score > 0
                  ? "var(--color-tint-green)"
                  : "var(--color-paper-2)",
              color:
                state.live_score.score > 0
                  ? "var(--color-t-green)"
                  : "var(--color-ink-2)",
              boxShadow:
                state.live_score.score > 0
                  ? "inset 0 0 0 1.5px var(--color-t-green)"
                  : "inset 0 0 0 1.5px var(--color-line)",
            }}
            aria-label={`Builder score ${state.live_score.score}, ${state.live_score.correct} of ${state.live_score.total} correct`}
          >
            ★ {state.live_score.score} pts · {state.live_score.correct} /{" "}
            {state.live_score.total}
          </span>
        )}
        <PlayCanvas
          pieces={state.goal}
          complexity={state.round.complexity}
          showCoords={showCoords}
        />
      </div>
      <p
        className="t-mono max-w-[520px] text-center text-[12px] text-[var(--color-ink-3)]"
        style={{ lineHeight: 1.5 }}
      >
        Talk through the picture on your call. Your builder is rebuilding it
        without seeing this.
      </p>

      {state.builder_snapshot && state.builder_snapshot.length > 0 && (
        <BuilderSnapshotPanel
          snapshot={state.builder_snapshot}
          complexity={state.round.complexity}
          showCoords={showCoords}
        />
      )}

      {!briefOpened && <BriefGate role="guider" />}
    </section>
  );
}

function BuilderSnapshotPanel({
  snapshot,
  complexity,
  showCoords,
}: {
  snapshot: NonNullable<PlayState["builder_snapshot"]>;
  complexity: number;
  showCoords: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-6 right-6 z-10 w-[300px] cursor-pointer text-left"
        style={{ background: "transparent", padding: 0, border: "none" }}
        aria-label="Open builder shared progress full screen"
      >
        <div className="t-card flex flex-col gap-2 p-3 hover:shadow-md-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
              Builder shared progress
            </span>
            <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
              tap to expand · {snapshot.length} placed
            </span>
          </div>
          <div
            className="overflow-hidden rounded-[10px]"
            style={{
              transform: "scale(0.4)",
              transformOrigin: "top left",
              height: 200,
              marginBottom: -200,
            }}
          >
            <PlayCanvas
              pieces={snapshot}
              complexity={complexity}
              showCoords={showCoords}
            />
          </div>
        </div>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(31,26,20,0.62)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="t-card flex flex-col items-center gap-3 p-5"
            style={{ background: "#fff", maxWidth: "92vw", maxHeight: "92vh" }}
          >
            <div className="flex w-full items-center justify-between gap-3">
              <span
                className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]"
                style={{ letterSpacing: ".15em" }}
              >
                Builder shared progress · {snapshot.length} placed
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-md text-[20px] text-[var(--color-ink-2)]"
                style={{ background: "var(--color-paper-2)" }}
              >
                ×
              </button>
            </div>
            <PlayCanvas
              pieces={snapshot}
              complexity={complexity}
              showCoords={showCoords}
            />
            <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
              Esc or click outside to close
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function WaitingForRound({ state }: { state: PlayState }) {
  return (
    <section className="m-auto flex max-w-[520px] flex-col items-center gap-5 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        GUIDER · WAITING
      </div>
      <h1 className="t-display text-3xl">Hop on the call.</h1>
      <p className="text-[15px] text-[var(--color-ink-2)]">
        Once the facilitator hits Start you&apos;ll see the goal pattern — and
        your builder will be on the call ready to listen to your descriptions.
      </p>
      <JoinCallCta
        videoCallUrl={state.video_call_url}
        whiteboardUrl={state.whiteboard_url}
      />
    </section>
  );
}
