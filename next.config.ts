import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Every *.vercel.app deployment (the production alias and each
        // preview) is told not to be indexed or followed. This header is the
        // only noindex mechanism for those hosts: it is evaluated by the
        // router, not by page rendering, so it costs nothing and keeps static
        // pages static. Other hosts (dineintheaters.com, www, localhost) get
        // nothing added. Do not add a robots.txt Disallow for these hosts: a
        // blocked crawler never fetches the page, so it would never see this.
        // Next anchors the value as ^...$ against the host (no port).
        source: "/:path*",
        has: [{ type: "host", value: ".*\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
