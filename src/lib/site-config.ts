/** The one canonical origin. Every canonical URL and any absolute URL in
 * metadata is resolved against this (via metadataBase in the root layout),
 * never against the request host, so a *.vercel.app deployment can never
 * advertise itself as the canonical home of a page. */
export const SITE_URL = "https://dineintheaters.com";

/** Public address for theater suggestions, corrections, sponsorship and
 * general questions while there is no submission form. This is the only place
 * the address is written down: /add-a-theater and /contact both read it. If
 * it is ever set to "" they fall back to pointing at /contact and no address
 * is published. */
export const SUBMISSIONS_EMAIL = "hello@dineintheaters.com";
