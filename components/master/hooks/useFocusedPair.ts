"use client";

import { useEffect, useState } from "react";
import type { LobbyPair } from "@/lib/game/lobby-response";

export interface FocusedPairState {
  focusedPairId: string | null;
  setFocusedPairId: (id: string | null) => void;
  /** The full pair record for the focused id, or null. */
  focusedPair: LobbyPair | null;
}

/**
 * Owns the GM dashboard's "which pair is the centre column showing"
 * state, plus the sync that auto-picks the first pair when the list
 * arrives and re-picks when the previously-focused pair disappears
 * (e.g. after a Shuffle). Extracted from MasterContent in v1.2 so the
 * derived `focusedPair` lookup lives next to the state that drives it.
 */
export function useFocusedPair(pairs: LobbyPair[]): FocusedPairState {
  const [focusedPairId, setFocusedPairId] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- focused-pair is derived from a network-fetched array; auto-selecting / re-selecting on list change is the canonical use of an effect here. */
  useEffect(() => {
    if (!focusedPairId && pairs.length > 0) {
      setFocusedPairId(pairs[0]!.id);
    } else if (focusedPairId && !pairs.some((p) => p.id === focusedPairId)) {
      setFocusedPairId(pairs[0]?.id ?? null);
    }
  }, [pairs, focusedPairId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const focusedPair = pairs.find((p) => p.id === focusedPairId) ?? null;

  return { focusedPairId, setFocusedPairId, focusedPair };
}
