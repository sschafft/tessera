"use client";

export interface BriefEnvelopeProps {
  role: "builder" | "guider";
  title: string;
  rules: string[];
  /**
   * Marks this brief as the *partner's* brief, intentionally surfaced
   * by the Reveal-briefs super-power. Swaps the "CONFIDENTIAL" header
   * + the "don't read this aloud" footer for "REVEALED · partner's
   * brief" + a friendlier note. Without this flag, playtest agents
   * read the partner brief and worried they'd seen a leak (it said
   * CONFIDENTIAL on a card visible to them, which broke the asymmetry
   * mental model). Defaults to false (own brief, confidential to me).
   */
  revealedPartner?: boolean;
}

/**
 * Open brief card. Was a three-state widget (sealed / open / minimized)
 * with a seal-tap reveal + dismiss-to-circle behaviour; v1.3 dropped
 * the seal + minimize states based on user feedback that the brief
 * should stay visible the entire round — players were re-tucking it
 * and forgetting their own constraint, and the seal-tap intro added
 * friction without payoff after the first round. Card is now
 * persistent; the player just reads it.
 *
 * Per the locked decisions, the brief content is plain text — no
 * dangerouslySetInnerHTML — so even GM-authored free-text briefs in M5.6
 * can't introduce XSS.
 */
export function BriefEnvelope({
  role,
  title,
  rules,
  revealedPartner = false,
}: BriefEnvelopeProps) {
  const roleLabel = role === "builder" ? "Builder" : "Guider";
  const colorVar =
    role === "builder" ? "var(--color-t-red)" : "var(--color-t-blue)";

  return (
    <div className="t-card relative" style={{ width: 320, padding: 18 }}>
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className="t-mono"
          style={{
            fontSize: 10,
            color: colorVar,
            fontWeight: 700,
            letterSpacing: ".12em",
          }}
        >
          {revealedPartner
            ? `● ${roleLabel.toUpperCase()} · REVEALED`
            : `● ${roleLabel.toUpperCase()} · CONFIDENTIAL`}
        </span>
      </div>
      <div
        className="t-display mb-2.5"
        style={{ fontSize: 17, lineHeight: 1.3 }}
      >
        {title}
      </div>
      <ul
        className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-[var(--color-ink-2)]"
        style={{ lineHeight: 1.4 }}
      >
        {rules.map((rule, i) => (
          <li key={i}>· {rule}</li>
        ))}
      </ul>
      <div
        className="mt-3.5 rounded-[10px] px-3 py-2.5 text-[12px]"
        style={(() => {
          if (revealedPartner) {
            return {
              background: "var(--color-tint-green)",
              color: "var(--color-t-green)",
            };
          }
          return {
            background: "var(--color-tint-yellow)",
            color: "#7a5b00",
          };
        })()}
      >
        {revealedPartner ? (
          <>
            <b>Your partner&apos;s brief</b>, surfaced by the GM&apos;s Reveal
            briefs super-power. You&apos;re allowed to read it now — talk
            through it on the call.
          </>
        ) : (
          <>
            Your partner has a <b>different brief</b>. <b>Don&apos;t read this
            aloud or paraphrase it.</b> They can ask you yes / no questions
            about it — answer honestly, like 20 questions.
          </>
        )}
      </div>
    </div>
  );
}
