"use client";

import { useConsent } from "@/lib/use-consent";

/** The single place analytics may be loaded. It renders nothing unless the
 * visitor has accepted AND NEXT_PUBLIC_ANALYTICS_ID is set (inlined at build
 * time), so unset and declined visitors never get a script.
 *
 * No provider is chosen yet. When one is, inject its script at the marked spot
 * below and delete the marker element.
 *
 * Declining after accepting: this component stops rendering, so nothing
 * further is injected, but a script that is already loaded stays loaded for
 * the rest of the page's life. A full page reload is needed to unload it. */
export function AnalyticsGate() {
  const consent = useConsent();
  const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID;

  if (consent !== "accepted" || !analyticsId) return null;

  return (
    <>
      {/* ===== ANALYTICS PROVIDER PLACEHOLDER =====
          Inject the chosen provider's script here (for example with
          next/script). Reaching this point means consent is accepted and an
          ID is configured. Marker only; no real script is loaded. */}
      <span hidden data-analytics-gate="open" />
    </>
  );
}
