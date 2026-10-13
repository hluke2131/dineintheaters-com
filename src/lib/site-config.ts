/** The one canonical origin. Every canonical URL and any absolute URL in
 * metadata is resolved against this (via metadataBase in the root layout),
 * never against the request host, so a *.vercel.app deployment can never
 * advertise itself as the canonical home of a page. */
export const SITE_URL = "https://dineintheaters.com";

/** Public address that theater suggestions and corrections go to while the
 * submission form is not built. Empty until the site has a real mailbox; the
 * Add a Theater page sends people to /contact instead while this is blank, so
 * no placeholder address is ever published. */
export const SUBMISSIONS_EMAIL = "";
