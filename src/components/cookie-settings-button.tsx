"use client";

import { setConsent } from "@/lib/consent";

/** Footer control that forgets the stored choice, which brings the banner
 * back. The footer renders it only when the consent UI is enabled. */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => setConsent("unset")}
      className="inline-flex min-h-11 min-w-11 items-center text-sm text-cream/80 hover:text-cream"
    >
      Cookie settings
    </button>
  );
}
