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
        describes the picture. The builder drags polygons onto the canvas.
        Neither sees the other&apos;s screen.
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

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Facilitator accelerants
      </h2>
      <p>
        The game master has a deck of eight in-game mechanics they can trigger
        on any pair (or all pairs) mid-round, each modeling a real workshop
        dynamic:
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>🔮 Prototype unlock</b> — a 5-second glimpse of the goal, ~25%
          wrong on purpose.
        </li>
        <li>
          <b>📖 Reveal briefs</b> — both players see each other&apos;s rule.
        </li>
        <li>
          <b>✓ Test build</b> — turn on per-piece correctness markers.
        </li>
        <li>
          <b>↻ Agile share</b> — builder snapshots their progress for the
          guider.
        </li>
        <li>
          <b>⏱ Time pressure</b> — drop 3 minutes off the clock.
        </li>
        <li>
          <b>✦ Vocab swap</b> — re-roll the guider&apos;s constraint mid-round.
        </li>
        <li>
          <b>🎲 Randomizer</b> — wipe the goal pattern, generate a new one.
        </li>
        <li>
          <b>✎ Requirement change</b> — mutate exactly one piece in the goal.
        </li>
      </ul>
      <p>
        Each accelerant has a per-round cap. The point isn&apos;t to use them
        all — it&apos;s to reach for the right one when the room gets stuck.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        After the game
      </h2>
      <p>
        When the round ends, every player sees the goal alongside what they
        built, plus everyone&apos;s briefs. The facilitator runs a debrief on
        the call: where did the picture diverge? Which brief got in the way?
        What would you have asked your partner that you didn&apos;t?
      </p>
    </ContentLayout>
  );
}
