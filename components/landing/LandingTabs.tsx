"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/primitives/Field";
import { Segmented } from "@/components/primitives/Segmented";
import {
  ComplexitySlider,
  complexityHint,
} from "@/components/primitives/ComplexitySlider";
import { Toggle } from "@/components/primitives/Toggle";
import { CodeInput } from "@/components/primitives/CodeInput";
import { isValidGameCode } from "@/lib/game/code";
import type { TeamMode } from "@/lib/game/repository";

type Tab = "host" | "join";
const TEAM_OPTIONS = ["Game master picks", "Players pick"] as const;
type TeamLabel = (typeof TEAM_OPTIONS)[number];

const teamLabelToMode: Record<TeamLabel, TeamMode> = {
  "Game master picks": "gm_picks",
  "Players pick": "players_pick",
};

export function LandingTabs() {
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

      {tab === "host" ? <HostForm /> : <JoinForm />}
    </div>
  );
}

function HostForm() {
  const router = useRouter();
  const [workshopName, setWorkshopName] = useState("Q3 cross-functional kickoff");
  const [videoCallUrl, setVideoCallUrl] = useState("https://meet.google.com/example");
  const [whiteboardUrl, setWhiteboardUrl] = useState("");
  const [team, setTeam] = useState<TeamLabel>("Players pick");
  const [complexity, setComplexity] = useState(5);
  const [builderBrief, setBuilderBrief] = useState(true);
  const [guiderBrief, setGuiderBrief] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workshop_name: workshopName,
          video_call_url: videoCallUrl,
          whiteboard_url: whiteboardUrl || null,
          team_mode: teamLabelToMode[team],
          default_complexity: complexity,
          builder_brief_on: builderBrief,
          guider_brief_on: guiderBrief,
          builder_brief_source: "library",
          guider_brief_source: "library",
          round_count: 1,
          round_duration_seconds: 900,
          participant_cap: 50,
          sound_on: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      const data: { code: string } = await res.json();
      router.push(`/g/${data.code}/master`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
      <Field label="Workshop name">
        <input
          className="t-input"
          value={workshopName}
          onChange={(e) => setWorkshopName(e.target.value)}
          maxLength={80}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Video call link" required>
          <input
            className="t-input"
            value={videoCallUrl}
            onChange={(e) => setVideoCallUrl(e.target.value)}
            placeholder="meet.google.com/…"
            required
            type="url"
          />
        </Field>
        <Field label="Whiteboard" hint="optional">
          <input
            className="t-input"
            value={whiteboardUrl}
            onChange={(e) => setWhiteboardUrl(e.target.value)}
            placeholder="miro.com/…"
            type="url"
          />
        </Field>
      </div>

      <Field label="Team assignment">
        <Segmented
          options={TEAM_OPTIONS}
          value={team}
          onChange={setTeam}
        />
      </Field>

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

      {error && (
        <p className="text-[13px] text-[var(--color-t-red)]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="t-btn t-btn--primary mt-1 self-start"
        disabled={submitting}
      >
        {submitting ? "Creating…" : "Create game · get code →"}
      </button>
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
    if (!isValidGameCode(code)) {
      setError("Game code must be in the form XXX-NNN.");
      return;
    }
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    // Join API + lobby UI ship in milestone 2; for now we just route to the
    // (placeholder) lobby page so the form proves itself end-to-end.
    setError(null);
    router.push(`/g/${code}/join?name=${encodeURIComponent(displayName.trim())}`);
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
          maxLength={40}
          required
        />
      </Field>

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
          Your facilitator chose <b>Players pick teams</b> — you&apos;ll choose
          your role on the next screen.
        </div>
      </div>

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
