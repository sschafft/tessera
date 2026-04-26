"use client";

import { Avatar } from "@/components/primitives/Avatar";
import type { LobbyPair, LobbyParticipant } from "./MasterContent";

export interface PairsPanelProps {
  pairs: LobbyPair[];
  participants: LobbyParticipant[];
  focusedPairId: string | null;
  onFocus: (id: string) => void;
}

export function PairsPanel({
  pairs,
  participants,
  focusedPairId,
  onFocus,
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
    </div>
  );
}

function PairRow({
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
  return (
    <button
      type="button"
      onClick={onFocus}
      className="mb-1.5 flex flex-col gap-2 rounded-[12px] p-3 text-left"
      style={{
        border: `1.5px solid ${focused ? "var(--color-ink)" : "transparent"}`,
        background: focused ? "var(--color-paper)" : "transparent",
      }}
      aria-pressed={focused}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {builder && (
            <Avatar name={builder.display_name} color={builder.color} size={26} ring="#fff" />
          )}
          {guider && (
            <span className="-ml-2">
              <Avatar name={guider.display_name} color={guider.color} size={26} ring="#fff" />
            </span>
          )}
          <span className="ml-2 text-[13px] font-bold">
            {builder?.display_name ?? "?"} ↔ {guider?.display_name ?? "?"}
          </span>
        </div>
      </div>
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
    </button>
  );
}
