import { notFound } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { getRepository } from "@/lib/game/getRepository";
import { Wordmark } from "@/components/primitives/Wordmark";
import { HostRecoverForm } from "./HostRecoverForm";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function HostRecoverPage({ params }: PageProps) {
  const { code } = await params;
  if (!isValidGameCode(code)) notFound();
  const repo = getRepository();
  const game = await repo.findGameByCode(code);
  if (!game) notFound();

  return (
    <div className="relative min-h-screen w-full bg-[var(--color-paper)]">
      <div className="t-dots pointer-events-none absolute inset-0 opacity-35" />
      <main className="relative z-10 mx-auto flex max-w-[480px] flex-col gap-6 px-6 py-16">
        <header className="text-center">
          <Wordmark size={26} />
          <span
            className="t-mono mt-4 inline-block text-[11px] tracking-widest text-[var(--color-ink-3)]"
            style={{ letterSpacing: ".15em" }}
          >
            HOST RECOVERY
          </span>
          <h1 className="t-display mt-1 text-3xl">{game.workshop_name}</h1>
          <p className="t-mono mt-2 text-[12px] text-[var(--color-ink-3)]">
            game · {code}
          </p>
        </header>
        <HostRecoverForm code={code} />
      </main>
    </div>
  );
}
