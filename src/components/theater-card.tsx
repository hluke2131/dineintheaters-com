import Link from "next/link";
import type { ReactNode } from "react";
import type { LocationSummary } from "@/lib/queries";
import { ALCOHOL_SERVED_LABELS, DELIVERY_STYLE_LABELS, getLabel } from "@/lib/theater-fields";

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-burgundy/10 px-2.5 py-1 text-xs font-medium text-burgundy-dark">
      {children}
    </span>
  );
}

export function TheaterCard({ location }: { location: LocationSummary }) {
  return (
    <Link
      href={`/dine-in-theaters/${location.slug}`}
      className="block rounded-xl border border-burgundy/10 bg-white p-5 shadow-sm transition hover:border-burgundy/30 hover:shadow-md"
    >
      {location.is_sponsored ? (
        <p className="text-xs font-medium uppercase tracking-wide text-gold">Sponsored</p>
      ) : null}
      <p className="mt-1 font-display text-lg text-burgundy-dark">{location.name}</p>
      <p className="mt-1 text-sm text-ink/60">
        {location.city}, {location.state}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{getLabel(DELIVERY_STYLE_LABELS, location.delivery_style)}</Badge>
        <Badge>{getLabel(ALCOHOL_SERVED_LABELS, location.alcohol_served)}</Badge>
        {location.menu_price_range ? <Badge>{location.menu_price_range}</Badge> : null}
        {location.reserved_recliners ? <Badge>Reserved Recliners</Badge> : null}
      </div>
    </Link>
  );
}
