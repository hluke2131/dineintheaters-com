import slugRedirects from "@/data/slug-redirects.json";

/** Old listing slug -> current slug, for published rows only. The same file
 * drives the 308 redirects in next.config.ts. */
export const SLUG_REDIRECTS: Readonly<Record<string, string>> = slugRedirects;

/** The current slug for an old one, or null when it is not a renamed slug. */
export function currentSlugFor(oldSlug: string): string | null {
  return Object.prototype.hasOwnProperty.call(SLUG_REDIRECTS, oldSlug) ? SLUG_REDIRECTS[oldSlug] : null;
}
