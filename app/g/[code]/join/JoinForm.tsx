"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/primitives/Field";

export interface JoinFormProps {
  code: string;
  defaultName: string;
  /** From games.breakout_provider — if 'google_meet', email is required. */
  breakoutProvider?: string;
}

type FormField = "name" | "email" | null;
interface FormError {
  field: FormField;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function JoinForm({ code, defaultName, breakoutProvider }: JoinFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const emailRequired = breakoutProvider === "google_meet";

  const [recoveryModal, setRecoveryModal] = useState<{
    url: string;
    redirect: string;
  } | null>(null);
  const [nameTakenHint, setNameTakenHint] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError({ field: "name", message: "Pick a display name to continue." });
      return;
    }
    if (emailRequired) {
      const trimmed = email.trim();
      if (!trimmed) {
        setError({
          field: "email",
          message:
            "Email is required for this game so the facilitator can add you to your breakout call.",
        });
        return;
      }
      if (!EMAIL_RE.test(trimmed)) {
        setError({ field: "email", message: "That doesn't look like a valid email." });
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    setNameTakenHint(null);
    try {
      const res = await fetch(`/api/games/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          role: undefined,
          email: emailRequired ? email.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "name_taken") {
          setError({
            field: "name",
            message: "That name is already taken in this game. Try another.",
          });
          if (data.recover_path) setNameTakenHint(data.recover_path);
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
        if (data.error === "email_required" || data.error === "email_invalid") {
          setError({
            field: "email",
            message:
              data.error === "email_required"
                ? "Email is required for this game's breakout calls."
                : "That doesn't look like a valid email.",
          });
          setSubmitting(false);
          return;
        }
        throw new Error(data.message || data.error || `Server error ${res.status}`);
      }
      const data: { redirect: string; recovery_url: string | null } =
        await res.json();
      if (data.recovery_url) {
        // Stash a fully-qualified URL so the player can paste it
        // anywhere (including a different browser).
        const fullUrl = `${window.location.origin}${data.recovery_url}`;
        try {
          window.localStorage.setItem(
            `tessera_recovery_${code}`,
            fullUrl,
          );
        } catch {
          // localStorage can be disabled (incognito on some browsers);
          // the modal below is the main affordance, this is a backup.
        }
        setRecoveryModal({ url: fullUrl, redirect: data.redirect });
      } else {
        router.push(data.redirect);
      }
    } catch (err) {
      setError({
        field: null,
        message: err instanceof Error ? err.message : "Something went wrong",
      });
      setSubmitting(false);
    }
  }

  const nameError = error?.field === "name" ? error.message : null;
  const emailError = error?.field === "email" ? error.message : null;
  const generalError = error?.field === null ? error.message : null;

  if (recoveryModal) {
    return <RecoverySaveModal {...recoveryModal} router={router} />;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="t-card flex flex-col gap-5 p-6"
    >
      <Field
        label="Display name"
        hint={
          nameTakenHint
            ? undefined
            : (nameError ?? "must be unique in this game")
        }
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

      {emailRequired && (
        <Field
          label="Email"
          hint={
            emailError ??
            "Required so the facilitator can add you to a breakout call. Tessera does not send any other email."
          }
        >
          <input
            className="t-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error?.field === "email") setError(null);
            }}
            placeholder="you@example.com"
            maxLength={120}
            required
            autoComplete="email"
            aria-invalid={Boolean(emailError)}
            style={
              emailError
                ? {
                    borderColor: "var(--color-t-red)",
                    boxShadow: "0 0 0 2px var(--color-tint-red)",
                  }
                : undefined
            }
          />
        </Field>
      )}

      {/* Role picker removed — game master always assigns roles. */}
      {false ? null : (
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

      {nameTakenHint && (
        <p
          className="text-[13px]"
          style={{ color: "#7a5b00" }}
          role="status"
        >
          If that name was yours from earlier and your browser session was
          lost, paste your{" "}
          <a href={nameTakenHint} className="font-bold underline">
            recovery URL on /recover
          </a>{" "}
          to reclaim the seat.
        </p>
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

function RecoverySaveModal({
  url,
  redirect,
  router,
}: {
  url: string;
  redirect: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="t-card flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <span className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]">
          Save your recovery URL
        </span>
        <h2 className="t-display text-[20px] leading-tight">
          One-shot — keep this safe.
        </h2>
        <p className="text-[13px] text-[var(--color-ink-2)]">
          If this tab closes, this URL is the only way back to your seat.
        </p>
      </div>

      <div
        className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[12px]"
        style={{
          background: "var(--color-tint-yellow)",
          border: "1.5px solid var(--color-t-yellow)",
        }}
      >
        <span className="t-mono flex-1 break-all" style={{ color: "#7a5b00" }}>
          {url}
        </span>
        <button
          type="button"
          onClick={copy}
          className="t-mono rounded-md bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink)]"
          style={{ border: "1.5px solid var(--color-line)" }}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push(redirect)}
        className="t-btn t-btn--primary self-start"
      >
        Got it · take me to the game →
      </button>
    </div>
  );
}
