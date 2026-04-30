import { ContentLayout } from "@/components/marketing/ContentLayout";

export const metadata = {
  title: "Privacy · Tessera",
  description:
    "What Tessera collects, how briefly we keep it, and what we don't do.",
};

export default function PrivacyPage() {
  return (
    <ContentLayout
      kicker="PRIVACY"
      title="No accounts, no tracking, fast deletion."
      lede="Tessera is a no-login facilitation game. We collect the absolute minimum needed to run a 30-minute workshop session, retain it for at most a week, and never use any of it for advertising, analytics, profiling, or any commercial purpose. There are no user accounts to begin with."
    >
      <p
        className="t-mono text-[12px] uppercase"
        style={{ color: "var(--color-ink-3)", letterSpacing: ".15em" }}
      >
        Last updated 2026-04-28
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        What we don&apos;t do
      </h2>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>No accounts.</b> No email address, no password, no identity, no
          OAuth-via-social to sign up. You join a game with a 6-character code
          and a display name; that&apos;s it.
        </li>
        <li>
          <b>No advertising.</b> No ad tech, no remarketing pixels, no
          third-party trackers, no fingerprinting. Tessera does not sell or
          share data with anyone.
        </li>
        <li>
          <b>No analytics for profiling.</b> We do not build behavioural
          profiles of you across games, sessions, or visits. Tessera has no
          data warehouse, no event tracker, no segmentation tool.
        </li>
        <li>
          <b>No long-term storage.</b> Game data is auto-deleted within 24
          hours of the last activity in that game and hard-deleted within 7
          days. After that, it&apos;s gone from our database.
        </li>
        <li>
          <b>No data shared with third parties</b> for marketing, training,
          or any commercial purpose. The only third parties involved are the
          infrastructure providers we use to run the service (below) — and
          only for the operational purpose of running the service.
        </li>
      </ul>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        What we do collect (and why)
      </h2>
      <p>
        To make a real-time browser game work without accounts, we have to
        keep a small amount of state on the server while a game is in flight:
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>The display name you type</b> when you join a game. This is the
          only personally identifiable input we accept, and it&apos;s
          whatever you choose to type — &ldquo;Sam&rdquo;,
          &ldquo;Player 4&rdquo;, an emoji, a pseudonym. Used to show your
          partner who they&apos;re working with. Deleted with the game.
        </li>
        <li>
          <b>Game state</b> — the workshop name set by the facilitator, the
          game code, your role, where you placed pieces on the canvas, the
          briefs assigned to your pair, the score, and the round timer.
          Everything you&apos;d expect a multiplayer puzzle game to keep so
          the screen reflects what just happened. All of it deleted with the
          game.
        </li>
        <li>
          <b>A session cookie</b> (named <span className="t-mono">ts_&lt;game-code&gt;</span>)
          to recognise that you&apos;re the same browser between requests
          inside one game. HttpOnly + SameSite=Lax + Secure. Expires in 4
          hours. Not used for tracking across games or sites.
        </li>
        <li>
          <b>A one-shot recovery token</b> (yours and the facilitator&apos;s,
          shown once at join/host time) so you can reclaim your seat if your
          tab dies. Only the bcrypt hash is stored on the server; the plain
          token only ever exists in your browser.
        </li>
      </ul>
      <p>
        That&apos;s the entire list. We do not collect IP addresses,
        geolocation, device fingerprints, contact lists, or any kind of
        biometric data.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Retention
      </h2>
      <p>
        Tessera is built to forget. A game row is marked for deletion 24
        hours after its last interaction; the row is permanently removed by
        a daily cleanup job within 7 days. There is no archive, no
        cold-storage backup we restore from, no &ldquo;just in case&rdquo;
        copy. After deletion, we can&apos;t recover your data — and neither
        can anyone else.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Third-party services
      </h2>
      <p>
        Tessera runs on a small handful of vendor-hosted services. Each one
        receives only the data it strictly needs to do its job:
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>Vercel</b> hosts the application and may receive request
          metadata (URL, user-agent) for the duration of each HTTP request.
          Server logs are retained per Vercel&apos;s policy. Vercel
          Analytics is loaded for aggregate page-view counts; it is
          designed to be cookie-less and not to identify individual
          visitors. See{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Vercel&apos;s privacy policy
          </a>
          .
        </li>
        <li>
          <b>Supabase</b> is the database + realtime broadcast backend. It
          receives game state for as long as the game exists. See{" "}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Supabase&apos;s privacy policy
          </a>
          .
        </li>
        <li>
          <b>OpenAI</b> and <b>Google (Gemini)</b> may receive a brief
          generation prompt — and only that — when the facilitator picks
          &ldquo;AI-generated&rdquo; as a brief source. The prompt does not
          include player names or any identifying information. See{" "}
          <a
            href="https://openai.com/policies/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            OpenAI&apos;s privacy policy
          </a>{" "}
          and{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Google&apos;s privacy policy
          </a>
          .
        </li>
        <li>
          <b>Google Calendar &amp; Meet</b> are involved <i>only</i> when a
          facilitator opts in to per-pair breakout rooms and signs in with
          Google. In that case, Tessera uses the Calendar API to create a
          short, private, past-dated calendar event per pair (so a Google
          Meet link can be auto-attached) and deletes those events
          automatically when the game ends. We store the OAuth access /
          refresh tokens encrypted at rest, only for the lifetime of that
          game, and revoke the OAuth grant on game-end. Tessera asks for the
          minimum scope required (<span className="t-mono">calendar.events</span>),
          never reads existing events, and never writes to any other Google
          surface.
        </li>
      </ul>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Cookies
      </h2>
      <p>
        Tessera sets two kinds of cookies, both first-party, both functional
        (i.e. required to make the game work — you cannot meaningfully use
        the service without them):
      </p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <span className="t-mono">ts_&lt;game-code&gt;</span> — a session
          JWT that proves you&apos;re the same browser between requests
          inside one game. Expires in 4 hours.
        </li>
        <li>
          <span className="t-mono">tessera_recovery_&lt;code&gt;</span> — a
          backup of your one-shot recovery URL stored in the browser&apos;s
          localStorage (technically not a cookie, but worth disclosing) so
          you can recover your seat if your session cookie gets clobbered.
        </li>
      </ul>
      <p>
        Tessera does not set advertising or tracking cookies. There is no
        consent banner because there is nothing on this site that would
        require one under GDPR / ePrivacy &mdash; only strictly necessary
        functional storage.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Children
      </h2>
      <p>
        Tessera is intended for adult facilitation workshops and is not
        directed at children under 13. We do not knowingly collect data from
        children. If you become aware that a child has used Tessera, contact
        the maintainer (below) and we&apos;ll delete the relevant game row.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Your rights
      </h2>
      <p>
        Because Tessera doesn&apos;t collect anything that identifies you
        beyond a chosen display name, and deletes everything within a week,
        most data-subject rights resolve themselves automatically. If you
        want a game deleted sooner, the facilitator can end it from the
        dashboard, which marks the game for immediate cleanup. If you have
        any other request, open an issue on{" "}
        <a
          href="https://github.com/sschafft/tessera/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          the GitHub repository
        </a>{" "}
        and we&apos;ll respond.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        Changes to this policy
      </h2>
      <p>
        Tessera is open source. The page you&apos;re reading is the live
        version of the policy. Any change is visible in the{" "}
        <a
          href="https://github.com/sschafft/tessera/commits/main/app/privacy/page.tsx"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          file&apos;s git history
        </a>
        . Material changes (new third-party services, broader collection)
        will land via a public commit; cosmetic edits (typos, link fixes)
        will not.
      </p>
    </ContentLayout>
  );
}
