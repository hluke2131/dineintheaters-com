import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Hero } from "@/components/hero";
import { LegalSection } from "@/components/legal-page";
import { SUBMISSIONS_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "A nationwide directory of movie theaters where you can sit down to a real meal during the film, held to one standard.",
  alternates: { canonical: "/about-us" },
};

// Inline links keep a 44px tap target without breaking the sentence.
const proseLink =
  "inline-flex min-h-11 items-center font-medium text-burgundy underline hover:text-burgundy-dark";

export default function AboutPage() {
  return (
    <>
      <Hero size="compact" eyebrow="About" title="About DineInTheaters.com" />
      <Container className="py-14 sm:py-20">
        <div className="max-w-[68ch] space-y-10">
          <LegalSection title="What this is">
            <p>
              A nationwide directory of movie theaters where you can sit down to a real meal during
              the film. Not a snack at the concession stand: burgers, pizza, sandwiches, salads and
              entrées, brought to your seat or ordered at the counter and eaten at your seat or in
              a seated dining area.
            </p>
          </LegalSection>

          <LegalSection title="Why it exists">
            <p>
              &ldquo;Dine-in&rdquo; covers a lot of ground. One chain can run a full kitchen at one
              location and a popcorn-and-nachos counter at the next, and it&rsquo;s hard to tell
              which you&rsquo;re getting before you show up. This directory sorts that out in one
              place, across every operator.
            </p>
          </LegalSection>

          <LegalSection title="One standard, nationwide">
            <p>
              A theater is listed only if you can have an entire meal there. Popcorn, candy,
              nachos, fries, hot dogs or pretzels alone don&rsquo;t count. Neither does a bar on
              its own, or a drive-in without sit-down meal service. If we can&rsquo;t confirm a
              full meal, we leave the theater off rather than guess. The same standard applies to
              every listing, and no theater can pay its way onto the list.
            </p>
          </LegalSection>

          <LegalSection title="How we check">
            <p>
              We rely on theaters&rsquo; own menus and websites, plus what diners report about the
              real experience. We don&rsquo;t visit every theater, and menus change. Details like
              in-seat delivery, alcohol, and price range appear only where we have evidence.
              Otherwise a listing says &ldquo;Not yet confirmed.&rdquo;
            </p>
          </LegalSection>

          <LegalSection title="Help us get it right">
            <p>
              Spot a mistake, or know a dine-in theater we missed? Email{" "}
              {SUBMISSIONS_EMAIL ? (
                <a href={`mailto:${SUBMISSIONS_EMAIL}`} className={`${proseLink} break-all`}>
                  {SUBMISSIONS_EMAIL}
                </a>
              ) : (
                <Link href="/contact" className={proseLink}>
                  us through our contact page
                </Link>
              )}
              . Theater operators are welcome to send a link to their current menu.
            </p>
          </LegalSection>

          <LegalSection title="Affiliate note">
            <p>
              Some ticket links may earn us a small commission at no cost to you. See our{" "}
              <Link href="/privacy" className={proseLink}>
                Privacy Policy
              </Link>
              .
            </p>
          </LegalSection>
        </div>
      </Container>
    </>
  );
}
