import { notFound, redirect } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { MasterContent } from "@/components/master/MasterContent";

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
      <MasterContent
        code={code}
        teamMode={game.team_mode}
        initialWorkshopName={game.workshop_name}
        initialRoundCount={game.round_count}
        defaultComplexity={game.default_complexity}
        initialDurationSeconds={game.round_duration_seconds}
      />
    </div>
  );
}
