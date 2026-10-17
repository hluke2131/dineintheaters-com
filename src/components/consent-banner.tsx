"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CONSENT_UI_ENABLED, setConsent } from "@/lib/consent";
import { useConsent } from "@/lib/use-consent";

// Both choices share one style on purpose: equal visual prominence.
const choiceButton =
  "inline-flex min-h-11 min-w-24 items-center justify-center rounded-full bg-gold px-4 text-sm font-medium text-ink hover:bg-cream sm:min-w-28 sm:px-6";

/** Bottom consent bar. Renders nothing on the server and on first paint; it
 * appears only after an effect has read localStorage and found no choice, and
 * only when the consent UI is enabled at build time. It is a non-modal dialog
 * (no focus trap, Escape does nothing, focus is never moved to it).
 *
 * While it is showing, an in-flow spacer of the same height sits at the end of
 * the page so the footer can always be scrolled fully above the bar. */
export function ConsentBanner() {
  const consent = useConsent();
  const visible = CONSENT_UI_ENABLED && consent === "unset";
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const bar = barRef.current;
    if (!visible || !bar) {
      setHeight(0);
      return;
    }
    const measure = () => setHeight(bar.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div aria-hidden="true" style={{ height }} />
      <div
        ref={barRef}
        role="dialog"
        aria-label="Cookie consent"
        className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-gold bg-burgundy-dark text-cream shadow-[0_-4px_16px_rgba(34,20,24,0.25)]"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-3 sm:px-6 lg:px-8">
          <p className="text-[13px] leading-[1.35] text-cream/90 sm:text-sm sm:leading-snug">
            Optional analytics cookies help us see how the directory is used. Nothing loads unless you accept.
          </p>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-gold-bright underline hover:text-cream"
            >
              Privacy policy
            </Link>
            <button type="button" className={choiceButton} onClick={() => setConsent("accepted")}>
              Accept
            </button>
            <button type="button" className={choiceButton} onClick={() => setConsent("declined")}>
              Decline
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
