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
      lede="Tessera is a structured exercise for a workshop — over a video call or in the same room. Two players try to recreate a picture only one of them can see. They almost never get it right — and that's the point."
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
        When the round starts, the pair talks — over the call or across
        the table. The guider describes the picture. The builder taps an
        empty cell on the grid to place the selected shape; tapping an
        existing piece enters Edit mode (move with another tap, rotate,
        delete). Neither side sees the other&apos;s screen.
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
        facilitator at game-create time: a curated <b>library</b> of
        hand-written entries, <b>custom</b> free-text briefs the GM
        authors to point the lesson at a specific theme, or{" "}
        <b>AI-generated</b> for fresh constraints every game. Every option
        produces the same envelope on the player&apos;s screen.
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
        The game master has a curated rail of mechanics they can trigger on
        a single pair or globally, plus an inline scoring tile. The five most
        useful sit inline; a <b>More super powers</b> CTA opens the rest in a
        fullscreen grid. Each maps to a real workshop dynamic:
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
          <b>↻ Agile share</b> — unlocks one snapshot for the builder to
          push their current canvas to the guider. GM-fired (off by
          default); each fire grants one more share.
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
        Prototype unlock and Agile share are uncapped — the rest have small
        per-round caps and short cooldowns. The point isn&apos;t to use them
        all; it&apos;s to reach for the right one when the room gets stuck.
        A short toast pops on the affected pair&apos;s screen each time one
        fires, so the change registers.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Remote, in-person, or hybrid
      </h2>
      <p>
        At game-create, the GM picks <b>remote</b> (default) or{" "}
        <b>in-person</b>. Remote workshops can also opt into per-pair{" "}
        <b>breakout rooms</b> via Google Meet (with participant emails as
        attendees) or Jitsi (free, no sign-in for anyone). Each pair gets
        a private call link to talk on while they build, and the
        workshop&apos;s main video link demotes to a small &ldquo;Main
        room&nbsp;↗&rdquo; secondary chip. In-person mode hides video and
        breakouts entirely — everyone&apos;s already in the room.
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
