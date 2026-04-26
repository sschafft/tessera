import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import { BriefEnvelope } from "./BriefEnvelope";
import { JoinCallCta } from "./JoinCallCta";
import type { PlayState } from "./PlayContent";

export interface GuiderViewProps {
  state: PlayState;
}

export function GuiderView({ state }: GuiderViewProps) {
  if (!state.round || state.round.status !== "running" || !state.goal) {
    return <WaitingForRound state={state} />;
  }
  const showCoords = (state.round.complexity ?? 5) <= 4;
  return (
    <section className="relative mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="absolute right-6 top-6 z-10 flex flex-col gap-3">
        {state.brief && state.brief.role === "guider" && (
          <BriefEnvelope
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
        <PlayCanvas pieces={state.goal} showCoords={showCoords} />
      </div>
      <p
        className="t-mono max-w-[520px] text-center text-[12px] text-[var(--color-ink-3)]"
        style={{ lineHeight: 1.5 }}
      >
        Talk through the picture on your call. Your builder is rebuilding it
        without seeing this.
      </p>

      {state.builder_snapshot && state.builder_snapshot.length > 0 && (
        <div className="absolute bottom-6 right-6 z-10 w-[300px]">
          <div className="t-card flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
                Builder shared progress
              </span>
              <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
                preview · {state.builder_snapshot.length} placed
              </span>
            </div>
            <div
              className="overflow-hidden rounded-[10px]"
              style={{ transform: "scale(0.4)", transformOrigin: "top left", height: 200, marginBottom: -200 }}
            >
              <PlayCanvas pieces={state.builder_snapshot} showCoords={showCoords} />
            </div>
          </div>
        </div>
      )}
    </section>
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
