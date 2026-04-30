"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import type { LobbyPair, LobbyParticipant } from "./MasterContent";

export interface PairsFullscreenModalProps {
  pairs: LobbyPair[];
  participants: LobbyParticipant[];
  /** Pre-round only — shows the swap pills + Swap-all CTA. */
  roundRunning: boolean;
  onSwapRoles?: (pair_id: string) => void;
  onSwapAllRoles?: () => void;
  onClose: () => void;
}

interface Row {
  participant: LobbyParticipant;
  pair: LobbyPair | null;
  /** The OTHER member of the pair (builder ↔ guider) — null for observers + lobby. */
  partner: LobbyParticipant | null;
}

/**
 * Fullscreen view of pair management. Renders a participants table
 * (one row per player) instead of the sidebar's pair-card layout, plus
 * a search input and the bulk Swap-all CTA. Opens when the GM clicks
 * the ⛶ expand button on PairsPanel.
 *
 * The sidebar is still the right surface for *live* round monitoring
 * (compact pair cards with progress bars). This modal is for the
 * setup phase: scanning the roster, finding a specific person to
 * reassign, and bulk-managing roles.
 */
export function PairsFullscreenModal({
  pairs,
  participants,
  roundRunning,
  onSwapRoles,
  onSwapAllRoles,
  onClose,
}: PairsFullscreenModalProps) {
  const [query, setQuery] = useState("");

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const byId = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const pairById = useMemo(
    () => new Map(pairs.map((p) => [p.id, p])),
    [pairs],
  );

  const rows = useMemo<Row[]>(() => {
    return participants.map((p) => {
      if (p.role === "lobby" || !p.pair_id) {
        return { participant: p, pair: null, partner: null };
      }
      const pair = pairById.get(p.pair_id) ?? null;
      let partner: LobbyParticipant | null = null;
      if (pair) {
        if (p.role === "builder" && pair.guider_id) {
          partner = byId.get(pair.guider_id) ?? null;
        } else if (p.role === "guider" && pair.builder_id) {
          partner = byId.get(pair.builder_id) ?? null;
        }
        // Observers: partner stays null; pair is the watched pair.
      }
      return { participant: p, pair, partner };
    });
  }, [participants, pairById, byId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = row.participant.display_name.toLowerCase();
      const team = (row.pair?.display_name ?? "").toLowerCase();
      const partner = (row.partner?.display_name ?? "").toLowerCase();
      return (
        name.includes(q) || team.includes(q) || partner.includes(q)
      );
    });
  }, [rows, query]);

  const fullyPairedCount = pairs.filter(
    (p) => p.builder_id && p.guider_id,
  ).length;
  const canSwapAll =
    !roundRunning && fullyPairedCount > 0 && Boolean(onSwapAllRoles);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pair management"
      className="fixed inset-0 z-50 flex items-stretch justify-center p-6"
      style={{ background: "rgba(31,26,20,0.62)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="t-card flex w-full max-w-[1100px] flex-col gap-4 overflow-hidden p-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]">
              Pair management
            </span>
            <h2 className="t-display text-[24px] leading-tight">
              Roster · {participants.length} {participants.length === 1 ? "player" : "players"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="t-mono rounded-full bg-[var(--color-paper-2)] px-3 py-1.5 text-[12px] font-bold"
            style={{ border: "1.5px solid var(--color-line)" }}
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, team name, or partner…"
            className="t-input flex-1 min-w-[260px]"
            aria-label="Search participants"
          />
          {canSwapAll && (
            <button
              type="button"
              onClick={onSwapAllRoles}
              className="t-mono rounded-full px-3 py-2 text-[12px] font-bold"
              style={{
                background: "var(--color-tint-blue)",
                color: "var(--color-t-blue)",
                border: "1.5px solid var(--color-t-blue)",
              }}
              title={`Swap builder ↔ guider for all ${fullyPairedCount} fully-paired teams. Pre-round only.`}
            >
              ⇄ Swap all pairs
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-[var(--color-line)]">
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Team</Th>
                <Th>Partner / observing</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-[var(--color-ink-3)]"
                  >
                    {query
                      ? `No matches for "${query}".`
                      : "No participants yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <RosterRow
                    key={row.participant.id}
                    row={row}
                    canSwap={
                      !roundRunning &&
                      Boolean(onSwapRoles) &&
                      row.pair !== null &&
                      Boolean(row.pair.builder_id && row.pair.guider_id) &&
                      (row.participant.role === "builder" ||
                        row.participant.role === "guider")
                    }
                    onSwapPair={
                      onSwapRoles && row.pair
                        ? () => onSwapRoles(row.pair!.id)
                        : undefined
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3 text-[11px] text-[var(--color-ink-3)]">
          <span>
            {filtered.length} of {rows.length} shown
            {query ? ` · filtered by "${query}"` : ""}
          </span>
          <span>
            {pairs.length} {pairs.length === 1 ? "pair" : "pairs"} ·{" "}
            {fullyPairedCount} fully paired
          </span>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="t-mono py-2.5 px-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-ink-3)]">
      {children}
    </th>
  );
}

function RosterRow({
  row,
  canSwap,
  onSwapPair,
}: {
  row: Row;
  canSwap: boolean;
  onSwapPair?: () => void;
}) {
  const { participant, pair, partner } = row;
  const roleLabel =
    participant.role === "lobby"
      ? "—"
      : participant.role.charAt(0).toUpperCase() + participant.role.slice(1);
  const teamLabel =
    pair && pair.display_name
      ? pair.display_name
      : pair
        ? `Pair ${pair.id.slice(0, 6)}`
        : "—";
  const partnerLabel =
    participant.role === "observer" && pair
      ? `(observing ${
          pair.builder_id
            ? "builder + guider"
            : "—"
        })`
      : (partner?.display_name ?? "—");
  return (
    <tr className="border-b border-[var(--color-line)] hover:bg-[var(--color-paper-2)]">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Avatar
            name={participant.display_name}
            color={participant.color}
            size={22}
            ring="#fff"
          />
          <span className="font-bold">{participant.display_name}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <span
          className="t-mono inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={
            participant.role === "lobby"
              ? {
                  background: "var(--color-paper-2)",
                  color: "var(--color-ink-3)",
                  border: "1px solid var(--color-line)",
                }
              : participant.role === "observer"
                ? {
                    background: "var(--color-tint-yellow)",
                    color: "#7a5b00",
                  }
                : participant.role === "builder"
                  ? {
                      background: "var(--color-tint-orange)",
                      color: "var(--color-t-orange)",
                    }
                  : {
                      background: "var(--color-tint-blue)",
                      color: "var(--color-t-blue)",
                    }
          }
        >
          {roleLabel}
        </span>
      </td>
      <td className="px-3 py-2 text-[var(--color-ink-2)]">{teamLabel}</td>
      <td className="px-3 py-2 text-[var(--color-ink-2)]">{partnerLabel}</td>
      <td className="px-3 py-2">
        {canSwap && onSwapPair && (
          <button
            type="button"
            onClick={onSwapPair}
            className="t-mono rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:bg-[var(--color-paper-2)]"
            style={{ border: "1.5px solid var(--color-line)" }}
            title="Swap builder ↔ guider for this pair (pre-round only)."
            aria-label={`Swap roles for ${participant.display_name}'s pair`}
          >
            ⇄ swap pair
          </button>
        )}
      </td>
    </tr>
  );
}
