const FANDANGO_HOST_PATTERN = /(^|\.)fandango\.com$/i;

function isFandangoUrl(url: string): boolean {
  try {
    return FANDANGO_HOST_PATTERN.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Builds the "Check Showtimes" href for a location's ticketing_url. Fandango
// links get routed through a Commission Junction affiliate deep-link template
// (FANDANGO_CJ_DEEP_LINK_TEMPLATE, a string containing a `{destination}`
// placeholder) once that template is available; until then, or for any
// non-Fandango host, this links straight to ticketing_url.
export function getShowtimesLink(ticketingUrl: string | null): string | null {
  if (!ticketingUrl) return null;

  const template = process.env.FANDANGO_CJ_DEEP_LINK_TEMPLATE;
  if (template && isFandangoUrl(ticketingUrl)) {
    return template.replace("{destination}", encodeURIComponent(ticketingUrl));
  }

  return ticketingUrl;
}
