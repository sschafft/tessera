"use client";

import { useEffect, useState } from "react";

const ADJECTIVES = [
  "Wild",
  "Sleepy",
  "Curious",
  "Cosmic",
  "Velvet",
  "Rusty",
  "Lazy",
  "Iron",
  "Stardust",
  "Saffron",
  "Marbled",
  "Howling",
  "Quiet",
  "Restless",
];

const NOUNS = [
  "Otters",
  "Pelicans",
  "Foxes",
  "Beavers",
  "Owls",
  "Llamas",
  "Hippos",
  "Sparrows",
  "Hummingbirds",
  "Frogs",
  "Sloths",
  "Dragons",
  "Mariners",
  "Cartographers",
];

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  return `The ${a} ${n}`;
}

export interface PairNameModalProps {
  code: string;
  pairId: string;
  /** Called after save or skip. */
  onClose: () => void;
  /**
   * Initial value for the input. When omitted, a fresh random name is
   * suggested (one-shot first-naming). When provided (e.g. opening
   * from the badge to rename), the current name pre-fills so the
   * player edits in place — they can still hit 🎲 again to re-roll.
   */
  initialName?: string;
  /** Called once the new name lands so the parent can refetch. */
  onSaved?: () => void;
}

/**
 * Modal for naming (or renaming) a pair. Either pre-fills with a
 * random "The Adjective Noun" suggestion (first-naming) or with the
 * current pair name (rename); 🎲 again re-rolls the suggestion in
 * either case. Skipping is a first-class choice — the inline
 * PairNameBadge stays available either way.
 */
export function PairNameModal({
  code,
  pairId,
  onClose,
  initialName,
  onSaved,
}: PairNameModalProps) {
  const [name, setName] = useState<string>(
    () => initialName ?? randomName(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a name or skip.");
      return;
    }
    setBusy(true);
    setError(null);
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
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "rename failed");
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Name your pair"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "rgba(31,26,20,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="t-card flex w-full max-w-[440px] flex-col gap-4 p-6"
        style={{ background: "#fff" }}
      >
        <div className="flex flex-col gap-1">
          <span className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]">
            Name your pair
          </span>
          <h2 className="t-display text-[22px] leading-tight">
            What should we call you two?
          </h2>
          <p className="text-[13px] text-[var(--color-ink-2)]">
            A team name shows up on the leaderboard, in debrief, and in
            anything the GM shares afterwards. Skip if you&apos;d rather not.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="t-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-3)]"
            htmlFor="pair-name-input"
          >
            Pair name
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pair-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              disabled={busy}
              className="t-input flex-1"
              placeholder="The Pelicans…"
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
            />
            <button
              type="button"
              onClick={() => setName(randomName())}
              disabled={busy}
              title="Suggest another"
              className="t-mono rounded-full bg-[var(--color-paper-2)] px-3 py-2 text-[11px] font-bold disabled:opacity-50"
              style={{ border: "1.5px solid var(--color-line)" }}
            >
              🎲 again
            </button>
          </div>
          {error && (
            <p className="t-mono text-[11px] text-[var(--color-t-red)]" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="t-mono text-[12px] text-[var(--color-ink-3)] underline disabled:opacity-50"
          >
            skip for now
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save name →"}
          </button>
        </div>
      </div>
    </div>
  );
}
