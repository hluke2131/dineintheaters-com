import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/container";
import { formatSlug, slugify } from "@/lib/format-slug";
import { getLocationBySlug, getReviewsByLocationId } from "@/lib/queries";
import { getShowtimesLink } from "@/lib/showtimes-link";
import {
  ALCOHOL_SERVED_LABELS,
  DELIVERY_STYLE_LABELS,
  VERIFIABLE_FIELD_LABELS,
  getLabel,
  type VerifiableField,
} from "@/lib/theater-fields";
import type { Database } from "@/lib/supabase/database.types";

type Params = { slug: string };
type FieldVerificationRow = Database["public"]["Tables"]["field_verification"]["Row"];

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) {
    return { title: formatSlug(slug) };
  }
  return {
    title: location.name,
    description: `Theater details, hours, and amenities for ${location.name} in ${location.city}, ${location.state}.`,
  };
}

function yesNoOrUnspecified(value: boolean | null) {
  if (value === null) return "Not specified";
  return value ? "Yes" : "No";
}

function VerifyStatus({
  fieldVerification,
  slug,
}: {
  fieldVerification: FieldVerificationRow | undefined;
  slug: string;
}) {
  if (fieldVerification) {
    return (
      <p className="mt-1 text-xs text-ink/50">
        {fieldVerification.confirmed_count} confirmed · {fieldVerification.disputed_count} disputed
        {" — "}
        <Link href="/login" className="underline hover:text-burgundy">
          Sign in to vote
        </Link>
      </p>
    );
  }

  return (
    <p className="mt-1 text-xs text-ink/50">
      <Link href={`/add-a-theater?listing=${slug}`} className="underline hover:text-burgundy">
        Know this? Help us verify.
      </Link>
    </p>
  );
}

function DetailField({
  label,
  value,
  verifiableField,
  fieldVerification,
  slug,
}: {
  label: string;
  value: ReactNode;
  verifiableField?: VerifiableField;
  fieldVerification?: FieldVerificationRow;
  slug: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="mt-1 text-ink/90">{value}</dd>
      {verifiableField ? (
        <VerifyStatus fieldVerification={fieldVerification} slug={slug} />
      ) : null}
    </div>
  );
}

function formatHours(hours: unknown): ReactNode {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const entries = Object.entries(hours as Record<string, unknown>).filter(
    ([, value]) => typeof value === "string"
  ) as [string, string][];
  if (entries.length === 0) return null;

  return (
    <ul className="space-y-0.5">
      {entries.map(([day, value]) => (
        <li key={day}>
          <span className="capitalize">{day}</span>: {value}
        </li>
      ))}
    </ul>
  );
}

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);

  if (!location) {
    notFound();
  }

  const reviews = await getReviewsByLocationId(location.id);

  const verificationByField = new Map(
    location.field_verification.map((row) => [row.field_name, row])
  );
  const showtimesLink = getShowtimesLink(location.ticketing_url);
  const chainLabel = location.chain
    ? location.sub_brand
      ? `${location.chain.name} — ${location.sub_brand}`
      : location.chain.name
    : "Independent";
  const hoursDisplay = formatHours(location.hours);

  return (
    <Container className="py-16 sm:py-24">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: location.state, href: `/dine-in-theaters-in/${slugify(location.state)}` },
          {
            label: location.city,
            href: `/dine-in-theaters-in/${slugify(location.state)}/${slugify(location.city)}`,
          },
          { label: location.name },
        ]}
      />

      <h1 className="mt-4 font-display text-4xl text-burgundy-dark sm:text-5xl">
        {location.name}
      </h1>
      <p className="mt-2 text-ink/60">
        {location.address}, {location.city}, {location.state} {location.zip}
      </p>

      {location.description ? (
        <p className="mt-6 max-w-3xl text-lg text-ink/80">{location.description}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-4">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-burgundy px-6 py-3 font-medium text-cream hover:bg-burgundy-dark"
        >
          Get Directions
        </a>
        {showtimesLink ? (
          <a
            href={showtimesLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-burgundy px-6 py-3 font-medium text-burgundy hover:bg-burgundy/5"
          >
            Check Showtimes
          </a>
        ) : null}
      </div>

      {/* GOOGLE_MAPS_EMBED_API_KEY is intentionally unrestricted by HTTP
          referrer for now — restrict it to the production domain in the
          Google Cloud Console as a pre-launch step, once the domain is
          finalized. */}
      <div className="mt-8 overflow-hidden rounded-xl border border-burgundy/10">
        <iframe
          title={`Map showing ${location.name}`}
          src={`https://www.google.com/maps/embed/v1/place?key=${process.env.GOOGLE_MAPS_EMBED_API_KEY ?? ""}&q=${location.lat},${location.lng}`}
          width="100%"
          height="320"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <dl className="mt-12 grid gap-6 rounded-xl border border-burgundy/10 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Chain" value={chainLabel} slug={slug} />
        <DetailField
          label={VERIFIABLE_FIELD_LABELS.delivery_style}
          value={getLabel(DELIVERY_STYLE_LABELS, location.delivery_style)}
          verifiableField="delivery_style"
          fieldVerification={verificationByField.get("delivery_style")}
          slug={slug}
        />
        <DetailField
          label={VERIFIABLE_FIELD_LABELS.alcohol_served}
          value={getLabel(ALCOHOL_SERVED_LABELS, location.alcohol_served)}
          verifiableField="alcohol_served"
          fieldVerification={verificationByField.get("alcohol_served")}
          slug={slug}
        />
        <DetailField
          label="Age-Restricted Auditoriums"
          value={yesNoOrUnspecified(location.age_restricted_auditoriums)}
          slug={slug}
        />
        <DetailField
          label={VERIFIABLE_FIELD_LABELS.reserved_recliners}
          value={yesNoOrUnspecified(location.reserved_recliners)}
          verifiableField="reserved_recliners"
          fieldVerification={verificationByField.get("reserved_recliners")}
          slug={slug}
        />
        <DetailField
          label={VERIFIABLE_FIELD_LABELS.menu_price_range}
          value={location.menu_price_range ?? "Not specified"}
          verifiableField="menu_price_range"
          fieldVerification={verificationByField.get("menu_price_range")}
          slug={slug}
        />
        <DetailField
          label="Amenities"
          value={location.amenities?.length ? location.amenities.join(", ") : "None listed"}
          slug={slug}
        />
        <DetailField
          label={VERIFIABLE_FIELD_LABELS.hours}
          value={hoursDisplay ?? "Not specified"}
          verifiableField="hours"
          fieldVerification={verificationByField.get("hours")}
          slug={slug}
        />
        <DetailField
          label="Accessibility"
          value={location.accessibility_notes ?? "Not specified"}
          slug={slug}
        />
        <DetailField
          label={VERIFIABLE_FIELD_LABELS.parking_notes}
          value={location.parking_notes ?? "Not specified"}
          verifiableField="parking_notes"
          fieldVerification={verificationByField.get("parking_notes")}
          slug={slug}
        />
        <DetailField
          label="Safety Notes"
          value={location.safety_notes ?? "Not specified"}
          slug={slug}
        />
      </dl>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-burgundy-dark">Reviews</h2>
        {reviews.length > 0 ? (
          <ul className="mt-6 space-y-6">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-burgundy/10 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-lg text-burgundy-dark">
                    {review.title || "Review"}
                  </p>
                  <span aria-label={`${review.rating} out of 5 stars`} className="text-gold">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <p className="mt-2 text-ink/80">{review.review_text}</p>
                <p className="mt-3 text-sm text-ink/50">
                  {review.reviewer_name || "Anonymous"}
                  {review.visit_date
                    ? ` · Visited ${new Date(review.visit_date).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink/60">No reviews yet.</p>
        )}
      </section>

      <div className="mt-12 rounded-xl border border-dashed border-burgundy/25 bg-burgundy/5 p-6 text-center">
        <p className="font-display text-lg text-burgundy-dark">
          See something that needs updating?
        </p>
        <Link
          href={`/add-a-theater?listing=${location.slug}`}
          className="mt-3 inline-block rounded-full bg-burgundy px-5 py-2.5 font-medium text-cream hover:bg-burgundy-dark"
        >
          Suggest a Correction
        </Link>
      </div>
    </Container>
  );
}
