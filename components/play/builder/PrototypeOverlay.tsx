"use client";

import { useEffect, useState } from "react";
import { PlayCanvas } from "@/components/canvas/PlayCanvas";
import type { PlayState } from "../PlayContent";

/**
 * Prototype glimpse — a transient, deliberately-degraded preview of
 * the goal pattern shown to the builder when the GM fires the
 * Prototype unlock super-power. ~25% wrong on purpose to keep it from
 * being a free win. Auto-disappears at the `ends_at` timestamp.
 */
export function PrototypeOverlay({
  prototype,
  complexity,
}: {
  prototype: PlayState["prototype"];
  complexity: number;
}) {
  // SSR-safe: `now` is null until the client mounts. Without this, the
  // useState(() => Date.now()) initialiser produced different values
  // between SSR and hydration, contributing to React error #418 on
  // /play reloads when a prototype window happened to be active.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!prototype) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-shot mount sync; same SSR-mismatch reason as PlayTopBar.useTimer.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [prototype]);

  if (!prototype) return null;
  if (now === null) return null;
  const endsMs = new Date(prototype.ends_at).getTime();
  const remaining = Math.max(0, Math.ceil((endsMs - now) / 1000));
  if (remaining === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="t-mono inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
        style={{
          background: "var(--color-tint-blue)",
          color: "var(--color-t-blue)",
          boxShadow: "inset 0 0 0 1.5px var(--color-t-blue)",
        }}
      >
        🔮 Prototype glimpse · {remaining}s
      </span>
      <div
        className="rounded-[var(--radius-lg)]"
        style={{
          filter: "saturate(0.55) opacity(0.85)",
          border: "2px dashed var(--color-t-blue)",
          padding: 4,
        }}
      >
        <PlayCanvas pieces={prototype.goal} complexity={complexity} />
      </div>
      <span
        className="t-mono text-[10px] text-[var(--color-ink-3)]"
        style={{ letterSpacing: ".1em" }}
      >
        approximate · expect ~25% wrong
      </span>
    </div>
  );
}
