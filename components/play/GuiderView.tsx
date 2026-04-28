"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { BriefGate } from "./BriefGate";
import { Confetti } from "./Confetti";
import { JoinCallCta } from "./JoinCallCta";
import { PairNameBadge } from "./PairNameBadge";
import { PairNameModal } from "./PairNameModal";
import { SolvedBanner } from "./SolvedBanner";
import { playSolved } from "@/lib/sound";
import type { PlayState } from "./PlayContent";

export interface GuiderViewProps {
  state: PlayState;
}

export function GuiderView({ state }: GuiderViewProps) {
  const briefSignature =
    state.brief?.title ?? (state.brief ? "(present)" : null);
  const [briefOpened, setBriefOpened] = useState(briefSignature === null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-arms the brief gate when a super-power swaps the brief mid-round (mirrors BuilderView).
    setBriefOpened(briefSignature === null);
  }, [briefSignature]);

  // Pair-name nudge — fires after the player closes their own brief if
  // the pair is still anonymous. SessionStorage tracks dismissal per
  // pair so this never pesters a player twice in a session.
  const [showNameNudge, setShowNameNudge] = useState(false);
  const onBriefClose = useCallback(() => {
    const pair = state.pair;
    if (!pair) return;
    if (pair.display_name && pair.display_name.length > 0) return;
    // Don't pop the naming modal mid-round — playtest #b4vnm8o20
    // caught the modal sitting over the canvas and intercepting clicks
    // on Test solution. Inline PairNameBadge stays available for
    // mid-round renames.
    if (state.round?.status === "running") return;
    const key = `tessera_pair_name_dismissed_${pair.id}`;
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(key) === "1"
    ) {
      return;
    }
    setShowNameNudge(true);
  }, [state.pair, state.round?.status]);
  const dismissNameNudge = useCallback(() => {
    if (state.pair && typeof window !== "undefined") {
      window.sessionStorage.setItem(
        `tessera_pair_name_dismissed_${state.pair.id}`,
        "1",
      );
    }
    setShowNameNudge(false);
  }, [state.pair]);

  // Celebration plumbing — fires off the live_score that's broadcast
  // to both roles whenever Test Build is on (or the round ends). The
  // guider used to get zero feedback as the builder progressed; now
  // each correct piece sprinkles confetti next to the score chip and
  // the moment correct === total a major SolvedBanner takes the
  // viewport, mirroring what the builder sees on Test solution.
  const liveCorrect = state.live_score?.correct ?? 0;
  const liveTotal = state.live_score?.total ?? 0;
  const liveScore = state.live_score?.score ?? 0;
  const prevCorrectRef = useRef(0);
  const [partialKey, setPartialKey] = useState(0);
  const [solvedShown, setSolvedShown] = useState(false);
  const solvedFiredForRoundRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevCorrectRef.current;
    if (liveCorrect > prev) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- bumps the confetti key on each rising-edge so the burst replays per new correct piece.
      setPartialKey((k) => k + 1);
    }
    prevCorrectRef.current = liveCorrect;
  }, [liveCorrect]);
  useEffect(() => {
    const roundId = state.round?.id ?? null;
    if (!roundId) return;
    if (
      liveTotal > 0 &&
      liveCorrect === liveTotal &&
      solvedFiredForRoundRef.current !== roundId
    ) {
      solvedFiredForRoundRef.current = roundId;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot solved banner trigger; gated by the per-round ref so it can't loop.
      setSolvedShown(true);
      if (state.sound_on) playSolved();
    }
  }, [liveCorrect, liveTotal, state.round?.id, state.sound_on]);

  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound state={state} />;
  }
  const showCoords = (state.round.complexity ?? 5) <= 4;
  const partnerName = state.partner?.display_name ?? "builder";
  const defaultPairName = `${state.me.display_name} ↔ ${partnerName}`;
  return (
    <section className="relative flex w-full flex-1 gap-4 p-6">
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
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
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
        {/* Live builder-progress chip — visible to the guider always,
            so they have a continuous "your builder is building" pulse
            instead of staring at a static board between Test/Share
            events. We deliberately surface only the count, never the
            layout, so the asymmetry is preserved. Hidden when the
            score chip below is showing the same info more richly. */}
        {!state.live_score && state.goal_count > 0 && (
          <span
            className="t-mono absolute -right-2 -top-4 z-10 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
            style={{
              background: "var(--color-paper-2)",
              color: "var(--color-ink-2)",
              boxShadow: "inset 0 0 0 1.5px var(--color-line)",
            }}
            aria-label={`Builder has placed ${state.builder_placements_count} of ${state.goal_count} pieces`}
          >
            ◉ {state.builder_placements_count} / {state.goal_count} placed
          </span>
        )}
        {state.live_score && (
          <div
            className="absolute -right-2 -top-4 z-10 flex items-center"
            aria-label={`Builder score ${liveScore}, ${liveCorrect} of ${liveTotal} correct`}
          >
            <span
              className="t-mono rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-transform"
              style={(() => {
                const tint =
                  liveScore > 0 ? "green" : liveScore < 0 ? "red" : null;
                if (tint === null) {
                  return {
                    background: "var(--color-paper-2)",
                    color: "var(--color-ink-2)",
                    boxShadow: "inset 0 0 0 1.5px var(--color-line)",
                  };
                }
                return {
                  background: `var(--color-tint-${tint})`,
                  color: `var(--color-t-${tint})`,
                  boxShadow: `inset 0 0 0 1.5px var(--color-t-${tint})`,
                };
              })()}
            >
              ★ {liveScore} pts · {liveCorrect} / {liveTotal}
            </span>
            {/* Per-correct confetti sprinkle anchored to the score
                chip so each rising edge feels rewarding without
                needing to draw the eye away from the goal canvas. */}
            {partialKey > 0 && (
              <span
                key={partialKey}
                className="pointer-events-none absolute"
                style={{ right: 12, top: 16 }}
              >
                <Confetti intensity="small" />
              </span>
            )}
          </div>
        )}
        <PlayCanvas
          pieces={state.goal}
          complexity={state.round.complexity}
          showCoords={showCoords}
          correctness={state.goal_correctness ?? undefined}
        />
      </div>
      <p
        className="t-mono max-w-[520px] text-center text-[12px] text-[var(--color-ink-3)]"
        style={{ lineHeight: 1.5 }}
      >
        Talk through the picture on your call. Your builder is rebuilding it
        without seeing this.
      </p>

      </div>
      <aside
        className="relative flex flex-shrink-0 flex-col items-end gap-3 pt-4"
        style={{ width: 320, zIndex: 30 }}
      >
        {state.brief && state.brief.role === "guider" && (
          // Remount on title change so super-power brief swaps reset
          // the envelope's internal view to sealed; otherwise the gate
          // re-arms but the envelope is stuck in `open` state and the
          // player has no sealed button to tap to dismiss the gate.
          <BriefEnvelope
            key={state.brief.title}
            role="guider"
            title={state.brief.title}
            rules={state.brief.rules}
            onOpen={() => setBriefOpened(true)}
            onClose={onBriefClose}
            emphasize={!briefOpened}
          />
        )}
        {state.partner_brief && (
          <BriefEnvelope
            role={state.partner_brief.role}
            title={state.partner_brief.title}
            rules={state.partner_brief.rules}
            defaultOpen
            revealedPartner
          />
        )}
        {/* The Agile-share BuilderSnapshotPanel was removed
            2026-04-28 after playtest feedback: a tiny thumbnail of
            the builder's current canvas competed with the goal
            canvas's own correctness overlay (✓ green pulses on
            satisfied goal positions) and read as confusing duplicate
            state. The data still flows on the wire (state.builder_
            snapshot) for future use, but the guider's mid-round
            collaboration signal is now the goal correctness overlay
            + the score chip, not a miniature canvas mirror. */}
      </aside>

      {!briefOpened && <BriefGate role="guider" />}
      {showNameNudge && state.pair && (
        <PairNameModal
          code={state.code}
          pairId={state.pair.id}
          onClose={dismissNameNudge}
        />
      )}
      {solvedShown && (
        <SolvedBanner
          pairName={state.pair?.display_name ?? null}
          builderName={state.partner?.display_name ?? null}
          guiderName={state.me.display_name}
          correct={liveCorrect}
          score={liveScore}
          role="guider"
          onDismiss={() => setSolvedShown(false)}
        />
      )}
    </section>
  );
}

function WaitingForRound({ state }: { state: PlayState }) {
  const partnerName = state.partner?.display_name;
  return (
    <section className="m-auto flex max-w-[520px] flex-col items-center gap-5 px-6 text-center">
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        GUIDER · READY
      </div>
      <h1 className="t-display text-3xl">Hop on the call.</h1>
      {partnerName ? (
        <PartnerReadyChip name={partnerName} role="builder" />
      ) : null}
      <p className="text-[15px] text-[var(--color-ink-2)]">
        {partnerName
          ? `${partnerName} will rebuild what you describe. The goal pattern + your hidden brief unlock as soon as the facilitator hits Start.`
          : "Once the facilitator hits Start you'll see the goal pattern — and your builder will be on the call ready to listen to your descriptions."}
      </p>
      <JoinCallCta
        videoCallUrl={state.video_call_url}
        whiteboardUrl={state.whiteboard_url}
      />
    </section>
  );
}

function PartnerReadyChip({
  name,
  role,
}: {
  name: string;
  role: "builder" | "guider";
}) {
  return (
    <div
      className="t-mono flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
      style={{
        background: "var(--color-tint-green)",
        color: "var(--color-t-green)",
        boxShadow: "inset 0 0 0 1.5px var(--color-t-green)",
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: "var(--color-t-green)",
          animation: "tessera-pulse-dot 1400ms ease-in-out infinite",
        }}
      />
      <span>
        {name} <span style={{ opacity: 0.7 }}>· {role} ready</span>
      </span>
      <style>{`
        @keyframes tessera-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
