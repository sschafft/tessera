"use client";

import { useEffect, useRef, useState } from "react";

export interface PairNameBadgeProps {
  code: string;
  pairId: string;
  /** Current display_name from server, null = unnamed. */
  displayName: string | null;
  /** Fallback when displayName is null. */
  defaultName: string;
  /** Called after a successful save so the parent can refetch. */
  onSaved?: () => void;
  /**
   * When true and the pair is unnamed, surface a one-shot fly-out
   * tip pointing at the badge so players notice the rename
   * affordance during a running round. Auto-dismisses after ~9s
   * and remembers dismissal in sessionStorage so it never re-pops
   * for the same pair in the same tab.
   */
  showRenameTip?: boolean;
}

const MAX_LEN = 40;

/**
 * Inline editor for the pair's self-chosen name. Click the badge to
 * rename. Default name (e.g. "Builder ↔ Guider") shows in muted text
 * until the pair commits one. Updates fire PATCH and call back to
 * the parent so the play state refetches.
 */
export function PairNameBadge({
  code,
  pairId,
  displayName,
  defaultName,
  onSaved,
  showRenameTip = false,
}: PairNameBadgeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  // Optimistic value: shown instead of `displayName` from props until
  // the next snapshot refetch echoes the new name back. Without this,
  // the PATCH succeeds but the badge keeps rendering the old name
  // until the realtime broadcast (or the 10s poll) carries the new
  // value through.
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Optimistic GC — drop the local value once props echo it back, OR
  // when the server returns a different name (e.g. another player
  // renamed the pair concurrently; server wins). This is the
  // optimistic-UI-with-server-reconciliation canon from
  // design_patterns.md > "Optimistic UI with server reconciliation":
  // GC by content match, not by request id.
  useEffect(() => {
    if (optimisticName === null) return;
    if (displayName === optimisticName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical optimistic-GC; clears the local override once the server echoes it back.
      setOptimisticName(null);
    }
  }, [displayName, optimisticName]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // One-shot fly-out tip: surfaces only when (a) the parent asked for
  // it (via showRenameTip), (b) the pair is unnamed, (c) we haven't
  // shown it for this pair in this tab. Auto-fades after 9s.
  useEffect(() => {
    if (!showRenameTip) return;
    if (displayName && displayName.length > 0) return;
    if (typeof window === "undefined") return;
    const key = `tessera_rename_tip_seen_${pairId}`;
    if (window.sessionStorage.getItem(key) === "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot tip surface; intentionally lifted into state on mount with a fixed timeout that clears it.
    setTipVisible(true);
    window.sessionStorage.setItem(key, "1");
    const id = window.setTimeout(() => setTipVisible(false), 9000);
    return () => window.clearTimeout(id);
  }, [showRenameTip, displayName, pairId]);

  const enterEdit = () => {
    setDraft(displayName ?? "");
    setEditing(true);
    setTipVisible(false);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const trimmed = draft.trim();
    try {
      const res = await fetch(`/api/games/${code}/pairs/${pairId}/name`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      setOptimisticName(trimmed.length > 0 ? trimmed : null);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "rename failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDraft(displayName ?? "");
    setEditing(false);
    setError(null);
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1"
        style={{ border: "1.5px solid var(--color-ink)" }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_LEN}
          placeholder="The Pelicans…"
          disabled={busy}
          className="text-[12px] font-bold outline-none"
          style={{
            background: "transparent",
            color: "var(--color-ink)",
            border: "none",
            minWidth: 140,
          }}
          aria-label="Pair name"
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        />
        <button
          type="submit"
          disabled={busy}
          className="t-mono text-[10px] font-bold text-[var(--color-t-blue)] disabled:opacity-50"
        >
          {busy ? "…" : "save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="t-mono text-[10px] text-[var(--color-ink-3)]"
        >
          ×
        </button>
        {error && (
          <span className="t-mono text-[10px] text-[var(--color-t-red)]">
            {error}
          </span>
        )}
      </form>
    );
  }

  // Effective name = optimistic if pending, else server prop.
  const effective =
    optimisticName !== null ? optimisticName : displayName;
  const named = effective !== null && effective.length > 0;
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={enterEdit}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors hover:bg-white"
        style={{
          background: named ? "var(--color-paper-2)" : "var(--color-tint-yellow)",
          border: named
            ? "1.5px solid var(--color-line)"
            : "1.5px dashed var(--color-t-yellow)",
        }}
        aria-label={named ? "Rename pair" : "Name this pair"}
      >
        <span
          className="t-mono text-[10px] uppercase tracking-widest"
          style={{
            letterSpacing: ".12em",
            color: named ? "var(--color-ink-3)" : "#7a5b00",
          }}
        >
          {named ? "pair" : "name your pair"}
        </span>
        <span
          className="text-[12px] font-bold"
          style={{ color: named ? "var(--color-ink)" : "#7a5b00" }}
        >
          {named ? effective : defaultName}
        </span>
        <span
          className="t-mono text-[10px]"
          style={{ color: named ? "var(--color-ink-3)" : "#7a5b00" }}
          aria-hidden="true"
        >
          ✎
        </span>
      </button>
      {tipVisible && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-2 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px] shadow-md"
          style={{
            background: "var(--color-ink)",
            color: "#fff",
            maxWidth: 260,
            animation:
              "tessera-tip-in 240ms ease-out both, tessera-tip-out 320ms ease-in 8500ms forwards",
          }}
        >
          <span aria-hidden style={{ marginTop: 2 }}>
            👋
          </span>
          <span style={{ lineHeight: 1.4 }}>
            <b>Name your pair?</b> Tap the badge — funnier on the
            leaderboard than &ldquo;{defaultName}&rdquo;.
          </span>
          <span
            aria-hidden
            className="absolute -top-1.5 left-5 h-3 w-3 rotate-45"
            style={{ background: "var(--color-ink)" }}
          />
          <style>{`
            @keyframes tessera-tip-in {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes tessera-tip-out {
              from { opacity: 1; transform: translateY(0); }
              to { opacity: 0; transform: translateY(-4px); pointer-events: none; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
