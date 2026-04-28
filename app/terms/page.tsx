import { ContentLayout } from "@/components/marketing/ContentLayout";

export const metadata = {
  title: "Terms · Tessera",
  description: "Terms of use for Tessera. Free, as-is, no warranty.",
};

export default function TermsPage() {
  return (
    <ContentLayout
      kicker="TERMS OF USE"
      title="As-is, no warranty, use at your own risk."
      lede="Tessera is a free, open-source, hobby-grade facilitation game offered without charge and without commitment. By using it, you agree to the terms below. If you don't, don't use it."
    >
      <p
        className="t-mono text-[12px] uppercase"
        style={{ color: "var(--color-ink-3)", letterSpacing: ".15em" }}
      >
        Last updated 2026-04-28
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        1. Acceptance
      </h2>
      <p>
        By accessing, hosting, joining, or otherwise using Tessera (the
        &ldquo;Service&rdquo;), you accept these Terms of Use. If you are
        using Tessera on behalf of an organisation, you represent that you
        have authority to bind that organisation to these terms.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        2. The service is provided &ldquo;AS IS&rdquo;
      </h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND
        &ldquo;AS AVAILABLE&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
        NON-INFRINGEMENT. WITHOUT LIMITING THE FOREGOING, THE MAINTAINER
        DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY,
        SECURE, OR ERROR-FREE; THAT DEFECTS WILL BE CORRECTED; THAT ANY DATA
        WILL BE PRESERVED; OR THAT THE SERVICE OR THE SERVERS THAT MAKE IT
        AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        3. Limitation of liability
      </h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
        THE MAINTAINER, CONTRIBUTORS, AFFILIATES, OR LICENSORS BE LIABLE FOR
        ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
        EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF
        PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING
        OUT OF OR RELATING TO THE USE OF, OR INABILITY TO USE, THE SERVICE,
        EVEN IF THE MAINTAINER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
        DAMAGES. THE TOTAL AGGREGATE LIABILITY OF THE MAINTAINER FOR ALL
        CLAIMS RELATED TO THE SERVICE SHALL NOT EXCEED FIVE U.S. DOLLARS
        (USD $5).
      </p>
      <p>
        Some jurisdictions do not allow the exclusion or limitation of
        certain warranties or liability, so some of the above limitations
        may not apply to you. In those jurisdictions, the maintainer&apos;s
        liability is limited to the maximum extent permitted by law.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        4. No support, no SLA
      </h2>
      <p>
        Tessera is a free hobby project. The maintainer offers no service
        level commitment, no uptime guarantee, no support obligation, and no
        promise of response to issues, bug reports, or feature requests.
        The Service may be modified, throttled, suspended, or discontinued
        at any time without notice.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        5. Acceptable use
      </h2>
      <p>By using the Service, you agree not to:</p>
      <ul className="ml-6 list-disc pl-2">
        <li>
          Use the Service for any unlawful purpose, or in violation of any
          applicable law or regulation.
        </li>
        <li>
          Submit content that is harassing, abusive, defamatory, obscene,
          discriminatory, or otherwise objectionable, including in display
          names, custom briefs, or workshop names.
        </li>
        <li>
          Attempt to disrupt, attack, probe, or reverse-engineer the
          Service; submit automated traffic; circumvent rate limits; or
          otherwise interfere with normal operation.
        </li>
        <li>
          Use the Service to collect, harvest, or otherwise solicit personal
          information about other participants.
        </li>
        <li>
          Use the Service in any context where its failure could reasonably
          cause harm to a person, property, or critical operation. The
          Service is not designed for, and is not appropriate for, medical,
          safety-critical, financial, legal, or other high-stakes contexts.
        </li>
      </ul>
      <p>
        The maintainer reserves the right (but has no obligation) to remove
        content, end games, or block users that appear to violate these
        terms.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        6. Your content
      </h2>
      <p>
        You retain ownership of anything you type into Tessera (display
        names, custom briefs, workshop names, etc.). By submitting content
        you grant the maintainer a non-exclusive, royalty-free licence to
        store and display that content within the Service for the duration
        of your game, solely as necessary to operate the Service. Your
        content is auto-deleted per the{" "}
        <a href="/privacy" className="underline">
          privacy policy
        </a>
        .
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        7. Third-party services
      </h2>
      <p>
        The Service depends on third-party providers (Vercel, Supabase,
        OpenAI, Google, and others — see the{" "}
        <a href="/privacy" className="underline">
          privacy policy
        </a>{" "}
        for the full list). Use of those providers is governed by their
        own terms and privacy policies. The maintainer is not responsible
        for the availability or behaviour of any third-party service, nor
        for any data those providers collect or process under their own
        terms.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        8. Open source
      </h2>
      <p>
        The Tessera source code is published under the MIT licence. The
        licence governs the source code; these Terms of Use govern the
        hosted Service. If you fork and self-host Tessera, you take on the
        responsibilities of an operator and these Terms do not bind you;
        users of your fork are subject to whatever terms you publish there.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        9. Indemnification
      </h2>
      <p>
        You agree to defend, indemnify, and hold harmless the maintainer
        and contributors from any claim, demand, loss, liability, or
        expense (including reasonable legal fees) arising out of: (a) your
        use or misuse of the Service; (b) your violation of these Terms;
        (c) your violation of any law or third-party right; or (d) any
        content you submit through the Service.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        10. Termination
      </h2>
      <p>
        The maintainer may terminate or suspend access to the Service at
        any time, for any reason, without notice. Upon termination, your
        right to use the Service ceases immediately. Sections 2, 3, 6, 7,
        9, 10, 11, and 12 survive termination.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        11. Governing law &amp; venue
      </h2>
      <p>
        These Terms are governed by the laws of the State of California,
        United States, without regard to its conflict-of-laws rules. Any
        dispute arising out of or relating to the Service or these Terms
        shall be brought exclusively in the state or federal courts located
        in San Francisco County, California, and you consent to the
        personal jurisdiction of those courts.
      </p>

      <h2 className="t-display mt-6 text-[28px] font-bold tracking-tight">
        12. Miscellaneous
      </h2>
      <ul className="ml-6 list-disc pl-2">
        <li>
          <b>Entire agreement.</b> These Terms, together with the privacy
          policy, are the entire agreement between you and the maintainer
          regarding the Service.
        </li>
        <li>
          <b>Severability.</b> If any provision of these Terms is held
          unenforceable, the remaining provisions remain in full force.
        </li>
        <li>
          <b>No waiver.</b> Failure to enforce any provision is not a
          waiver of that provision.
        </li>
        <li>
          <b>Changes.</b> The maintainer may update these Terms at any
          time; the current version is the page you&apos;re reading. Any
          change is visible in the file&apos;s git history. Continued use
          of the Service after a change constitutes acceptance.
        </li>
        <li>
          <b>No agency.</b> No agency, partnership, joint venture, or
          employment is created by these Terms or by your use of the
          Service.
        </li>
      </ul>

      <p
        className="mt-8 text-[13px]"
        style={{ color: "var(--color-ink-3)", lineHeight: 1.55 }}
      >
        Tessera is provided as a free hobby project. If any part of these
        Terms is unacceptable to you, please do not use the Service.
      </p>
    </ContentLayout>
  );
}
