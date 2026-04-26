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

type Field = "name" | null;
interface FormError {
  field: Field;
  message: string;
}

export function JoinForm({ code, teamMode, defaultName }: JoinFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [role, setRole] = useState<RoleLabel>("Builder");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError({ field: "name", message: "Pick a display name to continue." });
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
          setError({
            field: "name",
            message: "That name is already taken in this game. Try another.",
          });
          setSubmitting(false);
          return;
        }
        if (data.error === "game_full") {
          setError({ field: null, message: "This game is full." });
          setSubmitting(false);
          return;
        }
        if (data.error === "game_closed") {
          setError({ field: null, message: "This game has ended." });
          setSubmitting(false);
          return;
        }
        if (data.error === "game_not_found") {
          setError({
            field: null,
            message: "Couldn't find a game for that code.",
          });
          setSubmitting(false);
          return;
        }
        throw new Error(data.message || data.error || `Server error ${res.status}`);
      }
      const data: { redirect: string } = await res.json();
      router.push(data.redirect);
    } catch (err) {
      setError({
        field: null,
        message: err instanceof Error ? err.message : "Something went wrong",
      });
      setSubmitting(false);
    }
  }

  const nameError = error?.field === "name" ? error.message : null;
  const generalError = error?.field === null ? error.message : null;

  return (
    <form
      onSubmit={onSubmit}
      className="t-card flex flex-col gap-5 p-6"
    >
      <Field
        label="Display name"
        hint={nameError ?? "must be unique in this game"}
      >
        <input
          className="t-input"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (error?.field === "name") setError(null);
          }}
          placeholder="e.g. Sam · Design"
          maxLength={40}
          autoFocus
          required
          aria-invalid={Boolean(nameError)}
          style={
            nameError
              ? {
                  borderColor: "var(--color-t-red)",
                  boxShadow: "0 0 0 2px var(--color-tint-red)",
                }
              : undefined
          }
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

      {generalError && (
        <p className="text-[13px] text-[var(--color-t-red)]" role="alert">
          {generalError}
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
