import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { EmptyState } from "@/components/empty-state";
import { TheaterCard } from "@/components/theater-card";
import {
  ALCOHOL_SERVED_LABELS,
  DELIVERY_STYLE_LABELS,
  FILTERABLE_ALCOHOL_SERVED,
  FILTERABLE_DELIVERY_STYLES,
  MENU_PRICE_RANGES,
  type AlcoholServed,
  type DeliveryStyle,
  type MenuPriceRange,
} from "@/lib/theater-fields";
import { getDirectoryListings, type DirectoryFilters } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Dine-In Movie Theaters Directory",
  description: "Browse the full directory of dine-in movie theaters across the United States.",
};

type SearchParams = {
  delivery_style?: string | string[];
  alcohol_served?: string | string[];
  menu_price_range?: string | string[];
  reserved_recliners?: string;
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function DineInTheatersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const deliveryStyle = toArray(params.delivery_style).filter((v): v is DeliveryStyle =>
    FILTERABLE_DELIVERY_STYLES.includes(v as DeliveryStyle)
  );
  const alcoholServed = toArray(params.alcohol_served).filter((v): v is AlcoholServed =>
    FILTERABLE_ALCOHOL_SERVED.includes(v as AlcoholServed)
  );
  const menuPriceRange = toArray(params.menu_price_range).filter((v): v is MenuPriceRange =>
    MENU_PRICE_RANGES.includes(v as MenuPriceRange)
  );
  const reservedRecliners = params.reserved_recliners === "true";
  const hasActiveFilters =
    deliveryStyle.length > 0 ||
    alcoholServed.length > 0 ||
    menuPriceRange.length > 0 ||
    reservedRecliners;

  const filters: DirectoryFilters = {
    deliveryStyle: deliveryStyle.length ? deliveryStyle : undefined,
    alcoholServed: alcoholServed.length ? alcoholServed : undefined,
    menuPriceRange: menuPriceRange.length ? menuPriceRange : undefined,
    reservedRecliners: reservedRecliners || undefined,
  };

  const listings = await getDirectoryListings(filters);

  return (
    <Container className="py-16 sm:py-24">
      <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold">Directory</p>
      <h1 className="mt-2 font-display text-4xl text-burgundy-dark sm:text-5xl">
        Dine-In Movie Theaters
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/70">
        {listings.length} {listings.length === 1 ? "theater" : "theaters"}
        {hasActiveFilters ? " match your filters." : " and counting."}
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <form
            method="get"
            className="space-y-6 rounded-xl border border-burgundy/10 bg-white p-5"
          >
            <fieldset>
              <legend className="font-display text-sm uppercase tracking-wide text-burgundy-dark">
                Delivery Style
              </legend>
              <div className="mt-3 space-y-2">
                {FILTERABLE_DELIVERY_STYLES.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink/80">
                    <input
                      type="checkbox"
                      name="delivery_style"
                      value={value}
                      defaultChecked={deliveryStyle.includes(value)}
                      className="accent-burgundy"
                    />
                    {DELIVERY_STYLE_LABELS[value]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-display text-sm uppercase tracking-wide text-burgundy-dark">
                Alcohol Served
              </legend>
              <div className="mt-3 space-y-2">
                {FILTERABLE_ALCOHOL_SERVED.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink/80">
                    <input
                      type="checkbox"
                      name="alcohol_served"
                      value={value}
                      defaultChecked={alcoholServed.includes(value)}
                      className="accent-burgundy"
                    />
                    {ALCOHOL_SERVED_LABELS[value]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-display text-sm uppercase tracking-wide text-burgundy-dark">
                Menu Price Range
              </legend>
              <div className="mt-3 space-y-2">
                {MENU_PRICE_RANGES.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink/80">
                    <input
                      type="checkbox"
                      name="menu_price_range"
                      value={value}
                      defaultChecked={menuPriceRange.includes(value)}
                      className="accent-burgundy"
                    />
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  name="reserved_recliners"
                  value="true"
                  defaultChecked={reservedRecliners}
                  className="accent-burgundy"
                />
                Reserved Recliners Only
              </label>
            </fieldset>

            <button
              type="submit"
              className="w-full rounded-full bg-burgundy px-4 py-2 font-medium text-cream hover:bg-burgundy-dark"
            >
              Apply Filters
            </button>
            {hasActiveFilters ? (
              <Link
                href="/dine-in-theaters"
                className="block text-center text-sm text-ink/60 hover:text-burgundy"
              >
                Clear filters
              </Link>
            ) : null}
          </form>
        </aside>

        <div>
          {listings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {listings.map((location) => (
                <TheaterCard key={location.id} location={location} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No theaters listed yet"
              message={
                hasActiveFilters
                  ? "No theaters match those filters yet. Try clearing a filter, or check back as the directory grows."
                  : "We're actively building out this directory. Check back soon, or use Add a Theater to suggest one."
              }
            />
          )}
        </div>
      </div>
    </Container>
  );
}
