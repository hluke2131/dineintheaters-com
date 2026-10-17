import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/queries";
import { absoluteUrl as abs } from "@/lib/structured-data";

// Prerendered, then rebuilt at most once an hour. The sitemap reads through a
// cookie-free client (see getSitemapData), so it reads no request data and
// forces nothing else dynamic.
export const revalidate = 3600;

// Indexable pages only. /add-a-theater and /login are noindex, and filtered or
// paged directory URLs are never listed. /blog is indexable today and has no
// posts yet, so only the index is listed; add posts here when they exist.
const STATIC_PATHS = [
  "/",
  "/dine-in-theaters",
  "/dine-in-theaters-in",
  "/about-us",
  "/contact",
  "/privacy",
  "/terms",
  "/blog",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { listings, states, cities } = await getSitemapData();

  return [
    ...STATIC_PATHS.map((path) => ({ url: abs(path) })),
    ...states.map((state) => ({ url: abs(`/dine-in-theaters-in/${state}`) })),
    ...cities.map((city) => ({ url: abs(`/dine-in-theaters-in/${city.state}/${city.slug}`) })),
    ...listings.map((listing) => ({
      url: abs(`/dine-in-theaters/${listing.slug}`),
      lastModified: new Date(listing.updatedAt),
    })),
  ];
}
