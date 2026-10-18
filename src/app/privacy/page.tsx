import type { Metadata } from "next";
import { LegalContact, LegalPage, LegalSection } from "@/components/legal-page";
import { ANALYTICS_ID } from "@/lib/consent";

// Build-time check (NEXT_PUBLIC_* is inlined), so the page stays static. With
// no valid analytics ID the page reads exactly as it did before analytics
// existed, including its "Last updated" date.
const ANALYTICS_ENABLED = Boolean(ANALYTICS_ID);

const proseLink =
  "inline-flex min-h-11 items-center font-medium text-burgundy underline hover:text-burgundy-dark";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: ANALYTICS_ENABLED
    ? "How DineInTheaters.com handles information: no accounts, no cookies of our own, Google Analytics only if you accept, and what happens when you click through to other sites."
    : "How DineInTheaters.com handles information: no accounts, no cookies of our own, no analytics, and what happens when you click through to other sites.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="Plain-language notes on what this site does, and doesn’t do, with your information."
      lastUpdated={ANALYTICS_ENABLED ? "October 18, 2026" : "October 17, 2026"}
      otherPage={{ href: "/terms", label: "Terms of Service" }}
    >
      <LegalSection title="The short version">
        <p>
          DineInTheaters.com (&ldquo;we,&rdquo; &ldquo;us&rdquo;) is an informational directory of
          dine-in movie theaters. You can browse it without creating an account, and the site
          does not set cookies of its own
          {ANALYTICS_ENABLED
            ? ", with optional analytics running only if you accept them."
            : " or run analytics today."}{" "}
          We do not sell personal information.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>
          <strong className="font-semibold">Browsing.</strong>{" "}We don&rsquo;t ask you for any
          information to read the directory. Like most websites, our hosting and database
          providers process technical request data, such as your IP address, browser type and the
          pages requested, in order to deliver the site and keep it secure. We do not use that
          data to build profiles of visitors.
        </p>
        <p>
          <strong className="font-semibold">Email.</strong>{" "}If you write to us, we receive your
          email address and whatever you include in your message. We use it to reply, to look into
          corrections and suggestions, and to keep a record of the conversation.
        </p>
        <p>
          <strong className="font-semibold">Accounts.</strong>{" "}The site has no user accounts or
          sign-in today, so there are no passwords or profiles to collect.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and analytics">
        {ANALYTICS_ENABLED ? (
          <>
            <p>
              DineInTheaters.com does not set cookies itself. We use Google Analytics, a service
              of Google LLC, to measure how the directory is used. It is loaded only after you
              accept it in the banner, and not at all if you decline or make no choice.
            </p>
            <p>
              Once loaded, Google Analytics sets cookies on your device and receives your IP
              address and information about your browsing activity on this site. Google Analytics 4
              does not log or store full IP addresses. We have turned off Google signals and ad
              personalization, and we don&rsquo;t use analytics for advertising. Google&rsquo;s use
              of this data is governed by Google&rsquo;s own policies:
            </p>
            <ul>
              <li>
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={proseLink}
                >
                  How Google uses information from sites that use its services
                </a>
              </li>
              <li>
                <a
                  href="https://support.google.com/analytics/answer/6004245"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={proseLink}
                >
                  Safeguarding your data (Google Analytics)
                </a>
              </li>
            </ul>
            <p>
              You can change your choice at any time with &ldquo;Cookie settings&rdquo; in the
              footer. Your choice is stored in your browser&rsquo;s local storage on your own
              device, not in a cookie, and it is not sent to us.
            </p>
          </>
        ) : (
          <p>
            DineInTheaters.com does not set cookies itself and does not currently use analytics or
            advertising trackers. If that changes, we will update this policy.
          </p>
        )}
        <p>
          Some content comes from other companies, and those companies may set their own cookies
          or collect their own data when you load or use it. See &ldquo;Third-party content and
          links&rdquo; below.
        </p>
      </LegalSection>

      <LegalSection title="Third-party content and links">
        <p>
          <strong className="font-semibold">Google Maps.</strong>{" "}When a map is configured, a
          listing page embeds a Google Maps map. Loading it sends information such as your IP
          address and browser details to Google, and Google may set cookies. Google&rsquo;s use of
          that information is governed by Google&rsquo;s own privacy policy and terms, not this
          one.
        </p>
        <p>
          <strong className="font-semibold">Links out.</strong>{" "}Listings link to theater websites,
          to ticketing and showtime partners, and to Google Maps for directions. Once you follow a
          link you are on someone else&rsquo;s site, under their privacy practices. They may set
          cookies or otherwise track you, and we don&rsquo;t control or review that.
        </p>
        <p>
          <strong className="font-semibold">Affiliate links.</strong>{" "}We may earn a small
          commission on some ticket links, including through an arrangement with Fandango via
          Commission Junction, at no extra cost to you. When you click an affiliate link, the
          partner or its affiliate network may use cookies or similar technology to record that
          the visit came from us. They handle that information under their own policies.
        </p>
      </LegalSection>

      <LegalSection title="Submissions, corrections and reviews">
        <p>
          We plan to add forms for suggesting theaters, correcting listings and posting reviews.
          If you send us that kind of content, now by email or later through a form, we may
          collect what you provide, such as your name, email address and the text of your
          submission. Content you choose to publish, such as a review, may be displayed publicly
          along with the name you give. Please don&rsquo;t include anything you aren&rsquo;t
          comfortable having shown.
        </p>
        <p>
          We use that information to review and publish (or decline to publish) your submission,
          to follow up with you, and to keep the directory accurate. Your email address is not
          shown publicly. The Terms of Service set out the license that applies to submitted
          content.
        </p>
      </LegalSection>

      <LegalSection title="How we use and share information">
        <p>
          We use information only to run and improve the directory and to respond to you. We
          don&rsquo;t sell it. We share it only with service providers that host or operate the
          site for us (for example, web hosting and database services), when required by law, or
          to protect the site and its visitors.
        </p>
      </LegalSection>

      <LegalSection title="Keeping and deleting information">
        <p>
          We keep emails and submissions for as long as they are useful for the purposes above,
          or as the law requires. You can ask us to show, correct or delete personal information
          we hold about you by contacting us, and we&rsquo;ll respond within a reasonable time.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The site is a general-audience directory and is not directed at children under 13. We
          don&rsquo;t knowingly collect personal information from children. If you believe a child
          has sent us information, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          When our practices change, for example when we add analytics, accounts or submission
          forms, we will update this page and the date at the top.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact intro="Questions about this policy, or a request about your information? Email us." />
      </LegalSection>
    </LegalPage>
  );
}
