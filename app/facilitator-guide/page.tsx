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
          Decide on briefs. <b>Library</b> is the safe default. Pick{" "}
          <b>Custom</b> when you want to point the lesson at a specific theme
          (e.g. swap east/west to talk about how engineering and design see the
          same thing differently). <b>AI-generated</b> is unpredictable in a
          good way.
        </li>
        <li>
          Set a video call link and (optionally) a Miro / FigJam board for
          notes. Tessera doesn&apos;t do voice itself — pairs need an external
          channel.
        </li>
        <li>
          <b>Save your host recovery URL.</b> If you close the tab, that
          bookmark is your only way back to the dashboard.
        </li>
      </ul>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        At kickoff
      </h2>
      <ul className="ml-6 list-disc pl-2">
        <li>
          Share the game code. Players join from the home page; let them choose
          a display name they&apos;re happy seeing in their team&apos;s
          history.
        </li>
        <li>
          Decide whether to let players pick their own role. Builders typically
          enjoy the hands-on side; guiders are best for verbal communicators.
          Observers are great for skeptics who want to watch first.
        </li>
        <li>
          Use <b>auto-allocate</b> if you don&apos;t care about pairings. Use{" "}
          <b>manual pair</b> when you want to mix functions deliberately
          (engineer ↔ designer, junior ↔ senior).
        </li>
      </ul>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        While the round is running
      </h2>
      <p>
        Watch the dashboard, not the participants. The right pair to nudge is
        the one with the lowest accuracy after 60 seconds — they&apos;re the
        ones who&apos;ve been talking past each other.
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>Frustrated pair?</b> 🔮 Prototype unlock or ✓ Test build relieves
          ambiguity.
        </li>
        <li>
          <b>Pair too confident?</b> ⏱ Time pressure or ✎ Requirement change
          punctures the assumption that they&apos;re close to done.
        </li>
        <li>
          <b>Pair gone silent?</b> 📖 Reveal briefs unblocks them — but
          you&apos;re trading away the lesson, so save it for the last few
          minutes.
        </li>
      </ul>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Debrief prompts
      </h2>
      <p>The game ends; the workshop begins. Try these in order:</p>
      <ol className="ml-6 list-decimal pl-2">
        <li>
          &ldquo;What was your brief?&rdquo; — read them out loud. The
          revelation is half the lesson.
        </li>
        <li>
          &ldquo;When did you realise the brief was getting in the way?&rdquo;
        </li>
        <li>
          &ldquo;What did you stop asking each other?&rdquo; — the silences are
          the data.
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
          <b>Cross-functional pairs.</b> Pair an engineer with a designer; use
          the &ldquo;In the third person&rdquo; brief to surface how each role
          frames problems.
        </li>
        <li>
          <b>Same-discipline pairs.</b> Pair two engineers; use the
          &ldquo;Three words or fewer&rdquo; brief to surface how much shared
          context they really lean on.
        </li>
        <li>
          <b>Big group, multiple rounds.</b> Run round 1 at complexity 3 with
          briefs off; let everyone get the rules. Round 2 with briefs on. Round
          3 with one super power per pair.
        </li>
      </ul>
    </ContentLayout>
  );
}
