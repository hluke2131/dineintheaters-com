import type { MetadataRoute } from "next";
import { BLOG_POSTS, HAS_PUBLISHED_POSTS } from "@/lib/blog";
import { getSitemapData } from "@/lib/queries";
import { absoluteUrl as abs } from "@/lib/structured-data";

// Prerendered, then rebuilt at most once an hour. The sitemap reads through a
// cookie-free client (see getSitemapData), so it reads no request data and
// forces nothing else dynamic.
export const revalidate = 3600;

// Indexable pages only. /add-a-theater, /login and (until its first post)
// /blog are noindex, and filtered or paged directory URLs are never listed.
const STATIC_PATHS = [
  "/",
  "/dine-in-theaters",
  "/dine-in-theaters-in",
  "/about-us",
  "/contact",
  "/privacy",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { listings, states, cities } = await getSitemapData();

  return [
    ...STATIC_PATHS.map((path) => ({ url: abs(path) })),
    // Same flag the blog index uses for its robots metadata, so the two flip
    // together when the first post is published.
    ...(HAS_PUBLISHED_POSTS
      ? [
          { url: abs("/blog") },
          ...BLOG_POSTS.map((post) => ({
            url: abs(`/blog/${post.slug}`),
            lastModified: new Date(post.updatedAt),
          })),
        ]
      : []),
    ...states.map((state) => ({ url: abs(`/dine-in-theaters-in/${state}`) })),
    ...cities.map((city) => ({ url: abs(`/dine-in-theaters-in/${city.state}/${city.slug}`) })),
    ...listings.map((listing) => ({
      url: abs(`/dine-in-theaters/${listing.slug}`),
      lastModified: new Date(listing.updatedAt),
    })),
  ];
}
