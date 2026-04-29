import Link from "next/link";
import { isValidGameCode } from "@/lib/game/code";
import { getRepository } from "@/lib/game/getRepository";
import { JoinForm } from "./JoinForm";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ name?: string }>;
}

export default async function JoinPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { name } = await searchParams;

  // Bad code → in-context error rather than the generic /404. Playtest
  // 2026-04-28 caught a user dropped onto the catch-all 404 with no
  // way back to the join surface; a clear "this code doesn't exist"
  // message keeps them in the flow.
  const valid = isValidGameCode(code);
  const game = valid ? await getRepository().games.findByCode(code) : null;
  if (!valid || !game) {
    return (
      <div className="relative min-h-screen w-full bg-[var(--color-paper)]">
        <div className="t-dots pointer-events-none absolute inset-0 opacity-35" />
        <main className="relative z-10 mx-auto flex max-w-[440px] flex-col gap-4 px-6 py-16">
          <header className="text-center">
            <span
              className="t-mono inline-block text-[11px] tracking-widest text-[var(--color-ink-3)]"
              style={{ letterSpacing: ".15em" }}
            >
              GAME NOT FOUND
            </span>
            <h1 className="t-display mt-1 text-3xl">
              That code doesn&apos;t match an active game.
            </h1>
            <p className="mt-3 text-[14px] text-[var(--color-ink-2)]">
              Double-check the code with your facilitator — game codes look
              like <span className="t-mono font-bold">HEX-934</span> and stay
              live until the game ends.
            </p>
          </header>
          <Link href="/" className="t-btn t-btn--primary self-center">
            ← Back to join
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[var(--color-paper)]">
      <div className="t-dots pointer-events-none absolute inset-0 opacity-35" />
      <main className="relative z-10 mx-auto flex max-w-[480px] flex-col gap-6 px-6 py-16">
        <header className="text-center">
          <span
            className="t-mono inline-block text-[11px] tracking-widest text-[var(--color-ink-3)]"
            style={{ letterSpacing: ".15em" }}
          >
            JOINING
          </span>
          <h1 className="t-display mt-1 text-3xl">{game.workshop_name}</h1>
          <p className="t-mono mt-2 text-[12px] text-[var(--color-ink-3)]">
            game · {code}
          </p>
        </header>

        <JoinForm
          code={code}
          defaultName={name ?? ""}
          breakoutProvider={game.breakout_provider}
        />
      </main>
    </div>
  );
}
