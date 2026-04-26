"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import type { TileColor } from "@/components/canvas/Tile";
import type { TeamMode } from "@/lib/game/repository";

interface LobbyParticipant {
  id: string;
  display_name: string;
  role: "lobby" | "builder" | "guider" | "observer" | "gm";
  pair_id: string | null;
  color: TileColor;
  joined_at: string;
}

interface LobbyResponse {
  code: string;
  workshop_name: string;
  team_mode: TeamMode;
  participant_cap: number;
  participants: LobbyParticipant[];
}

const POLL_MS = 2000;

export interface MasterLobbyProps {
  code: string;
  teamMode: TeamMode;
}

export function MasterLobby({ code, teamMode }: MasterLobbyProps) {
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/games/${code}/lobby`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json: LobbyResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "fetch failed");
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code]);

  // The GM is in the participant list as role='gm'; show only humans
  // waiting for allocation in the lobby panel.
  const lobbyPeople = (data?.participants ?? []).filter((p) => p.role !== "gm");
  const totalSeats = data?.participant_cap ?? 0;

  return (
    <div className="border-b border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
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
            Lobby · {lobbyPeople.length} waiting
          </span>
        </div>
        <span className="t-mono text-[11px] text-[var(--color-ink-3)]">
          cap {totalSeats}
        </span>
      </div>

      {error && (
        <p className="px-5 pb-2 text-[11px] text-[var(--color-t-red)]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1 px-3.5 pb-2.5">
        {lobbyPeople.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--color-ink-3)]">
            Share <span className="t-mono font-bold">{code}</span> with players
            to join.
            <br />
            They&apos;ll appear here as they sign in.
          </p>
        ) : (
          lobbyPeople.map((p) => <LobbyRow key={p.id} participant={p} />)
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3">
        <button
          className="rounded-[10px] border-[1.5px] border-[var(--color-ink)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--color-ink)] disabled:opacity-50"
          style={{ boxShadow: "0 2px 0 var(--color-ink)" }}
          disabled
        >
          🎲 Auto-allocate all
        </button>
        <p className="t-mono text-[10px] text-[var(--color-ink-3)]">
          {teamMode === "gm_picks"
            ? "you'll assign roles · auto-allocate lands next"
            : "players choose their own roles · you arrange pairs"}
        </p>
      </div>
    </div>
  );
}

function LobbyRow({ participant }: { participant: LobbyParticipant }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5">
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
          {participant.role === "lobby" ? "unallocated" : participant.role} ·{" "}
          {formatJoinedAt(participant.joined_at)}
        </span>
      </span>
    </div>
  );
}

function formatJoinedAt(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
