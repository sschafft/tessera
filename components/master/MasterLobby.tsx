"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import type { TeamMode } from "@/lib/game/repository";
import type { LobbyParticipant, LobbyPair } from "./MasterContent";
import { ShareJoinLink } from "./ShareJoinLink";

export interface MasterLobbyProps {
  code: string;
  teamMode: TeamMode;
  members: LobbyParticipant[];
  cap: number;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  pollError: string | null;
  actionError: string | null;
  busy: boolean;
  pairs: LobbyPair[];
  participants: LobbyParticipant[];
  /** Auto-create N pairs from the lobby (random builder/guider per pair). */
  onAutoPairs: (count: number) => void;
  /** Distribute remaining lobby members across pairs as observers. */
  onAutoObservers: () => void;
  onPair: (builderId: string) => void;
  onObserver: (pairId: string) => void;
}

export function MasterLobby({
  code,
  teamMode,
  members,
  cap,
  selected,
  toggleSelect,
  clearSelection,
  pollError,
  actionError,
  busy,
  pairs,
  participants,
  onAutoPairs,
  onAutoObservers,
  onPair,
  onObserver,
}: MasterLobbyProps) {
  const selectedIds = Array.from(selected).filter((id) =>
    members.some((m) => m.id === id),
  );
  const selectedCount = selectedIds.length;

  const maxPossiblePairs = Math.floor(members.length / 2);
  const [pairCountText, setPairCountText] = useState<string>(
    String(Math.max(1, maxPossiblePairs)),
  );
  useEffect(() => {
    setPairCountText(String(Math.max(1, maxPossiblePairs)));
  }, [maxPossiblePairs]);
  const parsedPairCount = (() => {
    const n = parseInt(pairCountText, 10);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(32, n);
  })();
  const unallocatedCount = members.length;
  const canAutoPair = members.length >= 2 && parsedPairCount > 0;

  return (
    <div className="border-b border-[var(--color-line)] bg-[var(--color-paper)]">
      <ShareJoinLink code={code} />
      <div className="flex items-baseline justify-between border-t border-[var(--color-line)] px-5 pb-2 pt-3.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{
              background: "var(--color-t-orange)",
              boxShadow: "0 0 0 3px var(--color-tint-orange)",
            }}
          />
          <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]">
            Lobby · {members.length} waiting
          </span>
        </div>
        <span className="t-mono text-[11px] text-[var(--color-ink-3)]">
          {selectedCount > 0 ? `${selectedCount} selected` : `cap ${cap}`}
        </span>
      </div>

      {actionError && (
        <p className="px-5 pb-2 text-[11px] text-[var(--color-t-red)]">
          {actionError}
        </p>
      )}
      {pollError && !actionError && (
        <p className="px-5 pb-2 text-[11px] text-[var(--color-ink-3)]">
          {pollError.includes("400") ||
          pollError.includes("401") ||
          pollError.includes("403")
            ? "Reconnecting to the game…"
            : "Couldn't refresh the lobby — retrying."}
        </p>
      )}

      <div className="flex flex-col gap-1 px-3.5 pb-2.5">
        {members.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--color-ink-3)]">
            Drop the link above into your call chat or Slack —
            <br />
            players will appear here as they sign in.
          </p>
        ) : (
          members.map((p) => (
            <LobbyRow
              key={p.id}
              participant={p}
              selected={selected.has(p.id)}
              onToggle={() => toggleSelect(p.id)}
            />
          ))
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-2 px-3 pb-3">
        {selectedCount === 2 && (
          <PairAssignButton
            members={members.filter((m) => selectedIds.includes(m.id))}
            disabled={busy}
            onPair={onPair}
          />
        )}

        {selectedCount === 1 && pairs.length > 0 && (
          <ObserverAssignButton
            pairs={pairs}
            participants={participants}
            disabled={busy}
            onObserver={onObserver}
          />
        )}

        {selectedCount >= 3 && pairs.length > 0 && (
          <ObserverAssignButton
            pairs={pairs}
            participants={participants}
            disabled={busy}
            onObserver={onObserver}
            label={`👁 Add ${selectedCount} observers to pair…`}
          />
        )}

        <div
          className="flex flex-col gap-2 rounded-[12px] bg-[var(--color-paper-2)] p-2.5"
          style={{ border: "1.5px solid var(--color-line)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="t-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-3)]">
              Auto-allocate
            </span>
            <span className="t-mono text-[10px] text-[var(--color-ink-3)]">
              {unallocatedCount} unassigned
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink-2)]">
              <input
                type="number"
                min={1}
                max={32}
                value={pairCountText}
                onChange={(e) => setPairCountText(e.target.value)}
                disabled={busy}
                className="t-mono rounded-md bg-white px-2 py-1 text-[12px] font-bold text-[var(--color-ink)] outline-none disabled:opacity-50"
                style={{
                  border: "1.5px solid var(--color-line)",
                  width: 56,
                  textAlign: "center",
                }}
                aria-label="Number of pairs to auto-create"
              />
              <span style={{ color: "var(--color-ink-3)" }}>pairs</span>
            </label>
            <button
              type="button"
              onClick={() => onAutoPairs(parsedPairCount)}
              disabled={busy || !canAutoPair}
              className="flex-1 rounded-[10px] border-[1.5px] border-[var(--color-ink)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--color-ink)] disabled:opacity-50"
              style={{ boxShadow: "0 2px 0 var(--color-ink)" }}
              title={
                canAutoPair
                  ? `Pair up ${parsedPairCount * 2} players from the lobby (random builder/guider per pair).`
                  : "Need at least 2 players in the lobby."
              }
            >
              ⇄ Create {parsedPairCount || 0} pair
              {parsedPairCount === 1 ? "" : "s"}
            </button>
          </div>
          <button
            type="button"
            onClick={onAutoObservers}
            disabled={busy || pairs.length === 0 || members.length === 0}
            className="rounded-[10px] border-[1.5px] border-[var(--color-line)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--color-ink-2)] disabled:opacity-50"
            title={
              pairs.length === 0
                ? "Create at least one pair first."
                : members.length === 0
                  ? "Nobody left in the lobby."
                  : `Spread ${members.length} unassigned ${members.length === 1 ? "player" : "players"} across ${pairs.length} pair${pairs.length === 1 ? "" : "s"} as observers.`
            }
          >
            👁 Auto-assign {members.length > 0 ? members.length : ""} observer
            {members.length === 1 ? "" : "s"}
          </button>
        </div>

        {selectedCount > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            className="t-mono text-[10px] text-[var(--color-ink-3)] underline"
          >
            clear selection
          </button>
        )}

        <p className="t-mono text-[10px] text-[var(--color-ink-3)]">
          {teamMode === "gm_picks"
            ? "you assign roles"
            : "players choose; you arrange pairs"}
        </p>
      </div>
    </div>
  );
}

function LobbyRow({
  participant,
  selected,
  onToggle,
}: {
  participant: LobbyParticipant;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left"
      style={{
        border: `1.5px solid ${selected ? "var(--color-ink)" : "transparent"}`,
        background: selected ? "#fff" : "transparent",
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-[18px] w-[18px] flex-shrink-0 place-items-center text-[11px] font-bold text-white"
        style={{
          borderRadius: 5,
          border: `1.5px solid ${selected ? "var(--color-ink)" : "var(--color-line-2)"}`,
          background: selected ? "var(--color-ink)" : "#fff",
        }}
      >
        {selected ? "✓" : ""}
      </span>
      <Avatar
        name={participant.display_name}
        color={participant.color}
        size={26}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[var(--color-ink)]">
          {participant.display_name}
        </span>
        <span className="block text-[10px] text-[var(--color-ink-3)]">
          {participant.role === "lobby"
            ? "no role yet"
            : `picked ${participant.role}`}{" "}
          · joined {formatJoinedAt(participant.joined_at)}
        </span>
      </span>
    </button>
  );
}

function PairAssignButton({
  members,
  disabled,
  onPair,
}: {
  members: LobbyParticipant[];
  disabled: boolean;
  onPair: (builderId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (members.length !== 2) return null;
  const [a, b] = members;
  if (!a || !b) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-[10px] border-none bg-[var(--color-ink)] px-3 py-2 text-[13px] font-bold text-[var(--color-paper)] disabled:opacity-50"
        style={{ boxShadow: "0 2px 0 rgba(0,0,0,.15)" }}
      >
        ⇄ Pair selected · assign roles
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--color-line)] bg-white p-2">
      <span className="t-mono text-[10px] uppercase tracking-wide text-[var(--color-ink-3)]">
        Who builds?
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onPair(a.id)}
          className="rounded-[8px] bg-[var(--color-tint-orange)] px-2 py-1.5 text-[12px] font-bold text-[var(--color-t-orange)]"
        >
          {a.display_name}
        </button>
        <button
          type="button"
          onClick={() => onPair(b.id)}
          className="rounded-[8px] bg-[var(--color-tint-orange)] px-2 py-1.5 text-[12px] font-bold text-[var(--color-t-orange)]"
        >
          {b.display_name}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="t-mono text-[10px] text-[var(--color-ink-3)]"
      >
        cancel
      </button>
    </div>
  );
}

function ObserverAssignButton({
  pairs,
  participants,
  disabled,
  onObserver,
  label = "👁 As observer to pair…",
}: {
  pairs: LobbyPair[];
  participants: LobbyParticipant[];
  disabled: boolean;
  onObserver: (pairId: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const byId = new Map(participants.map((p) => [p.id, p]));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-[10px] border-[1.5px] border-[var(--color-line)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--color-ink-2)] disabled:opacity-50"
      >
        {label}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--color-line)] bg-white p-2">
      <span className="t-mono text-[10px] uppercase tracking-wide text-[var(--color-ink-3)]">
        Pick a pair
      </span>
      <div className="flex flex-col gap-1">
        {pairs.map((pair) => {
          const builder = pair.builder_id ? byId.get(pair.builder_id) : null;
          const guider = pair.guider_id ? byId.get(pair.guider_id) : null;
          const label =
            builder && guider
              ? `${builder.display_name} ↔ ${guider.display_name}`
              : "(empty pair)";
          return (
            <button
              key={pair.id}
              type="button"
              onClick={() => onObserver(pair.id)}
              className="rounded-[8px] px-2 py-1.5 text-left text-[12px] font-semibold hover:bg-[var(--color-paper-2)]"
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="t-mono text-[10px] text-[var(--color-ink-3)]"
      >
        cancel
      </button>
    </div>
  );
}

function formatJoinedAt(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
