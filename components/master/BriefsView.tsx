"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Wordmark } from "@/components/primitives/Wordmark";
import type { LobbyResponse } from "@/lib/game/lobby-response";

export interface BriefsViewProps {
  code: string;
  workshopName: string;
}

/**
 * GM-side briefs review. Polls the lobby snapshot, renders one card
 * per pair with the current round's builder + guider briefs, and
 * exposes a re-roll button per role wired to the existing
 * `/api/games/[code]/briefs/reroll` endpoint.
 *
 * Re-roll respects the `brief_source` configured at game-create:
 *   - library → re-pulls a different curated brief
 *   - gemini  → re-runs the AI router
 *   - gm      → no-op (custom briefs are pinned, not random)
 *
 * The "Round 1 seed" annotation appears for any pair that still has
 * a CSV-uploaded brief override sitting on the row. Once round 1
 * runs and consumes the override, the annotation disappears.
 */
export function BriefsView({ code, workshopName }: BriefsViewProps) {
  const [data, setData] = useState<LobbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}/lobby`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      const j = (await res.json()) as LobbyResponse;
      setData(j);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    }
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot snapshot fetch on mount; fetchSnapshot owns the setState path internally.
    void fetchSnapshot();
  }, [fetchSnapshot]);

  const reroll = useCallback(
    async (pairId: string, role: "builder" | "guider") => {
      const key = `${pairId}:${role}`;
      setBusyKey(key);
      setError(null);
      try {
        const res = await fetch(`/api/games/${code}/briefs/reroll`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pair_id: pairId, role }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `status ${res.status}`);
        }
        await fetchSnapshot();
      } catch (err) {
        setError(err instanceof Error ? err.message : "re-roll failed");
      } finally {
        setBusyKey(null);
      }
    },
    [code, fetchSnapshot],
  );

  const round = data?.round ?? null;
  const pairs = data?.pairs ?? [];
  const participants = data?.participants ?? [];
  const participantById = new Map(participants.map((p) => [p.id, p]));

  return (
    <>
      <header
        className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-white px-6 py-3"
      >
        <div className="flex items-center gap-4">
          <Wordmark size={20} />
          <span className="h-5 w-px bg-[var(--color-line)]" />
          <span className="t-mono text-[12px] text-[var(--color-ink-3)]">
            game · {code}
          </span>
          <span
            className="t-mono rounded-full bg-[var(--color-paper-2)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-2)]"
          >
            briefs
          </span>
        </div>
        <Link
          href={`/g/${code}/master`}
          className="t-mono text-[12px] underline text-[var(--color-ink-2)]"
        >
          ← back to dashboard
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="t-display text-[26px] font-bold">
            Briefs by pair
          </h1>
          <p className="text-[13px] text-[var(--color-ink-2)]">
            Workshop: <b>{workshopName}</b>
            {round
              ? ` · round ${round.index} (${round.status})`
              : " · no round yet"}
          </p>
          <p className="text-[12px] text-[var(--color-ink-3)]">
            Re-roll picks a new brief from the same source the game
            was created with (library / AI / GM-custom). For custom
            briefs the re-roll is a no-op.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="t-mono text-[12px]"
            style={{ color: "var(--color-t-red)" }}
          >
            {error}
          </div>
        )}

        {pairs.length === 0 ? (
          <div className="t-card flex flex-col gap-1 p-5 text-center">
            <p className="text-[13px] text-[var(--color-ink-2)]">
              No pairs allocated yet.
            </p>
            <p className="text-[11px] text-[var(--color-ink-3)]">
              Pair players from the dashboard, then this view will
              show their briefs.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pairs.map((p) => {
              const builderName =
                (p.builder_id && participantById.get(p.builder_id)?.display_name) ||
                "builder";
              const guiderName =
                (p.guider_id && participantById.get(p.guider_id)?.display_name) ||
                "guider";
              const builderOverride = p.brief_overrides?.builder ?? null;
              const guiderOverride = p.brief_overrides?.guider ?? null;
              return (
                <li key={p.id} className="t-card flex flex-col gap-3 p-4">
                  <div className="flex items-baseline justify-between">
                    <h2 className="t-display text-[18px] font-bold">
                      {p.display_name ?? `${builderName} ↔ ${guiderName}`}
                    </h2>
                    <span className="t-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                      pair · {p.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <BriefCell
                      role="builder"
                      personName={builderName}
                      brief={p.briefs.builder}
                      override={builderOverride}
                      busy={busyKey === `${p.id}:builder`}
                      onReroll={() => reroll(p.id, "builder")}
                    />
                    <BriefCell
                      role="guider"
                      personName={guiderName}
                      brief={p.briefs.guider}
                      override={guiderOverride}
                      busy={busyKey === `${p.id}:guider`}
                      onReroll={() => reroll(p.id, "guider")}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

interface BriefCellProps {
  role: "builder" | "guider";
  personName: string;
  brief: { title: string; rules: string[] } | null;
  override: { title: string; rules: string[] } | null;
  busy: boolean;
  onReroll: () => void;
}

function BriefCell({
  role,
  personName,
  brief,
  override,
  busy,
  onReroll,
}: BriefCellProps) {
  const tint = role === "builder" ? "orange" : "blue";
  // When a current-round brief exists, that's the source of truth.
  // Override only matters when round 1 hasn't run yet — surface it
  // as the round-1 seed in that case.
  const showOverrideAsSeed = override && !brief;
  const surfaced = brief ?? override;
  return (
    <div
      className="flex flex-col gap-2 rounded-[12px] px-3.5 py-3"
      style={{
        background: `var(--color-tint-${tint})`,
        border: `1.5px solid var(--color-t-${tint})`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="t-mono text-[10px] font-bold uppercase tracking-widest"
          style={{ color: `var(--color-t-${tint})`, letterSpacing: ".12em" }}
        >
          ● {role.toUpperCase()} · {personName}
        </span>
        {showOverrideAsSeed && (
          <span
            className="t-mono rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ color: "var(--color-ink-2)" }}
            title="Pre-game brief from the CSV upload — used at round 1."
          >
            round 1 seed
          </span>
        )}
      </div>
      {surfaced ? (
        <>
          <div
            className="t-display text-[15px] font-bold leading-tight"
            style={{ color: "var(--color-ink)" }}
          >
            {surfaced.title}
          </div>
          <ul
            className="m-0 flex list-none flex-col gap-1 p-0 text-[12px]"
            style={{ color: "var(--color-ink-2)", lineHeight: 1.4 }}
          >
            {surfaced.rules.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[12px] text-[var(--color-ink-3)]">
          No brief yet (round hasn&apos;t started, or this side has briefs off).
        </p>
      )}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onReroll}
          disabled={busy || (!brief && !override)}
          className="t-mono rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          style={{
            color: `var(--color-t-${tint})`,
            border: `1.5px solid var(--color-t-${tint})`,
          }}
          title={
            !brief && !override
              ? "No brief to re-roll yet."
              : "Pull a new brief from the configured source."
          }
        >
          {busy ? "Rolling…" : "↻ Re-roll"}
        </button>
      </div>
    </div>
  );
}
