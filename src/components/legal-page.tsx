import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/container";
import { Hero } from "@/components/hero";
import { SUBMISSIONS_EMAIL } from "@/lib/site-config";

const proseLink =
  "inline-flex min-h-11 items-center font-medium text-burgundy underline hover:text-burgundy-dark";

/** Shared shell for /privacy and /terms: the compact hero used by /about-us
 * and /contact, then readable prose. Body copy uses text-ink/85, above the
 * ink/60 floor for secondary text. */
export function LegalPage({
  title,
  description,
  lastUpdated,
  otherPage,
  children,
}: {
  title: string;
  description: string;
  lastUpdated: string;
  otherPage: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <>
      <Hero size="compact" eyebrow="Legal" title={title} description={description} />
      <Container className="py-14 sm:py-20">
        <div className="max-w-[68ch]">
          <p className="text-sm text-ink/70">Last updated: {lastUpdated}</p>
          <div className="mt-8 space-y-10">{children}</div>
          <nav
            aria-label="Related pages"
            className="mt-12 flex flex-wrap gap-x-6 border-t border-burgundy/15 pt-4"
          >
            <Link href={otherPage.href} className={proseLink}>
              {otherPage.label}
            </Link>
            <Link href="/contact" className={proseLink}>
              Contact us
            </Link>
          </nav>
        </div>
      </Container>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-burgundy-dark">{title}</h2>
      <div className="mt-3 space-y-4 text-lg leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

/** A stand-alone mailto link (its own 44px tap target) for a Contact section.
 * Falls back to the Contact page when no address is configured. */
export function LegalContact({ intro }: { intro: string }) {
  return (
    <>
      <p>{intro}</p>
      <p>
        {SUBMISSIONS_EMAIL ? (
          <a href={`mailto:${SUBMISSIONS_EMAIL}`} className={`${proseLink} break-all`}>
            {SUBMISSIONS_EMAIL}
          </a>
        ) : (
          <Link href="/contact" className={proseLink}>
            Contact page
          </Link>
        )}
      </p>
    </>
  );
}
