"use client";

import { consentUiAllowedOnHost, setConsent } from "@/lib/consent";
import { useHostname } from "@/lib/use-consent";

/** Footer control that forgets the stored choice, which brings the banner
 * back. The footer renders it only when the consent UI is enabled at build
 * time; on top of that it follows the banner's hostname rule (hidden on
 * *.vercel.app and localhost when an analytics ID is set, unless the banner is
 * forced), decided in an effect so the server HTML never contains it. */
export function CookieSettingsButton() {
  const hostname = useHostname();
  if (hostname === null || !consentUiAllowedOnHost(hostname)) return null;

  return (
    <li>
      <button
        type="button"
        onClick={() => setConsent("unset")}
        className="inline-flex min-h-11 min-w-11 items-center text-sm text-cream/80 hover:text-cream"
      >
        Cookie settings
      </button>
    </li>
  );
}
