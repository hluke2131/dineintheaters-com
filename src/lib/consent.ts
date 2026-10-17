// Visitor consent for optional analytics. Plain module (no React), safe to
// import from server or client code.
//
// The choice lives in localStorage under one key, never in a cookie. Declined
// or unset both mean "do not load or inject any analytics or marketing script,
// ever"; only an explicit "accepted" lifts that.

export type Consent = "unset" | "accepted" | "declined";

export const CONSENT_STORAGE_KEY = "dit-consent";

/** Whether the consent UI (banner and footer "Cookie settings" control) exists
 * at all. Resolved at build time from NEXT_PUBLIC_* variables, which Next
 * inlines, so it needs no request data and keeps pages static. With neither
 * variable set the UI is never rendered and nothing changes for visitors.
 * NEXT_PUBLIC_FORCE_CONSENT_BANNER=1 lets the banner be reviewed on a preview
 * before an analytics ID exists. */
export const CONSENT_UI_ENABLED =
  Boolean(process.env.NEXT_PUBLIC_ANALYTICS_ID) ||
  process.env.NEXT_PUBLIC_FORCE_CONSENT_BANNER === "1";

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
