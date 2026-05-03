"use client";

import { useEffect, useState } from "react";

export interface PartnerActiveDotProps {
  /** Wallclock ms of the partner's most recent realtime event, or null. */
  lastActiveAt: number | null;
  /** How long after the last event to keep showing "active". */
  windowMs?: number;
}

/**
 * Tiny pulsing presence dot — green when the partner has fired a
 * realtime event inside `windowMs`, hidden otherwise. Pure visual,
 * driven by `lib/realtime/usePartnerActivity`.
 */
export function PartnerActiveDot({
  lastActiveAt,
  windowMs = 30_000,
}: PartnerActiveDotProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (lastActiveAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastActiveAt]);
  if (lastActiveAt == null) return null;
  const fresh = now - lastActiveAt <= windowMs;
  if (!fresh) return null;
  return (
    <span
      aria-label="Partner active just now"
      className="inline-block"
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--color-t-green)",
        boxShadow: "0 0 0 2px var(--color-paper-2)",
        animation: "tessera-attention 1500ms ease-in-out infinite",
      }}
    />
  );
}
