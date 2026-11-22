import type { Metadata } from "next";
import Link from "next/link";
import { PolicyHeader, PolicySection } from "@/components/PolicySection";
import { MINIMUM_AGE, POLICY_UPDATED, PRIVACY_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

// Keep this in step with what the app actually stores: progress-store.ts, report.ts, firebase.ts and layout.tsx.

const email = (
  <a href={`mailto:${PRIVACY_EMAIL}`} className="text-accent-700 underline dark:text-accent-400">
    {PRIVACY_EMAIL}
  </a>
);

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <PolicyHeader title="Privacy policy" updated={POLICY_UPDATED}>
        <p>
          Aprendalgo is a small, personal project for learning Spanish. It collects as little as it can, doesn&apos;t sell anything about you
          and shows no ads. This page says exactly what&apos;s kept and why.
        </p>
      </PolicyHeader>

      <PolicySection title="Without an account">
        <p>You can use the whole site without signing in. Nothing about you is saved on our side, apart from page views (see Analytics below).</p>
        <p>
          Your browser keeps a few things on your device so the site remembers them: your level, drill settings, course progress and which
          quiz questions you&apos;ve seen. They never leave your device unless you sign in, and clearing your browser&apos;s site data removes
          them.
        </p>
      </PolicySection>

      <PolicySection title="With an account">
        <p>Signing in saves your progress so it follows you between devices. We keep:</p>
        <ul>
          <li>Your email address and how you sign in (Google, password or email link). Passwords are handled by Firebase, and we never see them.</li>
          <li>
            Your practice: how often you got each verb tense and word right or wrong, your review schedule, the mistakes you made (including what
            you typed), your daily totals, streaks, course chapters and scores, badges, level and review settings.
          </li>
          <li>If you were given an invite for extra content, your email address is on the invite list.</li>
        </ul>
        <p>Answers wait in your browser until they&apos;re saved, so nothing is lost if you go offline.</p>
        <p>Only you can see your progress. Nobody else&apos;s account can read it.</p>
      </PolicySection>

      <PolicySection title="Things you send us">
        <ul>
          <li>
            <strong>Report a problem:</strong> your message, the page it&apos;s about and your email address, so a mistake in the content can be
            fixed and you can be asked about it.
          </li>
          <li>
            <strong>&quot;Mine works&quot;</strong> in the writing drill: the sentence, the answer expected, what you typed and your email address,
            so good alternative translations can be accepted.
          </li>
        </ul>
        <p>These are read by hand and deleted once they&apos;ve been dealt with, or sooner if you ask.</p>
      </PolicySection>

      <PolicySection title="Analytics">
        <p>
          We use Google Analytics to count page views, so we can see which parts of the site are used. It sets cookies and records things like
          the page, your rough location by country or city, and your device and browser. We don&apos;t send it your email, your answers or
          anything you type. Google Signals and ad personalization are turned off.
        </p>
        <p>
          To opt out, block cookies for this site or use{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" className="text-accent-700 underline dark:text-accent-400">
            Google&apos;s opt-out add-on
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Keeping the site safe">
        <p>
          Pages that use sign-in or saving run Google reCAPTCHA (through Firebase App Check) to tell the real app from automated scripts. It runs
          in the background and looks at things like your browser and how the page is used. Its use is covered by Google&apos;s{" "}
          <a href="https://policies.google.com/privacy" className="text-accent-700 underline dark:text-accent-400">
            privacy policy
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/terms" className="text-accent-700 underline dark:text-accent-400">
            terms
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Who handles your data">
        <p>We don&apos;t sell or share your data. These services run parts of the site and handle data only to do that:</p>
        <ul>
          <li>Google Firebase: sign-in and the database where progress is saved.</li>
          <li>Google Analytics and reCAPTCHA, as described above.</li>
          <li>Amazon Web Services (Amplify): hosting. Like any web host, it keeps short-lived server logs, which include IP addresses.</li>
        </ul>
        <p>
          Their servers may be outside your country, including in the United States. Spoken Spanish uses your device&apos;s own voices; some
          browsers use online voices, which sends the Spanish being read aloud to the browser&apos;s maker.
        </p>
      </PolicySection>

      <PolicySection title="Deleting your data">
        <p>
          Your saved progress is kept until you delete it. To delete your account and everything saved with it, use{" "}
          <strong>Delete my account</strong> on the{" "}
          <Link href="/account" className="text-accent-700 underline dark:text-accent-400">
            account page
          </Link>
          . To have problem reports or &quot;Mine works&quot; translations deleted too, or for any other question about your data, email {email}.
        </p>
      </PolicySection>

      <PolicySection title="Children">
        <p>
          Accounts are for people {MINIMUM_AGE} or older. The site doesn&apos;t knowingly keep data about anyone younger, and use by younger
          students through a school isn&apos;t offered yet. If you think a child under {MINIMUM_AGE} has made an account, email {email} and it will
          be deleted.
        </p>
      </PolicySection>

      <PolicySection title="Changes">
        <p>If this policy changes, this page will say so, with a new date at the top.</p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>Questions about privacy: {email}.</p>
      </PolicySection>
    </article>
  );
}
