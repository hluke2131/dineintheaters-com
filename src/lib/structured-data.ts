import { slugify } from "@/lib/format-slug";
import type { BreadcrumbItem } from "@/components/breadcrumb";
import type { LocationDetail } from "@/lib/queries";
import { SITE_URL } from "@/lib/site-config";
import { MENU_PRICE_RANGES } from "@/lib/theater-fields";
import { safeHttpUrl } from "@/lib/theater-display";

// JSON-LD builders. Everything here is a pure function of data the page already
// has: no Host header, no request-time APIs, so pages stay as static (or as
// dynamic) as they were. A property is added only when real data backs it;
// nothing is defaulted or guessed.

export type JsonLdObject = Record<string, unknown>;

/** Serializes for embedding in a <script> tag. `<` is escaped so stored text
 * such as "</script>" can never close the tag; U+2028/2029 are escaped
 * because they are line terminators in older script parsers. */
export function jsonLdString(data: JsonLdObject): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

function usPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return null;
  return `+1-${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}

function hasCoordinates(lat: number | null, lng: number | null): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export function movieTheaterJsonLd(
  location: Pick<
    LocationDetail,
    | "slug"
    | "name"
    | "address"
    | "city"
    | "state"
    | "zip"
    | "lat"
    | "lng"
    | "phone"
    | "website_url"
    | "menu_price_range"
  >
): JsonLdObject {
  const address: JsonLdObject = {
    "@type": "PostalAddress",
    streetAddress: location.address,
    addressLocality: location.city,
    addressRegion: location.state,
    addressCountry: "US",
  };
  if (location.zip) address.postalCode = location.zip;

  const data: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "MovieTheater",
    name: location.name,
    url: absoluteUrl(`/dine-in-theaters/${location.slug}`),
    address,
  };

  if (hasCoordinates(location.lat, location.lng)) {
    data.geo = { "@type": "GeoCoordinates", latitude: location.lat, longitude: location.lng };
  }
  const telephone = usPhone(location.phone);
  if (telephone) data.telephone = telephone;
  const website = safeHttpUrl(location.website_url);
  if (website) data.sameAs = [website];
  if (
    location.menu_price_range &&
    (MENU_PRICE_RANGES as readonly string[]).includes(location.menu_price_range)
  ) {
    data.priceRange = location.menu_price_range;
  }

  return data;
}

/** BreadcrumbList for the same items the visible breadcrumb renders. The last
 * item is the current page and, as on the page, has no link; it is listed
 * without an `item` URL, which schema.org and Google both allow for the final
 * crumb. */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "DineInTheaters.com",
    url: SITE_URL,
  };
}

/** No SearchAction: the site has no search endpoint. */
export function webSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "DineInTheaters.com",
    url: SITE_URL,
  };
}

/** Breadcrumb trail for a listing, shared by the visible breadcrumb and the
 * JSON-LD so the two cannot drift. */
export function listingBreadcrumbItems(
  location: Pick<LocationDetail, "state" | "city" | "name">,
  stateName: string,
  cityHubLinked: boolean
): BreadcrumbItem[] {
  return [
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
  ];
}
