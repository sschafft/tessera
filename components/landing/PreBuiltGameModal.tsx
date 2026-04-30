"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface PreBuiltGameModalProps {
  open: boolean;
  onClose: () => void;
}

interface UploadSuccess {
  code: string;
  host_token: string;
  participant_count: number;
  pair_count: number;
  csv: string;
}

interface UploadErrorRow {
  line: number;
  message: string;
}

interface UploadErrorTeam {
  team_name: string;
  message: string;
}

/**
 * "Upload pre-built game" modal. Lets the GM hand the system a CSV
 * with their already-decided pairs (name + email + team_name + role)
 * and get back a populated CSV with one unique join URL per row, so
 * they can paste names + links into a calendar invite or email
 * before the workshop starts.
 *
 * Shape of the flow:
 *
 *   1. Description + downloadable template
 *   2. Workshop config (name, complexity, briefs on/off)
 *   3. Upload CSV
 *   4. Server parses + validates + creates game/participants/pairs
 *   5. Modal shows the game code and a "Download populated CSV" CTA
 *
 * Light-touch settings on purpose: every other knob (round count,
 * scoring, breakouts) is set in the regular host flow. This modal
 * is for the *roster* — you can fine-tune the rest from the GM
 * dashboard once the room is open.
 */
export function PreBuiltGameModal({ open, onClose }: PreBuiltGameModalProps) {
  // Conditionally mount so internal state is fresh on each open. The
  // alternative (reset-in-effect) tripped the no-set-state-in-effect
  // lint; this is also cheaper since React just unmounts on close.
  if (!open) return null;
  return <PreBuiltGameModalContent onClose={onClose} />;
}

function PreBuiltGameModalContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [workshopName, setWorkshopName] = useState("");
  const [complexity, setComplexity] = useState(5);
  const [builderBrief, setBuilderBrief] = useState(true);
  const [guiderBrief, setGuiderBrief] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<UploadErrorRow[]>([]);
  const [teamErrors, setTeamErrors] = useState<UploadErrorTeam[]>([]);
  const [success, setSuccess] = useState<UploadSuccess | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  async function submit() {
    setError(null);
    setRowErrors([]);
    setTeamErrors([]);
    if (!workshopName.trim()) {
      setError("Workshop name is required.");
      return;
    }
    if (!file) {
      setError("Pick a CSV file to upload.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("csv", file);
      fd.append(
        "settings",
        JSON.stringify({
          workshop_name: workshopName.trim(),
          default_complexity: complexity,
          round_count: 1,
          round_duration_seconds: 480,
          builder_brief_on: builderBrief,
          guider_brief_on: guiderBrief,
          meeting_mode: "remote",
          breakout_provider: "none",
        }),
      );
      const res = await fetch("/api/games/upload", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.errors && Array.isArray(j.errors)) {
          setRowErrors(j.errors);
        }
        if (j.team_errors && Array.isArray(j.team_errors)) {
          setTeamErrors(j.team_errors);
        }
        setError(
          j.detail || j.error || `Upload failed (status ${res.status})`,
        );
        setSubmitting(false);
        return;
      }
      setSuccess({
        code: j.code,
        host_token: j.host_token,
        participant_count: j.participant_count,
        pair_count: j.pair_count,
        csv: j.csv,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload pre-built game"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "rgba(31,26,20,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="t-card flex max-h-[90vh] w-full max-w-[600px] flex-col gap-4 overflow-y-auto p-6"
        style={{ background: "#fff" }}
      >
        {success ? (
          <SuccessView
            success={success}
            onDownload={() =>
              downloadCsv(
                success.csv,
                `tessera-${success.code}-roster.csv`,
              )
            }
            onContinue={() => router.push(`/g/${success.code}/master`)}
          />
        ) : (
          <SetupView
            workshopName={workshopName}
            setWorkshopName={setWorkshopName}
            complexity={complexity}
            setComplexity={setComplexity}
            builderBrief={builderBrief}
            setBuilderBrief={setBuilderBrief}
            guiderBrief={guiderBrief}
            setGuiderBrief={setGuiderBrief}
            file={file}
            setFile={setFile}
            error={error}
            rowErrors={rowErrors}
            teamErrors={teamErrors}
            submitting={submitting}
            onClose={onClose}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}

function SetupView({
  workshopName,
  setWorkshopName,
  complexity,
  setComplexity,
  builderBrief,
  setBuilderBrief,
  guiderBrief,
  setGuiderBrief,
  file,
  setFile,
  error,
  rowErrors,
  teamErrors,
  submitting,
  onClose,
  onSubmit,
}: {
  workshopName: string;
  setWorkshopName: (s: string) => void;
  complexity: number;
  setComplexity: (n: number) => void;
  builderBrief: boolean;
  setBuilderBrief: (b: boolean) => void;
  guiderBrief: boolean;
  setGuiderBrief: (b: boolean) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  error: string | null;
  rowErrors: UploadErrorRow[];
  teamErrors: UploadErrorTeam[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]">
            Pre-built game
          </span>
          <h2 className="t-display text-[22px] leading-tight">
            Upload a roster CSV.
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={submitting}
          className="t-mono rounded-full bg-[var(--color-paper-2)] px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
          style={{ border: "1.5px solid var(--color-line)" }}
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-[12px] p-3 text-[13px]"
        style={{
          background: "var(--color-tint-blue)",
          color: "var(--color-t-blue)",
          border: "1.5px solid var(--color-t-blue)",
        }}
      >
        <p>
          <b>What this does:</b> upload a CSV with everyone&apos;s name,
          email (optional), team name, and role. Tessera creates the
          game, the pairs, and a unique join URL per person. You get
          back the same CSV plus a <code>join_url</code> column you can
          paste into a calendar invite.
        </p>
        <p>
          <a
            href="/api/templates/pairs"
            className="t-mono underline"
            download
          >
            ⬇ Download CSV template
          </a>{" "}
          — the columns are <code>name</code>, <code>email</code>,
          {" "}<code>team_name</code>, <code>role</code>. Each team needs
          one <i>builder</i> and one <i>guider</i>; extras become{" "}
          <i>observer</i>s on that team.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="t-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-3)]"
          htmlFor="prebuilt-workshop-name"
        >
          Workshop name
        </label>
        <input
          id="prebuilt-workshop-name"
          type="text"
          value={workshopName}
          onChange={(e) => setWorkshopName(e.target.value)}
          maxLength={80}
          disabled={submitting}
          placeholder="Q3 cross-functional kickoff"
          className="t-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            className="t-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-3)]"
            htmlFor="prebuilt-complexity"
          >
            Default complexity (1–8)
          </label>
          <input
            id="prebuilt-complexity"
            type="number"
            min={1}
            max={8}
            value={complexity}
            onChange={(e) => setComplexity(Number(e.target.value) || 5)}
            disabled={submitting}
            className="t-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="t-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-3)]">
            Briefs
          </span>
          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-1.5 text-[12px]">
              <input
                type="checkbox"
                checked={builderBrief}
                onChange={(e) => setBuilderBrief(e.target.checked)}
                disabled={submitting}
              />
              builder
            </label>
            <label className="flex items-center gap-1.5 text-[12px]">
              <input
                type="checkbox"
                checked={guiderBrief}
                onChange={(e) => setGuiderBrief(e.target.checked)}
                disabled={submitting}
              />
              guider
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="t-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-3)]"
          htmlFor="prebuilt-csv"
        >
          Roster CSV
        </label>
        <input
          id="prebuilt-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
          className="text-[12px]"
        />
        {file && (
          <p className="t-mono text-[11px] text-[var(--color-ink-3)]">
            ✓ {file.name} ({Math.ceil(file.size / 1024)} KB)
          </p>
        )}
      </div>

      {error && !rowErrors.length && !teamErrors.length && (
        <p
          role="alert"
          className="text-[13px] text-[var(--color-t-red)]"
        >
          {error}
        </p>
      )}

      {rowErrors.length > 0 && (
        <div
          className="flex flex-col gap-1.5 rounded-[10px] p-3 text-[12px]"
          style={{
            background: "var(--color-tint-red)",
            color: "var(--color-t-red)",
            border: "1.5px solid var(--color-t-red)",
          }}
          role="alert"
        >
          <b>{rowErrors.length} row{rowErrors.length === 1 ? "" : "s"} failed validation:</b>
          <ul className="ml-4 list-disc">
            {rowErrors.slice(0, 8).map((e) => (
              <li key={`${e.line}:${e.message}`}>
                <span className="t-mono">line {e.line}:</span> {e.message}
              </li>
            ))}
            {rowErrors.length > 8 && (
              <li className="t-mono italic">
                …and {rowErrors.length - 8} more
              </li>
            )}
          </ul>
        </div>
      )}

      {teamErrors.length > 0 && (
        <div
          className="flex flex-col gap-1.5 rounded-[10px] p-3 text-[12px]"
          style={{
            background: "var(--color-tint-red)",
            color: "var(--color-t-red)",
            border: "1.5px solid var(--color-t-red)",
          }}
          role="alert"
        >
          <b>Team allocation problems:</b>
          <ul className="ml-4 list-disc">
            {teamErrors.map((e) => (
              <li key={`${e.team_name}:${e.message}`}>
                <span className="t-mono">{e.team_name}:</span> {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="t-mono text-[12px] text-[var(--color-ink-3)] underline disabled:opacity-50"
        >
          cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !file || !workshopName.trim()}
          className="t-btn t-btn--primary t-btn--sm disabled:opacity-50"
        >
          {submitting ? "Building game…" : "Create game from CSV →"}
        </button>
      </div>
    </>
  );
}

function SuccessView({
  success,
  onDownload,
  onContinue,
}: {
  success: UploadSuccess;
  onDownload: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="t-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-3)]">
          Game ready
        </span>
        <h2 className="t-display text-[28px] font-bold tracking-tight">
          {success.code}
        </h2>
        <p className="text-[13px] text-[var(--color-ink-2)]">
          {success.participant_count} participants ·{" "}
          {success.pair_count} pair{success.pair_count === 1 ? "" : "s"}{" "}
          ready.
        </p>
      </div>

      <div
        className="flex flex-col gap-1 rounded-[14px] px-4 py-3"
        style={{ background: "var(--color-tint-yellow)" }}
      >
        <div
          className="text-[12px] font-bold uppercase tracking-wide"
          style={{ color: "#7a5b00" }}
        >
          ⚠ Download the populated CSV now
        </div>
        <p
          className="text-[13px]"
          style={{ color: "#7a5b00", lineHeight: 1.45 }}
        >
          Each row now carries a unique join URL. Paste those into your
          calendar invite or email — that&apos;s how each participant
          gets to their seat. Tessera doesn&apos;t store this CSV
          server-side; once you close this modal there&apos;s no way
          to re-download it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="t-btn t-btn--primary t-btn--sm"
        >
          ⬇ Download populated CSV
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="t-btn t-btn--ghost t-btn--sm"
        >
          Open dashboard →
        </button>
      </div>

      <details className="text-[12px] text-[var(--color-ink-3)]">
        <summary className="cursor-pointer">
          Don&apos;t want to send a calendar? Show me one preview link
        </summary>
        <p
          className="t-mono mt-2 break-all rounded-[10px] border border-[var(--color-line)] bg-[var(--color-paper-2)] px-3 py-2 text-[11px]"
        >
          {firstJoinUrl(success.csv)}
        </p>
      </details>
    </>
  );
}

function firstJoinUrl(csv: string): string {
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return "(no rows)";
  const header = lines[0]!.split(",");
  const idx = header.indexOf("join_url");
  if (idx < 0) return "(missing join_url column)";
  const cells = lines[1]!.split(",");
  return cells[idx] ?? "(empty)";
}
