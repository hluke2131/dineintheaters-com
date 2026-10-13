import type { Metadata } from "next";
import { headers } from "next/headers";
import { isNoindexHost } from "@/lib/noindex-hosts";

/** Page-level robots meta, overridden to "noindex, nofollow" when the request
 * host is a *.vercel.app deployment. Every page's generateMetadata passes its
 * own robots value through here so a page that sets `robots` (a thin hub, a
 * filtered directory) cannot undo the host guard by overriding the layout's.
 *
 * Reading the Host header makes the page dynamic, which is intended: the same
 * build is served on both hosts and must answer differently.
 *
 * This is paired with the X-Robots-Tag response header in next.config.ts. Do
 * not add a robots.txt Disallow for these hosts: a blocked crawler never
 * fetches the page, so it would never see the noindex. */
export async function resolveRobots(
  pageRobots?: Metadata["robots"]
): Promise<Metadata["robots"]> {
  const host = (await headers()).get("host");
  return isNoindexHost(host) ? { index: false, follow: false } : pageRobots;
}
