import Link from "next/link";
import { Chip } from "@/components/chip";
import type { LocationSummary } from "@/lib/queries";
import { brandLabel, getFeatureChips } from "@/lib/theater-display";

const MAX_CHIPS = 4;

export function TheaterCard({ location }: { location: LocationSummary }) {
  const chips = getFeatureChips(location).slice(0, MAX_CHIPS);

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
      <p className="mt-1 text-sm text-ink/60">{brandLabel(location)}</p>
      {chips.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip}>
              <Chip>{chip}</Chip>
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  );
}
