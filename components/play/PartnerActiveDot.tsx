"use client";

export interface PartnerActiveDotProps {
  /** Is the partner currently subscribed to the game's presence channel. */
  present: boolean;
}

/**
 * Tiny pulsing presence dot — green when the partner is connected to
 * the per-game presence channel, hidden otherwise. Driven by
 * `lib/realtime/usePartnerPresence`.
 */
export function PartnerActiveDot({ present }: PartnerActiveDotProps) {
  if (!present) return null;
  return (
    <span
      aria-label="Partner online"
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
