"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/primitives/Field";
import { Segmented } from "@/components/primitives/Segmented";
import type { TeamMode } from "@/lib/game/repository";

const ROLE_OPTIONS = ["Builder", "Guider", "Observer"] as const;
type RoleLabel = (typeof ROLE_OPTIONS)[number];

const roleLabelToApi: Record<RoleLabel, "builder" | "guider" | "observer"> = {
  Builder: "builder",
  Guider: "guider",
  Observer: "observer",
};

export interface JoinFormProps {
  code: string;
  teamMode: TeamMode;
  defaultName: string;
}

export function JoinForm({ code, teamMode, defaultName }: JoinFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [role, setRole] = useState<RoleLabel>("Builder");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          role: teamMode === "players_pick" ? roleLabelToApi[role] : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "name_taken") {
          throw new Error("That display name is already in this game. Try another.");
        }
        if (data.error === "game_full") {
          throw new Error("This game is full.");
        }
        if (data.error === "game_closed") {
          throw new Error("This game has ended.");
        }
        throw new Error(data.message || data.error || `Server error ${res.status}`);
      }
      const data: { redirect: string } = await res.json();
      router.push(data.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="t-card flex flex-col gap-5 p-6"
    >
      <Field label="Display name" hint="must be unique in this game">
        <input
          className="t-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          autoFocus
          required
        />
      </Field>

      {teamMode === "players_pick" ? (
        <Field label="Pick your role">
          <Segmented options={ROLE_OPTIONS} value={role} onChange={setRole} />
        </Field>
      ) : (
        <div
          className="flex items-start gap-3 rounded-[14px] px-4 py-3.5"
          style={{ background: "var(--color-tint-yellow)" }}
        >
          <div
            className="grid h-6 w-6 flex-shrink-0 place-items-center"
            style={{
              borderRadius: 6,
              background: "var(--color-t-yellow)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            i
          </div>
          <div
            className="text-[13px]"
            style={{ color: "#7a5b00", lineHeight: 1.45 }}
          >
            Your facilitator will assign your role. You&apos;ll see the
            assignment as soon as they pair you up.
          </div>
        </div>
      )}

      {error && (
        <p className="text-[13px] text-[var(--color-t-red)]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="t-btn t-btn--primary self-start"
        disabled={submitting}
      >
        {submitting ? "Joining…" : "Join game →"}
      </button>
    </form>
  );
}
