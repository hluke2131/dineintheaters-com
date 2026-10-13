import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Chip } from "@/components/chip";
import { Container } from "@/components/container";
import { slugify } from "@/lib/format-slug";
import type { LocationDetail } from "@/lib/queries";
import { getShowtimesLink } from "@/lib/showtimes-link";
import {
  alcoholLabel,
  brandLabel,
  cleanAmenities,
  deliveryStyleLabel,
  directionsUrl,
  formatPhone,
  fullAddress,
  getFeatureChips,
  mapsEmbedUrl,
  safeHttpUrl,
  telHref,
  websiteDisplay,
} from "@/lib/theater-display";
import { NOT_YET_CONFIRMED } from "@/lib/theater-fields";
import { getStateBySlug } from "@/lib/us-states";
import type { Database } from "@/lib/supabase/database.types";

type FieldVerificationRow = Database["public"]["Tables"]["field_verification"]["Row"];
type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

const primaryButton =
  "rounded-full bg-burgundy px-6 py-3 font-medium text-cream hover:bg-burgundy-dark";
const secondaryButton =
  "rounded-full border border-burgundy px-6 py-3 font-medium text-burgundy hover:bg-burgundy/5";

function Unconfirmed({ slug }: { slug: string }) {
  return (
    <>
      <span className="text-ink/60">{NOT_YET_CONFIRMED}</span>
      {/* py-3.5 with matching negative margins grows the tap target to 44px
          without changing how tall the details grid is. */}
      <Link
        href={`/add-a-theater?listing=${slug}`}
        className="-mb-3.5 -mt-2.5 block py-3.5 text-xs text-ink/60 underline hover:text-burgundy"
      >
        Know this? Help us verify.
      </Link>
    </>
  );
}

function VerificationCounts({ row }: { row: FieldVerificationRow }) {
  return (
    <p className="mt-1 text-xs text-ink/60">
      {row.confirmed_count} confirmed · {row.disputed_count} disputed
      {" — "}
      <Link href="/login" className="underline hover:text-burgundy">
        Sign in to vote
      </Link>
    </p>
  );
}

/** One row of the details block. A null `value` means "we don't know yet" and
 * renders the muted placeholder with a verify link. */
function DetailRow({
  label,
  value,
  slug,
  verification,
}: {
  label: string;
  value: ReactNode | null;
  slug: string;
  verification?: FieldVerificationRow;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink/60">{label}</dt>
      <dd className="mt-1 text-ink/90">
        {value === null ? <Unconfirmed slug={slug} /> : value}
        {value !== null && verification ? <VerificationCounts row={verification} /> : null}
      </dd>
    </div>
  );
}

function yesNo(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? "Yes" : "No";
}

function formatHours(hours: unknown): ReactNode | null {
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

function StatusBanner({ status }: { status: string }) {
  if (status !== "temporarily_closed" && status !== "permanently_closed") return null;
  const permanent = status === "permanently_closed";

  return (
    <div
      role="status"
      className="mt-6 rounded-xl border border-burgundy bg-burgundy px-5 py-4 text-cream"
    >
      <p className="font-display text-lg">
        {permanent ? "Permanently closed" : "Temporarily closed"}
      </p>
      <p className="mt-1 text-sm text-cream/85">
        {permanent
          ? "This theater has closed for good. We keep the page up for reference."
          : "This theater is currently closed. Check with the theater before you head out."}
      </p>
    </div>
  );
}

export function ListingDetail({
  location,
  reviews,
  cityHubLinked,
}: {
  location: LocationDetail;
  reviews: ReviewRow[];
  /** Whether the listing's city has 3+ published listings and so a hub page
   * worth linking to. When false the breadcrumb stops at the state hub. */
  cityHubLinked: boolean;
}) {
  const { slug } = location;
  const verification = new Map(location.field_verification.map((row) => [row.field_name, row]));
  const stateName = getStateBySlug(location.state)?.name ?? location.state;
  const permanentlyClosed = location.status === "permanently_closed";

  const brand = brandLabel(location);
  const chips = getFeatureChips(location);
  const amenities = cleanAmenities(location.amenities, [
    location.sub_brand,
    location.chain?.name ?? null,
  ]);

  const websiteUrl = safeHttpUrl(location.website_url);
  const showtimesUrl = safeHttpUrl(getShowtimesLink(location.ticketing_url));
  const hoursValue = formatHours(location.hours);
  const hoursLinkUrl = showtimesUrl ?? websiteUrl;
  const hoursFallbackLink = hoursLinkUrl ? (
    <a
      href={hoursLinkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-burgundy"
    >
      Check hours &amp; showtimes
    </a>
  ) : null;
  const phoneHref = location.phone ? telHref(location.phone) : null;
  const embedUrl = mapsEmbedUrl(location);
  const directions = directionsUrl(location);
  const address = fullAddress(location);
  const paragraphs = location.description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <Container className="py-16 sm:py-24">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: stateName, href: `/dine-in-theaters-in/${slugify(location.state)}` },
          ...(cityHubLinked
            ? [
                {
                  label: location.city,
                  href: `/dine-in-theaters-in/${slugify(location.state)}/${slugify(location.city)}`,
                },
              ]
            : []),
          { label: location.name },
        ]}
      />

      <h1 className="mt-4 font-display text-4xl text-burgundy-dark sm:text-5xl">
        {location.name}
      </h1>

      <StatusBanner status={location.status} />

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="At a glance">
        <li>
          <Chip tone="gold">{brand}</Chip>
        </li>
        {chips.map((chip) => (
          <li key={chip}>
            <Chip>{chip}</Chip>
          </li>
        ))}
      </ul>

      {paragraphs.length > 0 ? (
        <div className="mt-8 max-w-[68ch] space-y-5 border-l-4 border-gold pl-5 text-lg leading-relaxed text-ink/85 sm:pl-7 sm:text-xl">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-4">
        <a href={directions} target="_blank" rel="noopener noreferrer" className={primaryButton}>
          Get Directions
        </a>
        {!permanentlyClosed && showtimesUrl ? (
          <a
            href={showtimesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryButton}
          >
            Check Showtimes
          </a>
        ) : null}
        {!permanentlyClosed && !showtimesUrl && websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryButton}
          >
            Visit Theater Website
          </a>
        ) : null}
      </div>

      <section className="mt-12" aria-labelledby="details-heading">
        <h2 id="details-heading" className="font-display text-2xl text-burgundy-dark">
          Details
        </h2>
        <dl className="mt-4 grid gap-6 rounded-xl border border-burgundy/10 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Chain / dining concept" value={brand} slug={slug} />
          <DetailRow
            label="Delivery style"
            value={deliveryStyleLabel(location.delivery_style)}
            slug={slug}
            verification={verification.get("delivery_style")}
          />
          <DetailRow
            label="Alcohol"
            value={alcoholLabel(location.alcohol_served)}
            slug={slug}
            verification={verification.get("alcohol_served")}
          />
          <DetailRow
            label="Menu price range"
            value={location.menu_price_range}
            slug={slug}
            verification={verification.get("menu_price_range")}
          />
          <DetailRow
            label="Reserved recliners"
            value={yesNo(location.reserved_recliners)}
            slug={slug}
            verification={verification.get("reserved_recliners")}
          />
          <DetailRow
            label="21+ auditoriums"
            value={yesNo(location.age_restricted_auditoriums)}
            slug={slug}
          />
          {/* Hours are not collected yet. Until they are, point at the
              theater's own ticketing page (else its website) rather than a
              "help us verify" prompt for data we are not set up to store. */}
          <DetailRow
            label="Hours"
            value={hoursValue ?? hoursFallbackLink}
            slug={slug}
            verification={hoursValue ? verification.get("hours") : undefined}
          />
          <DetailRow
            label="Phone"
            value={
              location.phone ? (
                phoneHref ? (
                  <a href={phoneHref} className="underline hover:text-burgundy">
                    {formatPhone(location.phone)}
                  </a>
                ) : (
                  formatPhone(location.phone)
                )
              ) : null
            }
            slug={slug}
          />
          <DetailRow
            label="Website"
            value={
              websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline hover:text-burgundy"
                >
                  {websiteDisplay(websiteUrl)}
                </a>
              ) : null
            }
            slug={slug}
          />
          <DetailRow label="Address" value={address} slug={slug} />
          <DetailRow
            label="Amenities"
            value={
              amenities.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {amenities.map((amenity) => (
                    <li key={amenity}>
                      <Chip tone="ink">{amenity}</Chip>
                    </li>
                  ))}
                </ul>
              ) : null
            }
            slug={slug}
          />
          {location.accessibility_notes ? (
            <DetailRow label="Accessibility" value={location.accessibility_notes} slug={slug} />
          ) : null}
          {location.parking_notes ? (
            <DetailRow
              label="Parking"
              value={location.parking_notes}
              slug={slug}
              verification={verification.get("parking_notes")}
            />
          ) : null}
          {location.safety_notes ? (
            <DetailRow label="Safety notes" value={location.safety_notes} slug={slug} />
          ) : null}
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="location-heading">
        <h2 id="location-heading" className="font-display text-2xl text-burgundy-dark">
          Location
        </h2>
        {/* GOOGLE_MAPS_EMBED_API_KEY is intentionally unrestricted by HTTP
            referrer for now — restrict it to the production domain in the
            Google Cloud Console as a pre-launch step, once the domain is
            finalized. Without a key we render the address block alone rather
            than an iframe that would show a Google error. */}
        {embedUrl ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-burgundy/10">
            <iframe
              title={`Map showing ${location.name}`}
              src={embedUrl}
              width="100%"
              height="320"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-burgundy/10 bg-white p-6">
          <address className="not-italic text-ink/90">
            <span className="block font-medium text-burgundy-dark">{location.name}</span>
            <span className="block">{location.address}</span>
            <span className="block">
              {location.city}, {location.state}
              {location.zip ? ` ${location.zip}` : ""}
            </span>
          </address>
          <a href={directions} target="_blank" rel="noopener noreferrer" className={primaryButton}>
            Get Directions
          </a>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="font-display text-2xl text-burgundy-dark">
          Reviews
        </h2>
        {reviews.length > 0 ? (
          <ul className="mt-6 space-y-6">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-burgundy/10 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-lg text-burgundy-dark">
                    {review.title || "Review"}
                  </p>
                  <span aria-label={`${review.rating} out of 5 stars`} className="text-gold-text">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <p className="mt-2 text-ink/80">{review.review_text}</p>
                <p className="mt-3 text-sm text-ink/60">
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
