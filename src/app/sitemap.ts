import type { MetadataRoute } from "next";

// Still a stub (Phase G). When this is built, location URLs must come from the
// queries in @/lib/queries (they all filter is_published = true), never from a
// raw locations select. The anon-key RLS policy (is_published = true) is the
// backstop, so an unpublished slug cannot appear here even by mistake.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
