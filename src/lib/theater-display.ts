import type { Database } from "@/lib/supabase/database.types";
import { ALCOHOL_SERVED_LABELS, DELIVERY_STYLE_LABELS, getLabel } from "@/lib/theater-fields";

type LocationRow = Database["public"]["Tables"]["locations"]["Row"];

export type FeatureSource = Pick<
  LocationRow,
  "delivery_style" | "alcohol_served" | "menu_price_range" | "reserved_recliners"
>;
export type BrandSource = Pick<LocationRow, "sub_brand"> & { chain: { name: string } | null };
export type AddressSource = Pick<
  LocationRow,
  "address" | "city" | "state" | "zip" | "lat" | "lng"
>;

// The helpers below return null for "unknown" / null values rather than a
// label, so callers must decide how to present a missing value ("Not yet
// confirmed" etc.) and the raw enum value can't leak onto a page.

export function deliveryStyleLabel(value: string): string | null {
  if (value === "unknown") return null;
  return getLabel(DELIVERY_STYLE_LABELS, value);
}

export function alcoholLabel(value: string): string | null {
  if (value === "unknown") return null;
  return getLabel(ALCOHOL_SERVED_LABELS, value);
}

/** "Cinemark · Studio Eats", "Alamo Drafthouse", or "Independent". */
export function brandLabel({ chain, sub_brand }: BrandSource): string {
  const chainName = chain?.name.trim();
  const subBrand = sub_brand?.trim();
  const isIndependent = !chainName || chainName.toLowerCase() === "independent";

  if (isIndependent) return subBrand || "Independent";
  if (!subBrand || subBrand.toLowerCase() === chainName.toLowerCase()) return chainName;
  return `${chainName} · ${subBrand}`;
}

/** The at-a-glance chips shared by listing pages and directory cards, in
 * display order. Only confirmed values produce a chip, and only alcohol that
 * is actually served (a "no alcohol" chip is noise, not a feature). */
export function getFeatureChips(location: FeatureSource): string[] {
  const chips: string[] = [];

  if (location.delivery_style === "in_seat_delivery" || location.delivery_style === "counter_pickup") {
    chips.push(DELIVERY_STYLE_LABELS[location.delivery_style]);
  }
  if (location.alcohol_served === "full_bar" || location.alcohol_served === "beer_wine") {
    chips.push(ALCOHOL_SERVED_LABELS[location.alcohol_served]);
  }
  if (location.menu_price_range) {
    chips.push(location.menu_price_range);
  }
  if (location.reserved_recliners === true) {
    chips.push("Reserved recliners");
  }

  return chips;
}

export function fullAddress({ address, city, state, zip }: AddressSource): string {
  return `${address}, ${city}, ${state}${zip ? ` ${zip}` : ""}`;
}

/** Google Maps directions link. Prefers the stored coordinates (they point at
 * the exact entrance Google resolved) and falls back to the street address. */
export function directionsUrl(location: AddressSource): string {
  const hasCoordinates =
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    !(location.lat === 0 && location.lng === 0);
  const destination = hasCoordinates
    ? `${location.lat},${location.lng}`
    : fullAddress(location);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Google Maps Embed URL, or null when GOOGLE_MAPS_EMBED_API_KEY is not set
 * (callers render an address block instead of a broken iframe). */
export function mapsEmbedUrl(location: AddressSource): string | null {
  const key = process.env.GOOGLE_MAPS_EMBED_API_KEY?.trim();
  if (!key) return null;
  const query = `${location.lat},${location.lng}`;
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}`;
}

/** Returns the URL if it's a well-formed http(s) URL, otherwise null. These
 * come from scraped data, so never render an href that isn't http(s). */
export function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function websiteDisplay(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "2254120410" / "+1 225-412-0410" → "(225) 412-0410". Anything that isn't a
 * plain 10-digit US number is shown as stored. Display-only. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return phone;
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : null;
}

const ABBREVIATIONS = new Set([
  "st", "mt", "ft", "dr", "ave", "blvd", "rd", "inc", "co", "corp", "ltd", "jr", "sr", "vs", "no",
]);

/** First sentence(s) of a description, up to ~`max` characters, for use as a
 * meta description. Never splits on common abbreviations ("St. Louis"). */
export function metaDescription(description: string, max = 160): string {
  const text = description.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  let end = 0;
  const boundary = /[.!?]["')\]]?(?=\s)/g;
  for (let match = boundary.exec(text); match; match = boundary.exec(text)) {
    const candidate = match.index + match[0].length;
    const lastWord = text.slice(0, match.index).split(" ").pop()?.toLowerCase() ?? "";
    const isAbbreviation = ABBREVIATIONS.has(lastWord) || /^[a-z]$/.test(lastWord);
    if (isAbbreviation && match[0].startsWith(".")) continue;
    if (candidate > max) break;
    end = candidate;
  }
  if (end > 0) return text.slice(0, end).trim();

  const clipped = text.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).replace(/[\s,;:.-]+$/, "")}…`;
}

/** Case-insensitive de-duplication of amenity strings, dropping any that just
 * repeat the sub-brand / chain name (the data holds e.g. both "Full Bar" and
 * "full bar", and sub-brand names inside amenities). Display-only. */
export function cleanAmenities(amenities: string[] | null, exclude: (string | null)[]): string[] {
  const skip = new Set(exclude.filter(Boolean).map((value) => value!.trim().toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of amenities ?? []) {
    const label = raw.trim();
    const key = label.toLowerCase();
    if (!label || skip.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}
