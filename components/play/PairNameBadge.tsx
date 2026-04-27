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
}: PairNameBadgeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(displayName ?? "");
  }, [displayName]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${code}/pairs/${pairId}/name`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: draft }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
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

  const named = displayName !== null && displayName.length > 0;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
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
        {named ? displayName : defaultName}
      </span>
      <span
        className="t-mono text-[10px]"
        style={{ color: named ? "var(--color-ink-3)" : "#7a5b00" }}
        aria-hidden="true"
      >
        ✎
      </span>
    </button>
  );
}
