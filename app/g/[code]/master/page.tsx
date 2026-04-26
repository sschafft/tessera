import { Wordmark } from "@/components/primitives/Wordmark";
import { RoleChip } from "@/components/primitives/RoleChip";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * Game master dashboard — placeholder for milestone 1. The real screen
 * (sidebar with lobby + pairs, focused-pair detail, accelerant rail) lands
 * in milestones 2 and 6.
 */
export default async function MasterPage({ params }: PageProps) {
  const { code } = await params;
  return (
    <div className="min-h-screen bg-[var(--color-paper)] p-12">
      <header className="flex items-center justify-between border-b border-[var(--color-line)] pb-6">
        <div className="flex items-center gap-4">
          <Wordmark size={22} />
          <span className="t-mono text-[12px] text-[var(--color-ink-3)]">
            game · {code}
          </span>
          <RoleChip role="Game master" />
        </div>
      </header>
      <main className="t-display mt-12 text-3xl">
        Welcome — game <span className="t-mono">{code}</span> created.
        <p className="mt-4 text-base text-[var(--color-ink-2)] t-display-none font-normal font-[var(--font-ui)]">
          Lobby, pairs, and accelerant rail land in the next milestone.
        </p>
      </main>
    </div>
  );
}
