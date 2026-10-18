"use client";

import Script from "next/script";
import { ANALYTICS_ID, isNonAnalyticsHost } from "@/lib/consent";
import { useConsent, useHostname } from "@/lib/use-consent";

/** Google Analytics 4, behind the consent gate. It renders nothing, so no
 * script exists on the page, unless ALL of these hold:
 *  - the visitor has accepted;
 *  - NEXT_PUBLIC_ANALYTICS_ID is set and is a valid G- ID (checked in
 *    lib/consent, inlined at build time);
 *  - the hostname, read client-side in an effect, is not a *.vercel.app or
 *    local host, so previews and local runs never send data.
 * Unset and declined visitors never get a script.
 *
 * Privacy settings: Google signals and ad personalization are off. No
 * advertising features, remarketing, User-ID or custom dimensions are used.
 * page_view is not fired by hand. gtag.js sends the first one on config, and
 * GA4's built-in enhanced measurement ("page changes based on browser history
 * events", on by default for web streams) covers App Router navigation.
 *
 * Declining after accepting: this component stops rendering, so nothing
 * further is injected, but a script that is already loaded stays loaded for
 * the rest of the page's life. A full page reload is needed to unload it. */
export function AnalyticsGate() {
  const consent = useConsent();
  const hostname = useHostname();

  if (consent !== "accepted" || !ANALYTICS_ID) return null;
  if (hostname === null || isNonAnalyticsHost(hostname)) return null;

  return (
    <>
      <Script
        id="ga4-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(ANALYTICS_ID)}, {
  allow_google_signals: false,
  allow_ad_personalization_signals: false
});`}
      </Script>
    </>
  );
}
