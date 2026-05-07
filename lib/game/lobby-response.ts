/**
 * Shared shape of `GET /api/games/[code]/lobby`. Imported by both the
 * server route handler (when constructing the response body) and the
 * client `MasterContent` component (when consuming it). Single source
 * of truth — one definition, no drift.
 */

import type { BriefSource, TeamMode } from "./repository";
import type { TileColor } from "@/components/canvas/Tile";

export interface LobbyParticipant {
  id: string;
  display_name: string;
  role: "lobby" | "builder" | "guider" | "observer" | "gm";
  pair_id: string | null;
  color: TileColor;
  joined_at: string;
}

export interface LobbyPair {
  id: string;
  builder_id: string | null;
  guider_id: string | null;
  created_at: string;
  /** Self-chosen team name; null until the pair commits one. */
  display_name: string | null;
  /** Per-pair breakout call URL. Null until the GM mints one. */
  breakout_call_url?: string | null;
  briefs: {
    builder: { title: string; rules: string[] } | null;
    guider: { title: string; rules: string[] } | null;
  };
  /**
   * Per-pair brief overrides set at game-create (typically via CSV
   * upload). Surfaced to the GM dashboard so the BriefsView can
   * show "Round 1 will use this seeded brief" annotations alongside
   * the current-round briefs. Cleared by `roundStart` after the
   * round-1 commit so this is null on round 2+.
   */
  brief_overrides: {
    builder: { title: string; rules: string[] } | null;
    guider: { title: string; rules: string[] } | null;
  };
  /**
   * Live per-pair progress. Null when no round is running. Populated
   * by the lobby route when a round is active so the PairsPanel can
   * render a "✓ complete" overlay or "% correct" chip per row.
   */
  progress: {
    correct: number;
    total: number;
    placed: number;
    percent: number;
    complete: boolean;
    score: number;
  } | null;
}

export interface LobbyRound {
  id: string;
  index: number;
  complexity: number;
  duration_seconds: number;
  status: "pending" | "running" | "ended";
  started_at: string | null;
  ended_at: string | null;
}

export interface SuperPowerEvent {
  kind: string;
  scope: "pair" | "all";
  pair_id: string | null;
  triggered_at: string;
}

export interface LobbyResponse {
  code: string;
  game_id: string;
  workshop_name: string;
  team_mode: TeamMode;
  participant_cap: number;
  status: "lobby" | "running" | "ended" | "purged";
  round_count: number;
  scoring: {
    correct_pts: number;
    wrong_pts: number;
  };
  briefs_enabled: {
    builder: boolean;
    guider: boolean;
  };
  meeting_mode: "remote" | "in_person";
  breakouts: {
    provider: "none" | "google_meet" | "jitsi";
    configured: boolean;
    google_connected: boolean;
  };
  participants: LobbyParticipant[];
  pairs: LobbyPair[];
  round: LobbyRound | null;
  superpower_events: SuperPowerEvent[];
}

/**
 * `BriefSource` is re-exported so consumers that want it can pull from
 * the same shared module rather than reaching into `lib/game/repository`.
 */
export type { BriefSource };
