import { ContentLayout } from "@/components/marketing/ContentLayout";

export const metadata = {
  title: "Facilitator guide · Tessera",
  description: "How to run a Tessera workshop and what to talk about after.",
};

export default function FacilitatorGuidePage() {
  return (
    <ContentLayout
      kicker="FACILITATOR GUIDE"
      title="How to run a Tessera workshop."
      lede="Tessera is most useful when you treat it as a 30-minute scaffold for a 60-minute conversation. The game produces an artifact; the value lives in what you talk about after."
    >
      <h2 className="t-display mt-4 text-[28px] font-bold tracking-tight">
        Before the call
      </h2>
      <ul className="ml-6 list-disc pl-2">
        <li>
          Pick a <b>complexity</b> from 1–8. Start at 3 if your team
          hasn&apos;t played before; bump to 5–6 once they get the rhythm.
        </li>
        <li>
          Pick a <b>round count</b> (1–5). Multi-round is the easiest way
          to teach the rules in round 1 and crank the difficulty for
          round 2.
        </li>
        <li>
          Decide on briefs per side. <b>Library</b> is the safe default.
          Pick <b>Custom</b> when you want to point the lesson at a
          specific theme. <b>AI-generated</b> is unpredictable in a good
          way.
        </li>
        <li>
          Set a video call link (Meet, Zoom, etc). Tessera doesn&apos;t
          do voice — pairs need an external channel.
        </li>
        <li>
          <b>Save your host recovery URL.</b> The create modal shows it
          once. If you close the tab without saving, it&apos;s the only
          way back to the dashboard. Players see the same kind of URL
          when they join.
        </li>
      </ul>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        At kickoff
      </h2>
      <p>
        Pre-round, the master view is a single column with three numbered
        cards — <b>1. Invite players</b>, <b>2. Pairs &amp; observers</b>,
        and <b>3. Game settings</b>. Walk down the cards in order; the
        Super powers rail and focused-pair canvas only appear once the
        round starts.
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          Share the game code. Players join from the home page; let them
          choose a display name they&apos;re happy seeing in their
          team&apos;s history.
        </li>
        <li>
          Decide whether to let players pick their own role. Builders
          typically enjoy the hands-on side; guiders are best for verbal
          communicators. Observers are great for skeptics who want to
          watch first.
        </li>
        <li>
          Use <b>auto-allocate</b> if you don&apos;t care about pairings.
          Use <b>manual pair</b> when you want to mix functions
          deliberately (engineer ↔ designer, junior ↔ senior).
        </li>
        <li>
          Encourage pairs to give themselves a name once they read their
          briefs — &ldquo;The Pelicans&rdquo; beats &ldquo;Sam ↔ Jules&rdquo;
          on the leaderboard. Anyone in the pair (and the GM) can rename.
        </li>
      </ul>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        While the round is running
      </h2>
      <p>
        Watch the dashboard, not the participants. Each pair row shows a
        live progress bar + completion percentage; pairs that solve the
        puzzle flip green. The right pair to nudge is the one with the
        lowest accuracy after 60 seconds — they&apos;re the ones
        who&apos;ve been talking past each other.
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>Frustrated pair?</b> 🔮 Prototype unlock (3–15 s glimpse) or
          ✓ Test build relieves ambiguity. Test build also flips on the
          mirrored correctness halos for the guider, so they can see
          which directions are landing.
        </li>
        <li>
          <b>Pair too confident?</b> ⏱ Time pressure, ✎ Requirement
          change, or ▲ Make it harder punctures the assumption that
          they&apos;re close to done.
        </li>
        <li>
          <b>Pair gone silent?</b> 📖 Reveal briefs unblocks them — but
          you&apos;re trading away the lesson, so save it for the last
          few minutes. ✦ Change guider brief / Change builder brief is
          gentler — fresh constraint, same conversation.
        </li>
        <li>
          <b>Pair too far behind?</b> ▼ Make it easier re-rolls the goal
          at −1 complexity. Use sparingly — keeps the room moving without
          making the puzzle trivial.
        </li>
        <li>
          <b>Need more time?</b> The +30s / +1m / +2m chips next to the
          timer extend the round; combine with Time pressure on a
          confident pair to keep the field even.
        </li>
      </ul>
      <p>
        The Scoring tile (top of the rail) lets you tune points per
        correct piece (1–100, default 10) and toggle a per-wrong penalty
        (−1 per misplaced piece). Mid-round changes pop a confirm modal
        because they retroactively recompute every score.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Debrief prompts
      </h2>
      <p>
        The game ends; the workshop begins. Tessera&apos;s game-end view
        ships with the prompts below already on the screen so you
        don&apos;t have to remember them. Try these in order:
      </p>
      <ol className="ml-6 list-decimal pl-2">
        <li>
          &ldquo;What was your brief?&rdquo; — read them out loud. The
          revelation is half the lesson.
        </li>
        <li>
          &ldquo;When did you realise the brief was getting in the way?&rdquo;
        </li>
        <li>
          &ldquo;What did you stop asking each other?&rdquo; — the silences
          are the data.
        </li>
        <li>
          &ldquo;Which of these constraints actually exist on your team
          today?&rdquo; — the hardest question; sit with it.
        </li>
      </ol>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Variations to try
      </h2>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>Cross-functional pairs.</b> Pair an engineer with a designer;
          use a custom brief like &ldquo;refer to everything in the third
          person&rdquo; to surface how each role frames problems.
        </li>
        <li>
          <b>Same-discipline pairs.</b> Pair two engineers; use a
          &ldquo;three words or fewer per turn&rdquo; brief to surface how
          much shared context they really lean on.
        </li>
        <li>
          <b>Big group, multiple rounds.</b> Run round 1 at complexity 3
          with briefs off — let everyone get the rules. Round 2 at
          complexity 5 with briefs on. Round 3 with the same briefs but
          fire ▲ Make it harder mid-round to push the strongest pair.
        </li>
        <li>
          <b>Observer-led debrief.</b> Assign the most senior person on
          the call as an observer. They see both canvases and the briefs;
          when the round ends, ask them to narrate what they saw before
          you reveal the briefs to the rest of the room.
        </li>
      </ul>
    </ContentLayout>
  );
}
