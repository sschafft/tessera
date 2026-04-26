import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/primitives/Wordmark";
import { OssFooter } from "./OssFooter";

export interface ContentLayoutProps {
  /** Small kicker above the H1, e.g. "PLAYBOOK". */
  kicker?: string;
  title: string;
  /** Optional intro paragraph below the title. */
  lede?: string;
  children: ReactNode;
}

const NAV: { href: string; label: string }[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/facilitator-guide", label: "Facilitator guide" },
];

/**
 * Shared layout for the marketing-style content pages (How it works,
 * Facilitator guide). Matches the home page paper / Fraunces aesthetic
 * but with comfortable reading line lengths.
 */
export function ContentLayout({
  kicker,
  title,
  lede,
  children,
}: ContentLayoutProps) {
  return (
    <div className="relative min-h-screen w-full bg-[var(--color-paper)]">
      <div className="t-dots pointer-events-none absolute inset-0 opacity-25" />
      <header className="relative z-10 flex items-center justify-between px-14 py-7">
        <Link href="/">
          <Wordmark size={24} />
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="cursor-pointer px-3.5 py-2 text-[13px] font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/" className="t-btn t-btn--sm ml-2">
            Host a game
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-[680px] px-6 py-12">
        {kicker && (
          <div
            className="t-mono mb-2 text-[11px] uppercase text-[var(--color-ink-3)]"
            style={{ letterSpacing: ".15em" }}
          >
            {kicker}
          </div>
        )}
        <h1
          className="t-display"
          style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        {lede && (
          <p
            className="mt-4 max-w-[560px] text-[18px] text-[var(--color-ink-2)]"
            style={{ lineHeight: 1.55 }}
          >
            {lede}
          </p>
        )}
        <article className="prose-tessera mt-10 flex flex-col gap-5 text-[16px] leading-[1.6] text-[var(--color-ink-2)]">
          {children}
        </article>
      </main>

      <OssFooter />
    </div>
  );
}
