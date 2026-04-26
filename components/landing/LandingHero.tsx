import Link from "next/link";
import { Tile } from "@/components/canvas/Tile";
import { Wordmark } from "@/components/primitives/Wordmark";
import { Bullet } from "@/components/primitives/Bullet";
import { GithubIcon, OssFooter } from "@/components/marketing/OssFooter";
import { LandingTabs } from "./LandingTabs";
import { ResumeGames } from "./ResumeGames";

const REPO_URL = "https://github.com/sschafft/tessera";

const STEPS = [
  { n: "01", label: "Host", text: "Create a game and share the code.", dot: "red" as const },
  { n: "02", label: "Pair up", text: "Pick builder, guider, or observer.", dot: "blue" as const },
  { n: "03", label: "Build", text: "Talk through it on your call.", dot: "green" as const },
  { n: "04", label: "Reflect", text: "Trigger learnings, share briefs, debrief.", dot: "purple" as const },
];

export function LandingHero() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[var(--color-paper)]">
      {/* Dotted background */}
      <div className="t-dots pointer-events-none absolute inset-0 opacity-35" />

      {/* Decorative scattered tiles. Positioned to live in the margins
       * around the hero so they never cover the form or copy. Hidden on
       * narrow viewports where they'd compete for space. */}
      <div className="pointer-events-none absolute inset-0 hidden xl:block">
        <Tile kind="hex" color="yellow" x={32} y={150} size={96} rotate={-12} />
        <Tile kind="tri-up" color="red" x={1280} y={70} size={84} rotate={14} />
        <Tile kind="rhomb" color="purple" x={1340} y={430} size={60} rotate={6} />
        <Tile kind="tri-dn" color="green" x={70} y={760} size={80} rotate={-10} />
        <Tile kind="hex" color="teal" x={1300} y={780} size={56} rotate={28} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-14 py-7">
        <Wordmark size={26} />
        <nav className="flex items-center gap-1">
          <Link
            href="/how-it-works"
            className="cursor-pointer px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          >
            How it works
          </Link>
          <Link
            href="/facilitator-guide"
            className="cursor-pointer px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          >
            Facilitator guide
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Source on GitHub"
            className="ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          >
            <GithubIcon size={18} />
          </a>
        </nav>
      </header>

      <ResumeGames />

      {/* Main two-column hero */}
      <section className="relative z-[1] grid items-start gap-14 px-20 pt-6 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <span
            className="t-chip"
            style={{ background: "var(--color-tint-yellow)", color: "#7a5b00" }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "var(--color-t-orange)",
              }}
            />
            A workshop game for teams of 3+
          </span>

          <h1
            className="t-display mb-5 mt-4"
            style={{ fontSize: 88, lineHeight: 0.94, letterSpacing: "-0.035em" }}
          >
            Build the
            <br />
            <span className="relative inline-block">
              same picture
              <svg
                viewBox="0 0 420 22"
                className="absolute -bottom-2.5 left-0 right-0 w-full"
                aria-hidden="true"
              >
                <path
                  d="M2 14 C 80 4, 200 22, 418 8"
                  fill="none"
                  stroke="var(--color-t-red)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <br />
            without seeing it.
          </h1>

          <p
            className="m-0 max-w-[540px] text-[17px] text-[var(--color-ink-2)]"
            style={{ lineHeight: 1.55 }}
          >
            Tessera is a facilitation game for hybrid workshops. Pair a{" "}
            <b>builder</b> with a <b>guider</b>, give each a secret brief, and
            watch communication, prototyping, and shared context become
            visible.
          </p>

          <div className="mt-6 flex flex-wrap gap-5 text-[13px] text-[var(--color-ink-3)]">
            <Bullet color="red" label="Builder + Guider pairs" />
            <Bullet color="blue" label="Optional observers" />
            <Bullet color="green" label="No accounts needed" />
          </div>
        </div>

        <div className="relative">
          <LandingTabs />
          <div
            className="absolute -right-4 -top-5 rotate-[8deg] rounded-full px-4 py-2.5"
            style={{
              background: "var(--color-t-yellow)",
              color: "var(--color-ink)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 14,
              boxShadow:
                "0 4px 0 rgba(0,0,0,.10), 0 6px 20px rgba(60,40,10,.12)",
              border: "1.5px solid var(--color-ink)",
            }}
          >
            no logins!
          </div>
        </div>
      </section>

      {/* "How it works" strip */}
      <section className="relative grid grid-cols-1 gap-6 px-20 pb-20 pt-9 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="flex flex-col gap-2 py-4"
            style={{ borderTop: `3px solid var(--color-t-${s.dot})` }}
          >
            <span
              className="t-mono text-[11px] text-[var(--color-ink-3)]"
              style={{ letterSpacing: ".1em" }}
            >
              {s.n}
            </span>
            <span className="t-display text-[22px] font-semibold">
              {s.label}
            </span>
            <span
              className="text-[13px] text-[var(--color-ink-2)]"
              style={{ lineHeight: 1.45 }}
            >
              {s.text}
            </span>
          </div>
        ))}
      </section>

      <OssFooter />
    </div>
  );
}
