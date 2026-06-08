"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field } from "@/components/primitives/Field";

export interface PlayerRecoverFormProps {
  code: string;
}

/**
 * Player recovery — accepts {participant_id, token} via either
 *   /recover/<code>?p=<participantId>#<token>     (auto-recover from URL)
 * or paste-into-form fallback. The token is sent in the POST body so
 * it never lands in server access logs or Referer headers.
 */
export function PlayerRecoverForm({ code }: PlayerRecoverFormProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [participantId, setParticipantId] = useState(
    search?.get("p") ?? "",
  );
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const pid = search?.get("p") ?? "";
    if (hash && pid && !autoTriggered.current) {
      autoTriggered.current = true;
      setToken(hash);
      // Strip the fragment so the token doesn't survive in browser
      // history / sharing.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      void recover(pid, hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recover(pid: string, t: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${code}/recover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant_id: pid, token: t }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.error === "invalid_token") {
          throw new Error("That recovery token doesn't match. Check the link.");
        }
        if (j.error === "participant_not_found") {
          throw new Error(
            "We couldn't find your seat. The game may have been reset — try Join instead.",
          );
        }
        if (j.error === "game_closed") {
          throw new Error("This game has already ended.");
        }
        if (j.error === "no_recovery_configured") {
          throw new Error(
            "This seat predates player-recovery — please rejoin via the Join form.",
          );
        }
        throw new Error(j.message || j.error || `status ${res.status}`);
      }
      const data: { redirect: string } = await res.json();
      router.push(data.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed.");
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!participantId.trim() || !token.trim()) {
      setError("Paste your full recovery URL or fill both fields.");
      return;
    }
    void recover(participantId.trim(), token.trim());
  }

  return (
    <form onSubmit={onSubmit} className="t-card flex flex-col gap-4 p-6">
      <p className="text-[14px] leading-relaxed text-[var(--color-ink-2)]">
        Paste the recovery URL or token you saved when you joined this game.
        We&apos;ll restore your seat with the same display name + role.
      </p>
      <Field label="Recovery token" hint="32 chars">
        <input
          className="t-input t-mono"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
          autoComplete="off"
          required
        />
      </Field>
      <Field label="Participant ID" hint="from the recovery link (?p=…)">
        <input
          className="t-input t-mono"
          value={participantId}
          onChange={(e) => setParticipantId(e.target.value)}
          autoComplete="off"
          required
        />
      </Field>
      {error && (
        <p className="text-[13px] text-[var(--color-t-red)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <a
          href={`/g/${code}/join`}
          className="t-mono text-[11px] text-[var(--color-ink-3)] underline"
        >
          ← join with a different name
        </a>
        <button
          type="submit"
          className="t-btn t-btn--primary"
          disabled={submitting}
        >
          {submitting ? "Recovering…" : "Recover seat →"}
        </button>
      </div>
    </form>
  );
}
