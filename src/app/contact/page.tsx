import type { Metadata } from "next";
import { Container } from "@/components/container";
import { Hero } from "@/components/hero";
import { SUBMISSIONS_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with DineInTheaters.com.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <Hero
        size="compact"
        eyebrow="Contact"
        title="Contact Us"
        description="The fastest way to reach us is by email."
      />
      <Container className="py-14 sm:py-20">
        {SUBMISSIONS_EMAIL ? (
          <div className="max-w-2xl">
            <a
              href={`mailto:${SUBMISSIONS_EMAIL}`}
              className="inline-flex min-h-11 items-center break-all font-display text-2xl text-burgundy underline hover:text-burgundy-dark sm:text-3xl"
            >
              {SUBMISSIONS_EMAIL}
            </a>
            <p className="mt-4 text-lg text-ink/70">
              Write to us about a correction to a listing, a theater we&rsquo;re missing,
              sponsorship, or any other question.
            </p>
          </div>
        ) : (
          <p className="max-w-2xl text-lg text-ink/70">
            Contact details will be posted here soon.
          </p>
        )}
      </Container>
    </>
  );
}
