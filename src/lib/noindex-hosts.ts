// Which request hosts must never be indexed. Pure (no framework imports) so
// next.config.ts, which sets the X-Robots-Tag header, and the metadata helper
// in indexing.ts, which sets the robots meta tag, share one definition.

/** Matches every *.vercel.app host: the production alias
 * (dine-in-theaters.vercel.app) and each branch/commit preview deployment.
 * Used as the `has: host` pattern in next.config.ts, where Next anchors it
 * as ^...$. */
export const NOINDEX_HOST_PATTERN = ".*\\.vercel\\.app";

/** True for a Host header value (port allowed) on a non-canonical host that
 * crawlers must be told to ignore. dineintheaters.com, www.dineintheaters.com
 * and localhost are all false. */
export function isNoindexHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.trim().toLowerCase().split(":")[0];
  return new RegExp(`^${NOINDEX_HOST_PATTERN}$`).test(hostname);
}
