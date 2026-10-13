import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { getListingLabel } from "@/lib/queries";
import { currentSlugFor } from "@/lib/slug-redirects";
import { SITE_URL, SUBMISSIONS_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Add a Theater",
  description: "Suggest a dine-in movie theater to add to the directory, or send a correction.",
  // A shell with no form yet; nothing here is worth a search result.
  robots: { index: false, follow: true },
};

const contactButton =
  "inline-block rounded-full bg-burgundy px-6 py-3 font-medium text-cream hover:bg-burgundy-dark";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AddATheaterPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string | string[] }>;
}) {
  const { listing } = await searchParams;
  const slug = firstValue(listing)?.trim();
  // Unknown and unpublished slugs both come back null and fall through to the
  // generic page, so this never confirms that an unpublished listing exists.
  // A slug that was renamed is looked up under its current slug (the redirect
  // map only holds published rows, and getListingLabel re-checks that).
  let target = null;
  if (slug) {
    target = await getListingLabel(slug);
    if (!target) {
      const renamed = currentSlugFor(slug);
      if (renamed) target = await getListingLabel(renamed);
    }
  }

  const subject = target
    ? `Correction: ${target.name} (${target.city}, ${target.state})`
    : "Theater suggestion";
  const body = target
    ? `Listing: ${SITE_URL}/dine-in-theaters/${target.slug}\n\nWhat needs updating:\n`
    : "Theater name and address:\n\nWhat you can order (at your seat or at the counter):\n";
  const mailtoHref = SUBMISSIONS_EMAIL
    ? `mailto:${SUBMISSIONS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <Container className="py-16 sm:py-24">
      <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold-text">
        {target ? "Suggest a Correction" : "Suggest a Listing"}
      </p>
      <h1 className="mt-2 font-display text-4xl text-burgundy-dark sm:text-5xl">Add a Theater</h1>

      {target ? (
        <div className="mt-6 max-w-2xl rounded-xl border border-burgundy/10 bg-white p-5">
          <p className="text-sm font-medium uppercase tracking-wide text-ink/60">
            Correction for
          </p>
          <p className="mt-1 font-display text-xl text-burgundy-dark">{target.name}</p>
          <p className="text-ink/70">
            {target.city}, {target.state}
          </p>
          <Link
            href={`/dine-in-theaters/${target.slug}`}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-burgundy underline hover:text-burgundy-dark"
          >
            Back to this listing
          </Link>
        </div>
      ) : null}

      <div className="mt-6 max-w-2xl space-y-4 text-lg text-ink/70">
        <p>
          A submission form is on the way. It will let you suggest a dine-in theater we&rsquo;re
          missing and confirm or dispute the details on a listing we already have.
        </p>
        <p>
          Until it&rsquo;s live, the quickest way to tell us is to{" "}
          {mailtoHref ? (
            <a href={mailtoHref} className="font-medium text-burgundy underline hover:text-burgundy-dark">
              email us
            </a>
          ) : (
            <Link href="/contact" className="font-medium text-burgundy underline hover:text-burgundy-dark">
              get in touch
            </Link>
          )}
          .{" "}
          {target
            ? `Tell us which detail on ${target.name} is wrong and what you saw.`
            : "Include the theater's name and address, and what you can order at your seat or at the counter."}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        {mailtoHref ? (
          <a href={mailtoHref} className={contactButton}>
            Email us
          </a>
        ) : (
          <Link href="/contact" className={contactButton}>
            Contact us
          </Link>
        )}
        <Link
          href="/dine-in-theaters"
          className="inline-block rounded-full border border-burgundy px-6 py-3 font-medium text-burgundy hover:bg-burgundy/5"
        >
          Browse theaters
        </Link>
      </div>

      {mailtoHref ? (
        <p className="mt-6 max-w-2xl text-ink/70">
          Have a different question, like sponsorship or something else?{" "}
          <Link href="/contact" className="font-medium text-burgundy underline hover:text-burgundy-dark">
            Contact us
          </Link>
          .
        </p>
      ) : null}
    </Container>
  );
}
