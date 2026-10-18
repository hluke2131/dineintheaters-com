"use client";

import { useEffect, useState } from "react";
import { getConsent, subscribeConsent, type Consent } from "@/lib/consent";

/** The visitor's consent choice, or null until it has been read. Reading
 * happens in an effect, so the server render and the first client render agree
 * (both see null) and nothing shifts or mismatches on hydration. */
export function useConsent(): Consent | null {
  const [consent, setConsentState] = useState<Consent | null>(null);

  useEffect(() => {
    const sync = () => setConsentState(getConsent());
    sync();
    return subscribeConsent(sync);
  }, []);

  return consent;
}

/** window.location.hostname, or null until an effect has read it. Never taken
 * from request headers: that would make every page dynamic. */
export function useHostname(): string | null {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setHostname(window.location.hostname);
    read();
  }, []);

  return hostname;
}
