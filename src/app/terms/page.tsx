import type { Metadata } from "next";
import Link from "next/link";
import { PolicyHeader, PolicySection } from "@/components/PolicySection";
import { MINIMUM_AGE, POLICY_UPDATED, PRIVACY_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms" };

const link = "text-accent-700 underline dark:text-accent-400";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <PolicyHeader title="Terms" updated={POLICY_UPDATED}>
        <p>These are the rules for using Aprendalgo. They&apos;re short, and using the site means you accept them.</p>
      </PolicyHeader>

      <PolicySection title="The site">
        <p>
          Aprendalgo is a free site for learning Latin American and Caribbean Spanish. It may change, gain or lose features, or stop, at any
          time.
        </p>
        <p>
          The Spanish here was written carefully but not all of it has been checked by a native speaker yet, so it can contain mistakes. If you
          spot one, please use <strong>Report a problem</strong>. Don&apos;t rely on the site for anything where a mistake would matter, like
          legal, medical or official translations.
        </p>
      </PolicySection>

      <PolicySection title="Your account">
        <ul>
          <li>You must be {MINIMUM_AGE} or older to make an account.</li>
          <li>One account per person. Keep your sign-in to yourself; you&apos;re responsible for what happens with it.</li>
          <li>
            You can delete your account at any time on the{" "}
            <Link href="/account" className={link}>
              account page
            </Link>
            .
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="Fair use">
        <p>Please don&apos;t:</p>
        <ul>
          <li>try to get into other people&apos;s accounts or data;</li>
          <li>use scripts or bots to send requests, or anything that overloads the site or gets around its limits;</li>
          <li>send reports or translations that are abusive, or that contain other people&apos;s personal information;</li>
          <li>copy the site&apos;s content in bulk to publish elsewhere. Using it for your own learning, or sharing a page with someone, is fine.</li>
        </ul>
        <p>Accounts that break these rules may be suspended or deleted.</p>
      </PolicySection>

      <PolicySection title="Offensive words">
        <p>
          Learning a language includes knowing which words offend and why, so the site explains some of them. They&apos;re there to teach, and
          the most vulgar ones are kept out of the public pages.
        </p>
      </PolicySection>

      <PolicySection title="No guarantees">
        <p>
          The site is provided as it is, without any promise that it&apos;s correct, always available or free of errors, and saved progress could
          be lost. As far as the law allows, Aprendalgo isn&apos;t liable for any loss from using it.
        </p>
      </PolicySection>

      <PolicySection title="Privacy">
        <p>
          What&apos;s collected and why is in the{" "}
          <Link href="/privacy" className={link}>
            privacy policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection title="Changes and contact">
        <p>
          These terms may change; this page will show the new date at the top. Questions:{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className={link}>
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      </PolicySection>
    </article>
  );
}
