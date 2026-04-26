"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/primitives/Field";

export interface HostRecoverFormProps {
  code: string;
}

/**
 * Host recovery — accepts the one-shot token via URL fragment
 * (#<token>) for bookmark recovery, or via paste-into-form. Sends it
 * to /api/games/[code]/host-recover in the request body so it never
 * appears in server access logs.
 */
export function HostRecoverForm({ code }: HostRecoverFormProps) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  useEffect(() => {
    // Auto-grab the token from the URL fragment, then strip it so it
    // doesn't survive in browser history / sharing.
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && !autoTriggered.current) {
      autoTriggered.current = true;
      setToken(hash);
      window.history.replaceState(null, "", window.location.pathname);
      void recover(hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recover(t: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${code}/host-recover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `status ${res.status}`);
      }
      router.push(`/g/${code}/master`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Recovery failed. Check the token.",
      );
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Paste the recovery token saved at game create.");
      return;
    }
    void recover(token.trim());
  }

  return (
    <form
      onSubmit={onSubmit}
      className="t-card flex flex-col gap-4 p-6"
    >
      <p className="text-[14px] leading-relaxed text-[var(--color-ink-2)]">
        Paste the recovery token you saved when this game was created.
        We&apos;ll restore your facilitator session.
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
        {submitting ? "Recovering…" : "Recover host session →"}
      </button>
    </form>
  );
}
