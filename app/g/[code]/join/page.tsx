import { notFound } from "next/navigation";
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

  if (!isValidGameCode(code)) notFound();

  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game) notFound();

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
          teamMode={game.team_mode}
          defaultName={name ?? ""}
        />
      </main>
    </div>
  );
}
