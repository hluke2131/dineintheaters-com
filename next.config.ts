import type { NextConfig } from "next";
import { NOINDEX_HOST_PATTERN } from "./src/lib/noindex-hosts";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Every *.vercel.app deployment (production alias and previews) is
        // told not to be indexed or followed. The robots meta tag is set
        // per page in src/lib/indexing.ts; this header also covers non-HTML
        // responses and error pages. Other hosts get nothing added.
        source: "/:path*",
        has: [{ type: "host", value: NOINDEX_HOST_PATTERN }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
