"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { BriefIntroModal, briefIntroSeenKey } from "./BriefIntroModal";
import { Confetti } from "./Confetti";
import { JoinCallCta } from "./JoinCallCta";
import { PairNameBadge } from "./PairNameBadge";
import { SolvedBanner } from "./SolvedBanner";
import { ProgressBar } from "./builder/ProgressBar";
import { canvasSizeFor } from "@/lib/grid/coords";
import { playSolved } from "@/lib/sound";
import type { PlayState } from "./PlayContent";

export interface GuiderViewProps {
  state: PlayState;
}

export function GuiderView({ state }: GuiderViewProps) {

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

      setSolvedShown(true);
      if (state.sound_on) playSolved();
    }
  }, [liveCorrect, liveTotal, state.round?.id, state.sound_on]);

  // Brief intro overlay — frames *why* the brief sidebar exists the
  // first time a guider lands here. Persists per (game, role) so the
  // explainer doesn't re-fire on round 2/3.
  const [briefIntroOpen, setBriefIntroOpen] = useState(false);
  useEffect(() => {
    if (!state.brief || state.brief.role !== "guider") return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(briefIntroSeenKey(state.code, "guider"))) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage read is client-only and runs once per (game, role); SSR can't seed this.
    setBriefIntroOpen(true);
  }, [state.brief, state.code]);
  const dismissBriefIntro = useCallback(() => {
    setBriefIntroOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        briefIntroSeenKey(state.code, "guider"),
        "1",
      );
    }
  }, [state.code]);

  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound state={state} />;
  }
  const showCoords = (state.round.complexity ?? 5) <= 4;
  const partnerName = state.partner?.display_name ?? "builder";
  const defaultPairName = `${state.me.display_name} ↔ ${partnerName}`;
  // Only render the brief aside (320px right rail) when there's
  // actually a brief to show. Without this, an empty aside reserves
  // its width and pushes the canvas off-centre.
  const hasAside = Boolean(
    (state.brief && state.brief.role === "guider") || state.partner_brief,
  );
  return (
    <section className="relative flex w-full flex-1 flex-col gap-4 p-6 min-[1180px]:flex-row">
      {state.pair && (
        <div className="absolute left-6 top-6 z-30">
          <PairNameBadge
            code={state.code}
            pairId={state.pair.id}
            displayName={state.pair.display_name}
            defaultName={defaultPairName}
            showRenameTip
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
        <PlayCanvas
          pieces={state.goal}
          complexity={state.round.complexity}
          showCoords={showCoords}
          correctness={state.goal_correctness ?? undefined}
        />
        {/* Per-correct confetti sprinkle when test scoring is on —
            keyed off the live_score correct count rather than a
            stacked chip on top of the canvas (the chip used to
            overlap the goal stamp and clip on narrow viewports).
            Anchored to the top-right of the canvas so each
            increment still feels like a gentle reward without
            stealing focus. */}
        {state.live_score && partialKey > 0 && (
          <span
            key={partialKey}
            className="pointer-events-none absolute right-2 top-2"
            aria-hidden="true"
          >
            <Confetti intensity="small" />
          </span>
        )}
      </div>
      {/* Width-matched score bar BELOW the canvas (mirrors the
          builder's 2026-06-09 layout). Before this, the score +
          placement chip floated absolute over the top-right corner
          of the canvas and got clipped on narrow viewports;
          dropping it under the board removes the clip and keeps the
          goal pattern itself centre-stage. */}
      <div style={{ width: canvasSizeFor(state.round.complexity).width }}>
        {state.live_score ? (
          <ProgressBar
            correct={liveCorrect}
            wrong={state.live_score.wrong ?? 0}
            placedNeutral={Math.max(
              0,
              state.builder_placements_count -
                liveCorrect -
                (state.live_score.wrong ?? 0),
            )}
            total={liveTotal > 0 ? liveTotal : state.goal_count}
          />
        ) : (
          // Pre-Test bar surfaces the "your builder is placing"
          // pulse without leaking correctness. Same component shape
          // as the live_score case, just with correct/wrong forced
          // to 0 so the entire fill is the neutral "placed but not
          // evaluated" segment surfaced via the checking pill.
          state.goal_count > 0 && (
            <ProgressBar
              correct={0}
              wrong={0}
              placedNeutral={state.builder_placements_count}
              total={state.goal_count}
            />
          )
        )}
      </div>
      <p
        className="t-mono max-w-[520px] text-center text-[12px] text-[var(--color-ink-3)]"
        style={{ lineHeight: 1.5 }}
      >
        Talk through the picture on your call. Your builder is rebuilding it
        without seeing this.
      </p>

      </div>
      {hasAside && (
      <aside
        className="relative flex flex-shrink-0 flex-col items-stretch gap-3 pt-4 min-[1180px]:w-[320px] min-[1180px]:items-end"
        style={{ zIndex: 30 }}
      >
        {state.brief && state.brief.role === "guider" && (
          <BriefEnvelope
            key={state.brief.title}
            role="guider"
            title={state.brief.title}
            rules={state.brief.rules}
          />
        )}
        {state.partner_brief && (
          <BriefEnvelope
            role={state.partner_brief.role}
            title={state.partner_brief.title}
            rules={state.partner_brief.rules}
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
      {state.brief && state.brief.role === "guider" && (
        <BriefIntroModal
          open={briefIntroOpen}
          role="guider"
          title={state.brief.title}
          rules={state.brief.rules}
          onDismiss={dismissBriefIntro}
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
