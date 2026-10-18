// Visitor consent for optional analytics. Plain module (no React), safe to
// import from server or client code.
//
// The choice lives in localStorage under one key, never in a cookie. Declined
// or unset both mean "do not load or inject any analytics or marketing script,
// ever"; only an explicit "accepted" lifts that.

export type Consent = "unset" | "accepted" | "declined";

export const CONSENT_STORAGE_KEY = "dit-consent";

/** The GA4 measurement ID, only if NEXT_PUBLIC_ANALYTICS_ID is set and looks
 * like one (G- followed by capitals and digits). Anything else counts as "no
 * analytics configured", so a typo can never turn on the banner, the privacy
 * wording or a script tag. Next inlines NEXT_PUBLIC_* at build time. */
const RAW_ANALYTICS_ID = process.env.NEXT_PUBLIC_ANALYTICS_ID;
export const ANALYTICS_ID: string | undefined =
  RAW_ANALYTICS_ID && /^G-[A-Z0-9]+$/.test(RAW_ANALYTICS_ID) ? RAW_ANALYTICS_ID : undefined;

const FORCE_CONSENT_BANNER = process.env.NEXT_PUBLIC_FORCE_CONSENT_BANNER === "1";

/** Whether the consent UI (banner and footer "Cookie settings" control) exists
 * at all. Resolved at build time from NEXT_PUBLIC_* variables, which Next
 * inlines, so it needs no request data and keeps pages static. With neither
 * variable set the UI is never rendered and nothing changes for visitors.
 * NEXT_PUBLIC_FORCE_CONSENT_BANNER=1 lets the banner be reviewed on a preview
 * before an analytics ID exists. */
export const CONSENT_UI_ENABLED = Boolean(ANALYTICS_ID) || FORCE_CONSENT_BANNER;

/** Whether this hostname may never send analytics: every *.vercel.app
 * deployment (production alias and previews) and local runs. Takes a hostname
 * (no port); callers read window.location.hostname in an effect, never from
 * request headers, so pages stay static. */
export function isNonAnalyticsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]"
  );
}

/** Whether the banner and footer control are worth showing on this host: with
 * an analytics ID configured they are pointless where analytics can never
 * load (previews, local runs), unless NEXT_PUBLIC_FORCE_CONSENT_BANNER=1 so
 * the banner can still be reviewed there. */
export function consentUiAllowedOnHost(hostname: string): boolean {
  if (!CONSENT_UI_ENABLED) return false;
  if (FORCE_CONSENT_BANNER) return true;
  return !(ANALYTICS_ID && isNonAnalyticsHost(hostname));
}

const CHANGE_EVENT = "dit-consent-change";

// If storage throws (private windows, blocked site data), the choice is held
// here for the rest of the page's life so the banner still behaves.
let memoryFallback: Consent = "unset";

function parse(value: string | null): Consent {
  return value === "accepted" || value === "declined" ? value : "unset";
}

/** Current choice. "unset" on the server and whenever nothing is stored. */
export function getConsent(): Consent {
  if (typeof window === "undefined") return "unset";
  try {
    return parse(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return memoryFallback;
  }
}

/** Stores a choice ("unset" clears it) and tells subscribers. */
export function setConsent(value: Consent): void {
  if (typeof window === "undefined") return;
  memoryFallback = value;
  try {
    if (value === "unset") window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    else window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    // Storage unavailable: memoryFallback above still carries the choice.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls `listener` whenever the choice changes, in this tab (our own event)
 * or another (the storage event). Returns an unsubscribe function. */
export function subscribeConsent(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
