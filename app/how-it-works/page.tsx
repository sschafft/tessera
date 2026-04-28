import { ContentLayout } from "@/components/marketing/ContentLayout";

export const metadata = {
  title: "How it works · Tessera",
  description: "How a Tessera workshop game runs end-to-end.",
};

export default function HowItWorksPage() {
  return (
    <ContentLayout
      kicker="HOW IT WORKS"
      title="A 30-minute game that surfaces how teams talk."
      lede="Tessera is a structured exercise for a video call. Two players try to recreate a picture only one of them can see. They almost never get it right — and that's the point."
    >
      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        The basic loop
      </h2>
      <p>
        A facilitator hosts a game and shares a six-character code (e.g.{" "}
        <span className="t-mono font-bold">HEX-934</span>) with their team.
        Players join with that code and a display name — no accounts, no
        passwords. As they arrive, the facilitator pairs them up:
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          One <b>builder</b> per pair — they have a blank canvas and a tray of
          coloured polygons.
        </li>
        <li>
          One <b>guider</b> per pair — they see the goal pattern, but their
          builder doesn&apos;t.
        </li>
        <li>
          Optional <b>observers</b> — they watch one pair, see both screens
          live.
        </li>
      </ul>
      <p>
        When the round starts, players talk on their video call. The guider
        describes the picture. The builder taps an empty cell on the grid to
        place the selected shape — taps an existing piece to enter Edit mode
        (move with another tap, rotate, delete). Neither side sees the
        other&apos;s screen, but every placement reflects across the room
        within ~200ms via realtime broadcast, with a 10-second polling loop
        as the safety net.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        The twist: secret briefs
      </h2>
      <p>
        Each player gets a sealed envelope before the round begins. The brief
        is a private rule that distorts the conversation — for example, the
        builder must <i>place pieces opposite</i> from the direction the guider
        says, or the guider can only describe shapes using nautical terms.
      </p>
      <p>
        Players can&apos;t reveal their brief to their partner. They can ask
        each other questions. The whole game is the negotiation between the
        two private rules.
      </p>
      <p>
        Briefs come from one of three sources, picked per side by the
        facilitator at game-create time: a curated <b>library</b> (~33
        hand-written entries bucketed by complexity), <b>custom</b> free-text
        briefs the GM authors themselves to point the lesson at a specific
        theme, or <b>AI-generated</b> via a provider router that tries OpenAI
        first and falls back to Google&apos;s Gemini, then to the library.
        Every option produces the same envelope on the player&apos;s screen.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Mirrored feedback during a round
      </h2>
      <p>
        The builder can hit a <b>Test solution</b> button at any time —
        green halos light up correct pieces, red ones flag wrong placements,
        and the score updates live. The same green halos and a live
        &ldquo;X / Y placed&rdquo; chip appear on the guider&apos;s goal
        canvas, so both partners see the same feedback at the same moment.
        Pairs that complete a round get a celebratory banner + confetti so
        the room knows when someone solves it.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Facilitator super powers
      </h2>
      <p>
        The game master has a rail of ten in-game mechanics they can trigger
        on a single pair or globally, plus an inline scoring tile. Each
        super power maps to a real workshop dynamic:
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>🔮 Prototype unlock</b> — a configurable 3–15 s glimpse of the
          goal, ~10–20% wrong on purpose.
        </li>
        <li>
          <b>📖 Reveal briefs</b> — both players see each other&apos;s rule
          (irreversible within the round).
        </li>
        <li>
          <b>✓ Test build</b> — flips per-piece correctness markers on the
          builder side, GM-fired.
        </li>
        <li>
          <b>↻ Agile share</b> — builder snapshots their progress for the
          guider.
        </li>
        <li>
          <b>⏱ Time pressure</b> — drop a configurable amount off the clock.
        </li>
        <li>
          <b>✦ Change builder brief</b> — re-roll the builder&apos;s hidden
          constraint.
        </li>
        <li>
          <b>✦ Change guider brief</b> — re-roll the guider&apos;s hidden
          constraint.
        </li>
        <li>
          <b>🎲 Randomizer</b> — wipe the goal pattern, generate a new one.
        </li>
        <li>
          <b>✎ Requirement change</b> — mutate exactly one piece in the goal.
        </li>
        <li>
          <b>▲ Make it harder</b> / <b>▼ Make it easier</b> — re-roll the
          goal at +1 / −1 complexity, keeping the round&apos;s grid intact.
        </li>
      </ul>
      <p>
        Most super powers have per-round caps and short cooldowns. The point
        isn&apos;t to use them all — it&apos;s to reach for the right one
        when the room gets stuck. A short toast pops on the affected
        pair&apos;s screen each time one fires, so the change registers.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Running the room
      </h2>
      <p>
        The GM dashboard shows every pair at a glance with a live progress
        bar and completion %. Pairs that have solved the puzzle render in
        green, so the GM can spot which pair to nudge without drilling in.
        Pre-round, the dashboard collapses into a single column with three
        numbered cards — invite players, allocate pairs, set game options —
        so the lobby phase stays uncluttered.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        After the game
      </h2>
      <p>
        When the round ends, every player sees the goal alongside what they
        built, plus everyone&apos;s briefs and a per-pair leaderboard. The
        facilitator runs a debrief on the call: where did the picture
        diverge? Which brief got in the way? What did you stop asking each
        other? Tessera ships three suggested retro questions on the
        game-end view to seed the conversation. The GM can launch another
        round with the same players, same complexity, or bump the
        complexity dial — pairings persist unless they hit Shuffle.
      </p>
    </ContentLayout>
  );
}
