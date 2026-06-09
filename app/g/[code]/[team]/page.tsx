import Link from "next/link";
import { redirect } from "next/navigation";
import { isValidGameCode } from "@/lib/game/code";
import { getRepository } from "@/lib/game/getRepository";
import { pairSlug, RESERVED_PAIR_SLUGS } from "@/lib/util/slug";

/**
 * Same fallback the GM dashboard uses ("Avery ↔ Bri") when a pair
 * has no GM-set display_name yet. Defined inline rather than in a
 * shared util because it's the only consumer outside the master
 * surface and the formatting is trivial.
 */
function fallbackPairName(
  builder: string | null,
  guider: string | null,
): string {
  return `${builder ?? "?"} ↔ ${guider ?? "?"}`;
}

interface PageProps {
  params: Promise<{ code: string; team: string }>;
}

/**
 * Vanity alias for a pair's breakout room:
 *   `tessera.schaffters.com/g/<CODE>/<TEAM_SLUG>` → 302 to the
 *   pair's `breakout_call_url`.
 *
 * Useful as a memorable URL to drop into chat instead of the raw
 * Jitsi/Meet link. The slug matches against the pair's `display_name`
 * (after `pairSlug` normalisation), so "The Pelicans" and
 * "the-pelicans" both resolve to the same pair.
 *
 * Failure paths render in-context rather than 404'ing:
 *   - bad / unknown game code → game-not-found landing
 *   - reserved slug (e.g. "play") → Next.js routes this to the real
 *     page before us; nothing to do here
 *   - no pair matches the slug → "team not found" landing with the
 *     list of known pair aliases for this game
 *   - pair found, no breakout URL yet → "your facilitator hasn't
 *     generated breakouts yet" landing
 */
export default async function TeamAliasPage({ params }: PageProps) {
  const { code, team } = await params;
  const requested = decodeURIComponent(team);
  const slug = pairSlug(requested);

  if (!isValidGameCode(code)) {
    return <NotFound title="That game code isn't valid." />;
  }
  // Defence in depth — Next.js routing already prefers static
  // segments (join/master/play) over this dynamic one, but if
  // anyone names their pair after a reserved slug we refuse to
  // resolve it so the real route always wins.
  if (RESERVED_PAIR_SLUGS.has(slug)) {
    return (
      <NotFound title={`"${requested}" is a reserved name — try a different team alias.`} />
    );
  }

  const repo = getRepository();
  const game = await repo.games.findByCode(code);
  if (!game) {
    return <NotFound title="That game code isn't active." />;
  }

  const pairs = await repo.pairs.list(game.id);
  const participants = await repo.participants.listActive(game.id);
  const participantById = new Map(participants.map((p) => [p.id, p]));

  // Build the slug → pair lookup. Use display_name when set,
  // otherwise the same `<builder> ↔ <guider>` fallback the GM
  // dashboard renders, so an unnamed pair still has SOME alias.
  const labelFor = (pairId: string): string => {
    const pair = pairs.find((p) => p.id === pairId);
    if (!pair) return "";
    if (pair.display_name) return pair.display_name;
    return fallbackPairName(
      participantById.get(pair.builder_id ?? "")?.display_name ?? null,
      participantById.get(pair.guider_id ?? "")?.display_name ?? null,
    );
  };

  const match = pairs.find((p) => pairSlug(labelFor(p.id)) === slug);
  if (!match) {
    return (
      <NotFound
        title={`No "${requested}" team in this workshop.`}
        knownAliases={pairs.map((p) => ({
          slug: pairSlug(labelFor(p.id)),
          label: labelFor(p.id),
        })).filter((a) => a.slug)}
        code={code}
      />
    );
  }

  if (match.breakout_call_url) {
    redirect(match.breakout_call_url);
  }

  return <NoBreakoutYet code={code} label={labelFor(match.id)} />;
}

function NotFound({
  title,
  knownAliases,
  code,
}: {
  title: string;
  knownAliases?: { slug: string; label: string }[];
  code?: string;
}) {
  return (
    <div className="relative min-h-screen w-full bg-[var(--color-paper)]">
      <div className="t-dots pointer-events-none absolute inset-0 opacity-35" />
      <main className="relative z-10 mx-auto flex max-w-[460px] flex-col gap-4 px-6 py-16">
        <header className="text-center">
          <span
            className="t-mono inline-block text-[11px] tracking-widest text-[var(--color-ink-3)]"
            style={{ letterSpacing: ".15em" }}
          >
            ALIAS NOT FOUND
          </span>
          <h1 className="t-display mt-1 text-2xl">{title}</h1>
          <p className="mt-3 text-[14px] text-[var(--color-ink-2)]">
            Aliases use the pair&apos;s name. Ask your facilitator for the
            right link, or hop into the workshop directly.
          </p>
        </header>
        {knownAliases && knownAliases.length > 0 && code ? (
          <div className="t-card flex flex-col gap-2 p-5">
            <span className="t-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-3)]">
              Aliases in this workshop
            </span>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {knownAliases.map((a) => (
                <li key={a.slug} className="text-[13px]">
                  <Link
                    href={`/g/${code}/${a.slug}`}
                    className="font-bold underline"
                  >
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Link href="/" className="t-btn t-btn--primary self-center">
          ← Back to Tessera
        </Link>
      </main>
    </div>
  );
}

function NoBreakoutYet({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative min-h-screen w-full bg-[var(--color-paper)]">
      <div className="t-dots pointer-events-none absolute inset-0 opacity-35" />
      <main className="relative z-10 mx-auto flex max-w-[460px] flex-col gap-4 px-6 py-16 text-center">
        <span
          className="t-mono text-[11px] tracking-widest text-[var(--color-ink-3)]"
          style={{ letterSpacing: ".15em" }}
        >
          NO BREAKOUT YET
        </span>
        <h1 className="t-display text-2xl">
          {label} doesn&apos;t have a breakout room yet.
        </h1>
        <p className="text-[14px] text-[var(--color-ink-2)]">
          The facilitator hasn&apos;t generated breakouts for this workshop
          yet. This alias will redirect to your call as soon as they do.
        </p>
        <Link
          href={`/g/${code}/play`}
          className="t-btn t-btn--ghost self-center"
        >
          Go to the workshop instead →
        </Link>
      </main>
    </div>
  );
}
