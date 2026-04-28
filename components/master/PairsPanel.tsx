"use client";

import { useState } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import type { LobbyPair, LobbyParticipant } from "./MasterContent";

export interface PairsPanelProps {
  pairs: LobbyPair[];
  participants: LobbyParticipant[];
  focusedPairId: string | null;
  onFocus: (id: string) => void;
  /** Optional breakouts strip — shows mid-round Generate / Clear when
   * the game uses jitsi or google_meet. Hidden when provider='none'. */
  breakouts?: {
    provider: "none" | "google_meet" | "jitsi";
    googleConnected: boolean;
    busy: boolean;
    onGenerate: () => void;
    onClear: () => void;
  };
}

export function PairsPanel({
  pairs,
  participants,
  focusedPairId,
  onFocus,
  breakouts,
}: PairsPanelProps) {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const observersByPair = new Map<string, LobbyParticipant[]>();
  for (const p of participants) {
    if (p.role !== "observer" || !p.pair_id) continue;
    const list = observersByPair.get(p.pair_id) ?? [];
    list.push(p);
    observersByPair.set(p.pair_id, list);
  }

  const observerCount = participants.filter(
    (p) => p.role === "observer",
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline justify-between border-t border-[var(--color-line)] px-5 pt-3.5 pb-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Pairs · {pairs.length}
        </span>
        <span className="t-mono text-[11px] text-[var(--color-ink-3)]">
          {observerCount > 0 ? `+${observerCount} observer${observerCount === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
        {pairs.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-[var(--color-ink-3)]">
            No pairs yet. Pick two players above and click <b>Pair selected</b>,
            or <b>🎲 Auto-allocate</b> to do it for you.
          </p>
        ) : (
          pairs.map((pair) => (
            <PairRow
              key={pair.id}
              pair={pair}
              builder={pair.builder_id ? byId.get(pair.builder_id) : undefined}
              guider={pair.guider_id ? byId.get(pair.guider_id) : undefined}
              observers={observersByPair.get(pair.id) ?? []}
              focused={focusedPairId === pair.id}
              onFocus={() => onFocus(pair.id)}
            />
          ))
        )}
      </div>
      {breakouts && breakouts.provider !== "none" && pairs.length > 0 && (
        <BreakoutsStrip
          provider={breakouts.provider}
          googleConnected={breakouts.googleConnected}
          busy={breakouts.busy}
          missingCount={pairs.filter((p) => !p.breakout_call_url).length}
          mintedCount={pairs.filter((p) => p.breakout_call_url).length}
          onGenerate={breakouts.onGenerate}
          onClear={breakouts.onClear}
        />
      )}
    </div>
  );
}

function BreakoutsStrip({
  provider,
  googleConnected,
  busy,
  missingCount,
  mintedCount,
  onGenerate,
  onClear,
}: {
  provider: "google_meet" | "jitsi";
  googleConnected: boolean;
  busy: boolean;
  missingCount: number;
  mintedCount: number;
  onGenerate: () => void;
  onClear: () => void;
}) {
  const canGenerate =
    missingCount > 0 && (provider === "jitsi" || googleConnected);
  return (
    <div className="border-t border-[var(--color-line)] px-5 py-3">
      <div className="flex items-baseline justify-between pb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
          Pair calls · {provider === "jitsi" ? "Jitsi" : "Google Meet"}
        </span>
        <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
          {mintedCount} of {mintedCount + missingCount} ready
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {canGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy}
            className="t-mono rounded-full px-2.5 py-1 text-[11px] font-bold disabled:opacity-50"
            style={{
              background: "var(--color-tint-blue)",
              color: "var(--color-t-blue)",
              border: "1.5px solid var(--color-t-blue)",
            }}
            title={`Mint ${missingCount} pair-call link${missingCount === 1 ? "" : "s"}`}
          >
            ↻ Generate {missingCount === 1 ? "the" : `${missingCount}`} missing
          </button>
        )}
        {mintedCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="t-mono rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--color-ink-2)] disabled:opacity-50"
            style={{ border: "1.5px solid var(--color-line)" }}
            title={
              provider === "jitsi"
                ? "Drop the per-pair links. Jitsi rooms are stateless."
                : "Delete every breakout calendar event and clear the per-pair links."
            }
          >
            Clear all
          </button>
        )}
        {provider === "google_meet" && !googleConnected && (
          <span
            className="t-mono inline-flex items-center px-1 text-[10px] text-[var(--color-ink-3)]"
            title="Sign in with Google from the Step 4 panel pre-round."
          >
            (Google not connected)
          </span>
        )}
      </div>
    </div>
  );
}

function ProgressBar({
  percent,
  complete,
}: {
  percent: number;
  complete: boolean;
}) {
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--color-paper-2)" }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width]"
        style={{
          width: `${Math.max(0, Math.min(100, percent))}%`,
          background: complete
            ? "var(--color-t-green)"
            : "var(--color-t-blue)",
        }}
      />
    </div>
  );
}

function PairRow({
  pair,
  builder,
  guider,
  observers,
  focused,
  onFocus,
}: {
  pair: LobbyPair;
  builder?: LobbyParticipant;
  guider?: LobbyParticipant;
  observers: LobbyParticipant[];
  focused: boolean;
  onFocus: () => void;
}) {
  const progress = pair.progress;
  const isComplete = progress?.complete === true;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFocus();
        }
      }}
      className="mb-1.5 flex cursor-pointer flex-col gap-2 rounded-[12px] p-3 text-left"
      style={{
        border: `1.5px solid ${
          isComplete
            ? "var(--color-t-green)"
            : focused
              ? "var(--color-ink)"
              : "transparent"
        }`,
        background: isComplete
          ? "var(--color-tint-green)"
          : focused
            ? "var(--color-paper)"
            : "transparent",
        boxShadow: isComplete
          ? "inset 0 0 0 1px var(--color-t-green)"
          : "none",
      }}
      aria-pressed={focused}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {builder && (
            <Avatar name={builder.display_name} color={builder.color} size={26} ring="#fff" />
          )}
          {guider && (
            <span className="-ml-2">
              <Avatar name={guider.display_name} color={guider.color} size={26} ring="#fff" />
            </span>
          )}
          <span className="ml-2 truncate text-[13px] font-bold">
            {builder?.display_name ?? "?"} ↔ {guider?.display_name ?? "?"}
          </span>
        </div>
        {progress && progress.total > 0 && (
          <span
            className="t-mono flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={
              isComplete
                ? {
                    background: "var(--color-t-green)",
                    color: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,.10)",
                  }
                : {
                    background: "var(--color-paper-2)",
                    color: "var(--color-ink-2)",
                    boxShadow: "inset 0 0 0 1px var(--color-line)",
                  }
            }
            aria-label={`${progress.correct} of ${progress.total} pieces correct${isComplete ? " — complete" : ""}`}
          >
            {isComplete
              ? "✓ DONE"
              : `${progress.percent}%`}
          </span>
        )}
      </div>
      {progress && progress.total > 0 && (
        <ProgressBar
          percent={progress.percent}
          complete={isComplete}
        />
      )}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--color-ink-3)]">
          builder · {builder?.display_name ?? "—"}
        </span>
        <span className="text-[var(--color-ink-3)]">
          guider · {guider?.display_name ?? "—"}
        </span>
      </div>
      {observers.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-[var(--color-line)] pt-2">
          <span className="t-mono text-[10px] uppercase text-[var(--color-ink-3)]">
            obs
          </span>
          <div className="flex flex-wrap gap-1">
            {observers.map((o) => (
              <span
                key={o.id}
                className="t-mono inline-flex items-center gap-1 rounded-full bg-[var(--color-paper-2)] px-2 py-0.5 text-[10px]"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: `var(--color-t-${o.color})` }}
                />
                {o.display_name}
              </span>
            ))}
          </div>
        </div>
      )}
      {pair.breakout_call_url && (
        <PairCallLine url={pair.breakout_call_url} />
      )}
    </div>
  );
}

function PairCallLine({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "pair call";
    }
  })();
  return (
    <div
      className="flex items-center gap-1.5 border-t border-[var(--color-line)] pt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="t-mono text-[10px] uppercase text-[var(--color-ink-3)]">
        call
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="t-mono flex-1 truncate text-[11px] underline"
        style={{ color: "var(--color-t-blue)" }}
        title={url}
      >
        {host}
      </a>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
        className="t-mono rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{
          background: copied ? "var(--color-t-green)" : "var(--color-paper-2)",
          color: copied ? "#fff" : "var(--color-ink-2)",
          border: "1px solid var(--color-line)",
        }}
        aria-label="Copy pair call link"
      >
        {copied ? "✓" : "copy"}
      </button>
    </div>
  );
}
