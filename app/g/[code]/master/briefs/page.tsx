import { notFound, redirect } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { BriefsView } from "@/components/master/BriefsView";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * GM-only briefs review surface. Lists every pair with the current
 * round's builder + guider briefs side-by-side, plus per-role re-roll
 * buttons wired to /api/games/[code]/briefs/reroll. Pre-game brief
 * overrides (from the CSV upload's `brief_title` / `brief_rules`
 * columns) surface as "Round 1 seed" annotations until consumed.
 */
export default async function MasterBriefsPage({ params }: PageProps) {
  const { code } = await params;
  if (!isValidGameCode(code)) notFound();

  const claims = await readSessionForGame(code);
  if (!claims) redirect(`/?need_host=${code}`);
  if (claims.role !== "gm") redirect(`/g/${code}/play`);

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game || game.id !== claims.game_id) notFound();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--color-paper-2)" }}
    >
      <BriefsView code={code} workshopName={game.workshop_name} />
    </div>
  );
}
