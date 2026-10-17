import type { Metadata } from "next";
import { LegalContact, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using DineInTheaters.com: listings may be out of date, no warranty, third-party links, and how user-submitted content is handled.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The ground rules for using DineInTheaters.com."
      lastUpdated="October 17, 2026"
      otherPage={{ href: "/privacy", label: "Privacy Policy" }}
    >
      <LegalSection title="Agreeing to these terms">
        <p>
          By using DineInTheaters.com (&ldquo;we,&rdquo; &ldquo;us,&rdquo; the
          &ldquo;site&rdquo;), you agree to these terms. If you don&rsquo;t agree, please
          don&rsquo;t use the site. Our Privacy Policy explains how we handle information.
        </p>
      </LegalSection>

      <LegalSection title="What the site is">
        <p>
          DineInTheaters.com is an informational directory of movie theaters that serve meals.
          We don&rsquo;t operate theaters, sell tickets or food, or take reservations. Any
          purchase or booking happens with the theater or another company, on their terms.
        </p>
      </LegalSection>

      <LegalSection title="Listings may be out of date">
        <p>
          Listings are compiled from public sources and information from the community. Theaters
          change their hours, menus, prices, alcohol service, seating, showtimes and even their
          doors with little notice, and we can&rsquo;t promise that anything on the site is
          complete, accurate or current. Always verify hours, menus, showtimes and anything else
          that matters to your plans with the theater before you go.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          The site and everything on it are provided &ldquo;as is&rdquo; and &ldquo;as
          available,&rdquo; without warranties of any kind, express or implied, including
          warranties of accuracy, availability, merchantability, fitness for a particular purpose
          and non-infringement. Some places don&rsquo;t allow these exclusions, so they apply to
          you only to the extent the law permits.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent the law allows, DineInTheaters.com and the people behind it are
          not liable for any indirect, incidental, special, consequential or punitive damages, or
          for lost profits, lost time or a wasted trip, arising from your use of the site or from
          relying on its information, even if we were told such damages were possible. To the
          extent liability cannot be excluded, our total liability for any claim relating to the
          site is limited to $100.
        </p>
      </LegalSection>

      <LegalSection title="Third-party sites and affiliate links">
        <p>
          The site links to theater websites, ticketing and showtime partners, Google Maps and
          other third parties. We don&rsquo;t control those sites, and a link isn&rsquo;t an
          endorsement or a promise about their content, products or practices. Your use of them is
          at your own risk and under their terms.
        </p>
        <p>
          We may earn a small commission on some ticket links, including through an arrangement
          with Fandango via Commission Junction, at no extra cost to you. This doesn&rsquo;t
          change what we list or how we describe it.
        </p>
        <p>
          Theater and brand names belong to their owners. Their appearance here is for
          identification only and doesn&rsquo;t mean the owners sponsor or endorse us.
        </p>
      </LegalSection>

      <LegalSection title="Content you submit">
        <p>
          You may be able to send us theater suggestions, corrections, reviews and similar
          content, by email now and through forms later. You&rsquo;re responsible for what you
          submit, and you promise it is yours to share, truthful to the best of your knowledge,
          and not unlawful, abusive, misleading or infringing.
        </p>
        <p>
          By submitting content, you give us a non-exclusive, worldwide, royalty-free, perpetual
          license to use, reproduce, edit, adapt and display it on the site and in connection
          with running and promoting the directory. You keep ownership of your content.
        </p>
        <p>
          We may edit, decline, hide or remove any submission at any time for any reason, and we
          don&rsquo;t guarantee that anything you send will be published or kept published.
        </p>
      </LegalSection>

      <LegalSection title="Using the site">
        <p>
          Please use the site lawfully. Don&rsquo;t try to disrupt it, break into it, overload it
          or scrape it in a way that burdens our servers, and don&rsquo;t use it to harass anyone
          or to submit false information. We may restrict access for anyone who does.
        </p>
      </LegalSection>

      <LegalSection title="Our content">
        <p>
          The site&rsquo;s design, text, and the way the directory is selected and organized are
          ours or our licensors&rsquo;. You may view the site, link to it and quote small
          portions with credit, but you may not copy the directory wholesale or republish it
          without our written permission.
        </p>
      </LegalSection>

      <LegalSection title="Changes and governing law">
        <p>
          We may change the site or these terms at any time. Updated terms apply once posted
          here with a new date at the top, and continuing to use the site means you accept them.
        </p>
        <p>
          These terms are governed by the laws of the jurisdiction in which DineInTheaters.com
          operates, without regard to conflict-of-law rules, and any dispute will be brought in
          the courts of that jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact intro="Questions about these terms? Email us." />
      </LegalSection>
    </LegalPage>
  );
}
