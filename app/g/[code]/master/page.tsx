import { notFound, redirect } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { Wordmark } from "@/components/primitives/Wordmark";
import { RoleChip } from "@/components/primitives/RoleChip";
import { MasterDashboard } from "@/components/master/MasterDashboard";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function MasterPage({ params }: PageProps) {
  const { code } = await params;
  if (!isValidGameCode(code)) notFound();

  const claims = await readSessionForGame(code);
  if (!claims) redirect(`/?need_host=${code}`);
  if (claims.role !== "gm") redirect(`/g/${code}/play`);

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) notFound();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--color-paper-2)" }}
    >
      {/* Top bar */}
      <header
        className="flex h-16 flex-shrink-0 items-center justify-between border-b border-[var(--color-line)] bg-white px-7"
      >
        <div className="flex items-center gap-4">
          <Wordmark size={22} />
          <span className="h-5 w-px bg-[var(--color-line)]" />
          <div className="flex flex-col">
            <span className="text-[14px] font-bold">{game.workshop_name}</span>
            <span className="t-mono text-[11px] text-[var(--color-ink-3)]">
              {code} · round 1 of {game.round_count} · complexity{" "}
              {game.default_complexity}
            </span>
          </div>
          <RoleChip role="Game master" />
        </div>
        <div className="flex items-center gap-3">
          <span
            className="t-mono rounded-full bg-[var(--color-paper-2)] px-3.5 py-2 text-[14px] font-bold"
            aria-label="Round timer (placeholder)"
          >
            ⏱ {formatDuration(game.round_duration_seconds)}
          </span>
          <button className="t-btn t-btn--ghost t-btn--sm" disabled>
            Pause round
          </button>
          <button className="t-btn t-btn--primary t-btn--sm" disabled>
            End round
          </button>
        </div>
      </header>

      {/* Three-column body */}
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: "320px 1fr 360px" }}
      >
        {/* Left: lobby + pairs */}
        <aside className="flex flex-col border-r border-[var(--color-line)] bg-white">
          <MasterDashboard code={code} teamMode={game.team_mode} />
        </aside>

        {/* Center: focused-pair detail (placeholder) */}
        <main
          className="flex flex-col gap-4 overflow-y-auto p-6"
          style={{ background: "var(--color-paper-2)" }}
        >
          <FocusedPairPlaceholder />
        </main>

        {/* Right: accelerants (placeholder) */}
        <aside className="flex flex-col border-l border-[var(--color-line)] bg-white">
          <AccelerantsPlaceholder />
        </aside>
      </div>
    </div>
  );
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function FocusedPairPlaceholder() {
  return (
    <div
      className="t-card flex flex-col items-center justify-center gap-3 px-8 py-16 text-center"
    >
      <div className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]">
        FOCUSED PAIR
      </div>
      <h2 className="t-display text-2xl">Waiting for allocations</h2>
      <p className="max-w-md text-[14px] text-[var(--color-ink-2)]">
        Once you pair players up from the lobby on the left, their build canvas
        and goal pattern will preview here. Until then, watch the lobby fill up
        as people join with the game code.
      </p>
    </div>
  );
}

function AccelerantsPlaceholder() {
  return (
    <div className="px-5 py-6">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="grid h-6 w-6 place-items-center rounded-md text-[14px] font-extrabold text-white"
          style={{ background: "var(--color-t-red)" }}
        >
          ⚡
        </span>
        <span className="t-display text-[14px] font-bold">Accelerants</span>
      </div>
      <p className="text-[12px] leading-tight text-[var(--color-ink-3)]">
        Trigger mechanics on a pair (or all pairs) once the round is running.
      </p>
      <p className="mt-4 text-[12px] text-[var(--color-ink-3)]">
        Wires up in milestone 6.
      </p>
    </div>
  );
}
