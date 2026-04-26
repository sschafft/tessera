"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ActiveGame {
  code: string;
  workshop_name: string;
  role: string;
  status: string;
}

const ROLE_LABEL: Record<string, string> = {
  gm: "Game master",
  builder: "Builder",
  guider: "Guider",
  observer: "Observer",
  lobby: "Waiting",
};

/**
 * Shown above the hero when the browser has live session cookies for
 * one or more in-progress games. Picks up dropped tabs and lets you
 * jump back into your role.
 */
export function ResumeGames() {
  const [games, setGames] = useState<ActiveGame[] | null>(null);

  useEffect(() => {
    fetch("/api/me/active-games", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setGames(Array.isArray(d.games) ? d.games : []))
      .catch(() => setGames([]));
  }, []);

  if (!games || games.length === 0) return null;

  return (
    <section className="relative z-10 mx-auto max-w-[1280px] px-14 pt-2">
      <div
        className="t-card flex flex-col gap-2 px-5 py-3.5"
        style={{ background: "var(--color-tint-yellow)" }}
      >
        <span
          className="t-mono text-[10px] uppercase tracking-widest"
          style={{ color: "#7a5b00" }}
        >
          Resume a game you&apos;re already in
        </span>
        <ul className="flex flex-wrap items-center gap-2">
          {games.map((g) => {
            const path = g.role === "gm" ? `/g/${g.code}/master` : `/g/${g.code}/play`;
            return (
              <li key={g.code}>
                <Link
                  href={path}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12px] shadow-sm-soft hover:shadow-md-soft"
                >
                  <span className="t-mono font-bold">{g.code}</span>
                  <span className="text-[var(--color-ink-3)]">·</span>
                  <span className="font-semibold">{g.workshop_name}</span>
                  <span className="text-[var(--color-ink-3)]">·</span>
                  <span>{ROLE_LABEL[g.role] ?? g.role}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
