import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

// Allow everything and point at the sitemap. No Disallow rules, ever: noindex
// for *.vercel.app is the X-Robots-Tag header in next.config.ts, and a crawler
// blocked here would never fetch a page to see it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
