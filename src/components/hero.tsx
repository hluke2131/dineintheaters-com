import type { ReactNode } from "react";
import { Container } from "@/components/container";

// Cinema texture is drawn entirely with CSS and inline SVG (no image files):
// a burgundy-to-ink gradient, a gold projector glow, film grain from an
// feTurbulence filter, a row of marquee bulbs along the top edge and a
// film-strip sprocket border along the bottom. All of it is decorative and
// aria-hidden, and none of it animates.

function FilmGrain() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16] mix-blend-overlay"
    >
      <filter id="hero-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#hero-grain)" />
    </svg>
  );
}

function MarqueeBulbs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-x-0 top-0 h-5 w-full"
    >
      <defs>
        <pattern id="hero-bulbs" width="30" height="20" patternUnits="userSpaceOnUse">
          <circle cx="15" cy="10" r="8" fill="#c9a227" opacity="0.16" />
          <circle cx="15" cy="10" r="3.5" fill="#e8c65a" />
        </pattern>
      </defs>
      <rect width="100%" height="20" fill="url(#hero-bulbs)" />
    </svg>
  );
}

function SprocketStrip() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-5 w-full"
    >
      <defs>
        <pattern id="hero-sprockets" width="26" height="20" patternUnits="userSpaceOnUse">
          <rect x="7" y="5" width="12" height="10" rx="2.5" fill="#faf6ef" opacity="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="20" fill="#221418" opacity="0.55" />
      <rect width="100%" height="20" fill="url(#hero-sprockets)" />
    </svg>
  );
}

/** Site masthead: the full-size homepage hero, or a shorter page header
 * (`size="compact"`) with the same texture for /blog, /about-us and /contact.
 * Children render below the description (CTAs, stat line). */
export function Hero({
  eyebrow,
  title,
  description,
  size = "full",
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  size?: "full" | "compact";
  children?: ReactNode;
}) {
  const full = size === "full";

  return (
    <section className="relative isolate overflow-hidden bg-linear-to-br from-burgundy via-burgundy-dark to-ink text-cream">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,162,39,0.16),transparent_62%)]"
      />
      <FilmGrain />
      <MarqueeBulbs />
      <SprocketStrip />

      <Container className={`relative ${full ? "py-24 sm:py-32" : "py-16 sm:py-20"}`}>
        {eyebrow ? (
          <p className="font-sans text-sm font-medium uppercase tracking-widest text-gold-bright">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={`mt-3 max-w-3xl font-display text-cream ${
            full ? "text-5xl leading-[1.05] sm:text-7xl" : "text-4xl sm:text-5xl"
          }`}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={`mt-5 max-w-2xl text-cream/90 ${full ? "text-lg sm:text-xl" : "text-lg"}`}
          >
            {description}
          </p>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
