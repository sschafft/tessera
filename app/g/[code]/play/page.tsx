import { notFound, redirect } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { readSessionForGame } from "@/lib/auth/session";
import { getRepository } from "@/lib/game/getRepository";
import { Wordmark } from "@/components/primitives/Wordmark";
import { RoleChip } from "@/components/primitives/RoleChip";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * /g/[code]/play — placeholder for milestone 2. The real builder/guider/
 * observer canvases land in milestone 3+. For now we render a role-aware
 * "you're in" screen so the join flow has somewhere to land.
 */
export default async function PlayPage({ params }: PageProps) {
  const { code } = await params;
  if (!isValidGameCode(code)) notFound();

  const claims = await readSessionForGame(code);
  if (!claims) redirect(`/g/${code}/join`);
  if (claims.role === "gm") redirect(`/g/${code}/master`);

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game || game.id !== claims.game_id) notFound();
  const me = await repo.findParticipantById(claims.sub);
  if (!me) redirect(`/g/${code}/join`);

  const headline = headlineFor(claims.role);

  return (
    <div className="relative min-h-screen w-full bg-[var(--color-paper)]">
      <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-white px-7 py-4">
        <div className="flex items-center gap-4">
          <Wordmark size={22} />
          <span className="h-5 w-px bg-[var(--color-line)]" />
          <span className="t-mono text-[12px] text-[var(--color-ink-3)]">
            game · {code}
          </span>
          <RoleChip role={roleLabel(claims.role)} />
        </div>
        <span className="text-[13px] text-[var(--color-ink-2)]">
          Hi, <b>{me.display_name}</b>
        </span>
      </header>

      <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-20 text-center">
        <h1 className="t-display text-3xl">{headline.title}</h1>
        <p
          className="text-[15px] text-[var(--color-ink-2)]"
          style={{ lineHeight: 1.55 }}
        >
          {headline.body}
        </p>
        {game.video_call_url && (
          <a
            href={game.video_call_url}
            target="_blank"
            rel="noopener noreferrer"
            className="t-btn t-btn--ghost mt-4 self-center"
          >
            ▶ Open video call
          </a>
        )}
      </main>
    </div>
  );
}

function roleLabel(role: string) {
  switch (role) {
    case "builder":
      return "Builder";
    case "guider":
      return "Guider";
    case "observer":
      return "Observer";
    default:
      return "Builder";
  }
}

function headlineFor(role: string): { title: string; body: string } {
  switch (role) {
    case "builder":
      return {
        title: "You're a Builder.",
        body: "Hang tight — your canvas + tile tray ship in milestone 3. Once the round starts, you'll drag pieces here while your guider describes the goal over the call.",
      };
    case "guider":
      return {
        title: "You're a Guider.",
        body: "You'll see the goal pattern when the round starts. Until then, hop on the call — your builder will need a partner to describe to.",
      };
    case "observer":
      return {
        title: "You're an Observer.",
        body: "Sit back. When a round runs you'll see both your pair's build and the goal side-by-side.",
      };
    default:
      return {
        title: "You're in the lobby.",
        body: "Your facilitator will assign you a role any moment. This screen will update automatically.",
      };
  }
}
