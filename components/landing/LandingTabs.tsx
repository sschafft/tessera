"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/primitives/Field";
import {
  ComplexitySlider,
  complexityHint,
} from "@/components/primitives/ComplexitySlider";
import { Toggle } from "@/components/primitives/Toggle";
import { CodeInput } from "@/components/primitives/CodeInput";
import { isValidGameCode } from "@/lib/game/code";
import type { TeamMode } from "@/lib/game/repository";
import { PreBuiltGameModal } from "./PreBuiltGameModal";
import {
  BreakoutProviderPicker,
  type BreakoutProvider,
} from "./BreakoutProviderPicker";

type Tab = "host" | "join";
type TeamLabel = "Game master picks" | "Players pick";

const teamLabelToMode: Record<TeamLabel, TeamMode> = {
  "Game master picks": "gm_picks",
  "Players pick": "players_pick",
};

export interface LandingTabsProps {
  /** Server-resolved: are Google OAuth env vars configured on this deployment? */
  googleMeetAvailable: boolean;
}

export function LandingTabs({ googleMeetAvailable }: LandingTabsProps) {
  const [tab, setTab] = useState<Tab>("host");

  return (
    <div className="t-card overflow-hidden p-0">
      <div
        className="flex border-b"
        style={{ borderColor: "var(--color-line)", background: "var(--color-paper-2)" }}
      >
        {(
          [
            { id: "host", l: "Host a game" },
            { id: "join", l: "Join a game" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex-1 cursor-pointer border-none px-0 py-4 text-[14px] font-semibold"
            style={{
              background: tab === t.id ? "#fff" : "transparent",
              fontFamily: "var(--font-ui)",
              color: tab === t.id ? "var(--color-ink)" : "var(--color-ink-3)",
              borderBottom:
                tab === t.id
                  ? "3px solid var(--color-t-red)"
                  : "3px solid transparent",
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "host" ? (
        <HostForm googleMeetAvailable={googleMeetAvailable} />
      ) : (
        <JoinForm />
      )}
    </div>
  );
}

interface CreatedInfo {
  code: string;
  recoveryUrl: string;
}

function isLikelyUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function errorStyle(hasError: boolean): React.CSSProperties | undefined {
  if (!hasError) return undefined;
  return {
    borderColor: "var(--color-t-red)",
    boxShadow: "0 0 0 2px var(--color-tint-red)",
  };
}

type BriefSource = "library" | "gm" | "gemini";

type MeetingMode = "remote" | "in_person";

function HostForm({ googleMeetAvailable }: { googleMeetAvailable: boolean }) {
  const router = useRouter();
  const [workshopName, setWorkshopName] = useState("");
  const [meetingMode, setMeetingMode] = useState<MeetingMode>("remote");
  const [videoCallUrl, setVideoCallUrl] = useState("");
  const [whiteboardUrl, setWhiteboardUrl] = useState("");
  const [breakoutProvider, setBreakoutProvider] =
    useState<BreakoutProvider>("none");
  // Always gm_picks — kept as a constant so the create payload still
  // has the field server-side.
  const team: TeamLabel = "Game master picks";
  const [complexity, setComplexity] = useState(5);
  const [builderBrief, setBuilderBrief] = useState(true);
  const [guiderBrief, setGuiderBrief] = useState(true);
  const [builderBriefSource, setBuilderBriefSource] = useState<BriefSource>("library");
  const [guiderBriefSource, setGuiderBriefSource] = useState<BriefSource>("library");
  const [builderCustomTitle, setBuilderCustomTitle] = useState("");
  const [builderCustomRules, setBuilderCustomRules] = useState("");
  const [guiderCustomTitle, setGuiderCustomTitle] = useState("");
  const [guiderCustomRules, setGuiderCustomRules] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedInfo | null>(null);
  const [preBuiltOpen, setPreBuiltOpen] = useState(false);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!workshopName.trim()) next.workshop_name = "Give the workshop a name.";
    if (
      meetingMode === "remote" &&
      videoCallUrl.trim() &&
      !isLikelyUrl(videoCallUrl)
    ) {
      next.video_call_url = "Use a full URL (https://…) or leave it blank.";
    }
    if (
      meetingMode === "remote" &&
      whiteboardUrl.trim() &&
      !isLikelyUrl(whiteboardUrl)
    ) {
      next.whiteboard_url = "Use a full URL or leave it blank.";
    }
    if (builderBrief && builderBriefSource === "gm") {
      if (!builderCustomTitle.trim()) {
        next.builder_brief_custom = "Give your custom builder brief a title.";
      } else if (
        builderCustomRules.split("\n").map((s) => s.trim()).filter(Boolean)
          .length === 0
      ) {
        next.builder_brief_custom = "Add at least one rule (one per line).";
      }
    }
    if (guiderBrief && guiderBriefSource === "gm") {
      if (!guiderCustomTitle.trim()) {
        next.guider_brief_custom = "Give your custom guider brief a title.";
      } else if (
        guiderCustomRules.split("\n").map((s) => s.trim()).filter(Boolean)
          .length === 0
      ) {
        next.guider_brief_custom = "Add at least one rule (one per line).";
      }
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const remote = meetingMode === "remote";
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workshop_name: workshopName,
          meeting_mode: meetingMode,
          breakout_provider: remote ? breakoutProvider : "none",
          video_call_url: remote ? videoCallUrl : "",
          whiteboard_url: remote && whiteboardUrl ? whiteboardUrl : null,
          team_mode: teamLabelToMode[team],
          default_complexity: complexity,
          builder_brief_on: builderBrief,
          guider_brief_on: guiderBrief,
          builder_brief_source: builderBrief ? builderBriefSource : "library",
          guider_brief_source: guiderBrief ? guiderBriefSource : "library",
          builder_brief_custom:
            builderBrief && builderBriefSource === "gm"
              ? {
                  title: builderCustomTitle.trim(),
                  rules: builderCustomRules
                    .split("\n")
                    .map((r) => r.trim())
                    .filter(Boolean),
                }
              : null,
          guider_brief_custom:
            guiderBrief && guiderBriefSource === "gm"
              ? {
                  title: guiderCustomTitle.trim(),
                  rules: guiderCustomRules
                    .split("\n")
                    .map((r) => r.trim())
                    .filter(Boolean),
                }
              : null,
          round_count: 1,
          round_duration_seconds: 900,
          // AI brief generation runs sequentially per pair; round-start
          // latency scales linearly. Library-only games keep the
          // larger cap; AI games drop to a smaller one. Mirrors the
          // server-side gate in `/api/games`.
          participant_cap:
            (builderBrief && builderBriefSource === "gemini") ||
            (guiderBrief && guiderBriefSource === "gemini")
              ? 15
              : 50,
          sound_on: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      const data: { code: string; host_token: string } = await res.json();
      const recoveryUrl = `${window.location.origin}/host-recover/${data.code}#${data.host_token}`;
      setCreated({ code: data.code, recoveryUrl });
      setSubmitting(false);
    } catch (err) {
      setErrors({
        _form: err instanceof Error ? err.message : "Something went wrong",
      });
      setSubmitting(false);
    }
  }

  function clearError(name: string) {
    if (!errors[name]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  if (created) {
    return (
      <CreatedConfirm
        code={created.code}
        recoveryUrl={created.recoveryUrl}
        onContinue={() => router.push(`/g/${created.code}/master`)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6" noValidate>
      <Field
        label="Workshop name"
        hint={errors.workshop_name ?? undefined}
        required
      >
        <input
          className="t-input"
          value={workshopName}
          onChange={(e) => {
            setWorkshopName(e.target.value);
            clearError("workshop_name");
          }}
          placeholder="Q3 cross-functional kickoff"
          maxLength={80}
          required
          aria-invalid={Boolean(errors.workshop_name)}
          style={errorStyle(Boolean(errors.workshop_name))}
        />
      </Field>

      <Field label="Meeting type" hint="In-person skips video / whiteboard / breakouts">
        <div className="flex gap-2">
          {(
            [
              { value: "remote" as const, label: "Remote" },
              { value: "in_person" as const, label: "In-person" },
            ] satisfies Array<{ value: MeetingMode; label: string }>
          ).map((opt) => {
            const active = meetingMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMeetingMode(opt.value)}
                className="flex-1 cursor-pointer rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors"
                style={{
                  background: active ? "var(--color-t-blue)" : "var(--color-paper-2)",
                  color: active ? "#fff" : "var(--color-ink-2)",
                  border: active
                    ? "1.5px solid var(--color-t-blue)"
                    : "1.5px solid var(--color-line)",
                }}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      {meetingMode === "remote" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Video call link"
              hint={errors.video_call_url ?? "optional · workshop main room"}
            >
              <input
                className="t-input"
                value={videoCallUrl}
                onChange={(e) => {
                  setVideoCallUrl(e.target.value);
                  clearError("video_call_url");
                }}
                placeholder="https://meet.google.com/…"
                aria-invalid={Boolean(errors.video_call_url)}
                style={errorStyle(Boolean(errors.video_call_url))}
              />
            </Field>
            <Field
              label="Whiteboard"
              hint={errors.whiteboard_url ?? "optional"}
            >
              <input
                className="t-input"
                value={whiteboardUrl}
                onChange={(e) => {
                  setWhiteboardUrl(e.target.value);
                  clearError("whiteboard_url");
                }}
                placeholder="https://miro.com/…"
                aria-invalid={Boolean(errors.whiteboard_url)}
                style={errorStyle(Boolean(errors.whiteboard_url))}
              />
            </Field>
          </div>

          <BreakoutProviderPicker
            provider={breakoutProvider}
            onChange={setBreakoutProvider}
            googleMeetAvailable={googleMeetAvailable}
          />
        </>
      )}

      {/* Team assignment is always GM-picks now — players_pick added
          UX complexity without value, removed in v1.2. */}

      <Field
        label={`Complexity · ${complexity}/8`}
        hint={complexityHint(complexity)}
      >
        <ComplexitySlider value={complexity} onChange={setComplexity} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Toggle
          label="Builder brief"
          sub="Translation rules"
          on={builderBrief}
          onChange={setBuilderBrief}
        />
        <Toggle
          label="Guider brief"
          sub="Eccentric prompts"
          on={guiderBrief}
          onChange={setGuiderBrief}
        />
      </div>

      {(builderBrief || guiderBrief) && (
        <div className="grid grid-cols-2 gap-3">
          {builderBrief && (
            <BriefSourceSection
              label="Builder brief source"
              source={builderBriefSource}
              onSourceChange={setBuilderBriefSource}
              title={builderCustomTitle}
              onTitleChange={setBuilderCustomTitle}
              rules={builderCustomRules}
              onRulesChange={setBuilderCustomRules}
            />
          )}
          {guiderBrief && (
            <BriefSourceSection
              label="Guider brief source"
              source={guiderBriefSource}
              onSourceChange={setGuiderBriefSource}
              title={guiderCustomTitle}
              onTitleChange={setGuiderCustomTitle}
              rules={guiderCustomRules}
              onRulesChange={setGuiderCustomRules}
            />
          )}
        </div>
      )}

      {(errors._form || errors.builder_brief_custom || errors.guider_brief_custom) && (
        <p className="text-[13px] text-[var(--color-t-red)]" role="alert">
          {errors._form ??
            errors.builder_brief_custom ??
            errors.guider_brief_custom}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="t-btn t-btn--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create game · get code →"}
        </button>
        <button
          type="button"
          onClick={() => setPreBuiltOpen(true)}
          disabled={submitting}
          className="t-mono text-[12px] underline text-[var(--color-ink-2)] disabled:opacity-50"
          title="Already have a roster? Upload a CSV — Tessera will pre-build the pairs and hand you back per-person join URLs."
        >
          ⬆ upload pre-built game (CSV)
        </button>
      </div>
      <PreBuiltGameModal
        open={preBuiltOpen}
        onClose={() => setPreBuiltOpen(false)}
        googleMeetAvailable={googleMeetAvailable}
      />
    </form>
  );
}

function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalised = code.trim().toUpperCase();
    if (!isValidGameCode(normalised)) {
      setError(
        "That code doesn't look right. Should be 7 chars in XXX-NNN format.",
      );
      return;
    }
    if (!displayName.trim()) {
      setError("Pick a display name to continue.");
      return;
    }
    setError(null);
    router.push(
      `/g/${normalised}/join?name=${encodeURIComponent(displayName.trim())}`,
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4.5 p-6">
      <Field label="Game code" hint="6 chars from your facilitator">
        <CodeInput value={code} onChange={setCode} />
      </Field>
      <Field label="Display name" hint="must be unique in this game">
        <input
          className="t-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Sam"
          maxLength={40}
          required
        />
      </Field>

      {error && (
        <p className="text-[13px] text-[var(--color-t-red)]" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="t-btn t-btn--primary self-start">
        Join game →
      </button>
    </form>
  );
}

const BRIEF_SOURCE_OPTIONS = ["library", "gemini", "gm"] as const;
const BRIEF_SOURCE_LABELS: Record<BriefSource, string> = {
  library: "Library",
  gemini: "AI",
  gm: "Custom",
};

function BriefSourceSection({
  label,
  source,
  onSourceChange,
  title,
  onTitleChange,
  rules,
  onRulesChange,
}: {
  label: string;
  source: BriefSource;
  onSourceChange: (s: BriefSource) => void;
  title: string;
  onTitleChange: (t: string) => void;
  rules: string;
  onRulesChange: (r: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--color-line)] p-3">
      <span className="t-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-2)]">
        {label}
      </span>
      <div className="flex gap-1.5 rounded-[10px] bg-[var(--color-paper-2)] p-0.5">
        {BRIEF_SOURCE_OPTIONS.map((opt) => {
          const active = source === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSourceChange(opt)}
              className="flex-1 cursor-pointer border-none px-2 py-1.5 text-[12px] font-semibold"
              style={{
                background: active ? "#fff" : "transparent",
                borderRadius: 8,
                color: active ? "var(--color-ink)" : "var(--color-ink-3)",
                boxShadow: active ? "0 1px 2px rgba(0,0,0,.10)" : "none",
              }}
            >
              {BRIEF_SOURCE_LABELS[opt]}
            </button>
          );
        })}
      </div>
      {source === "gm" && (
        <>
          <input
            className="t-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Brief title (e.g., Mirror image)"
            maxLength={80}
          />
          <textarea
            className="rounded-[12px] border-[1.5px] border-[var(--color-line)] bg-white p-2.5 text-[13px] text-[var(--color-ink)] outline-none"
            rows={3}
            value={rules}
            onChange={(e) => onRulesChange(e.target.value)}
            placeholder={`One rule per line\n• When they say "left", place right`}
            style={{ fontFamily: "var(--font-ui)" }}
            maxLength={1500}
          />
          <p className="t-mono text-[10px] text-[var(--color-ink-3)]">
            One rule per line · 5 max · 280 chars each
          </p>
        </>
      )}
    </div>
  );
}

function CreatedConfirm({
  code,
  recoveryUrl,
  onContinue,
}: {
  code: string;
  recoveryUrl: string;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <span className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]">
          GAME CREATED
        </span>
        <h3 className="t-display text-[28px] font-bold tracking-tight">
          {code}
        </h3>
      </div>

      <div
        className="flex flex-col gap-1 rounded-[14px] px-4 py-3"
        style={{ background: "var(--color-tint-yellow)" }}
      >
        <div
          className="text-[12px] font-bold uppercase tracking-wide"
          style={{ color: "#7a5b00" }}
        >
          ⚠ Save your host recovery link
        </div>
        <p
          className="text-[13px]"
          style={{ color: "#7a5b00", lineHeight: 1.45 }}
        >
          If this tab closes, this URL is the only way back to your dashboard.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="t-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-2)]">
          Recovery URL
        </span>
        <div
          className="t-mono break-all rounded-[10px] border border-[var(--color-line)] bg-[var(--color-paper-2)] px-3 py-2.5 text-[11px]"
          style={{ wordBreak: "break-all" }}
        >
          {recoveryUrl}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="t-btn t-btn--ghost t-btn--sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(recoveryUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "✓ Copied" : "Copy URL"}
        </button>
        <button
          type="button"
          className="t-btn t-btn--primary t-btn--sm"
          onClick={onContinue}
        >
          I&apos;ve saved it · go to dashboard →
        </button>
      </div>
    </div>
  );
}
