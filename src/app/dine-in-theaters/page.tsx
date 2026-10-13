import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/container";
import { DirectoryFilterPanel, type ActiveFilters } from "@/components/directory-filters";
import { EmptyState } from "@/components/empty-state";
import { TheaterCard } from "@/components/theater-card";
import { resolveRobots } from "@/lib/indexing";
import {
  FILTERABLE_DELIVERY_STYLES,
  MENU_PRICE_RANGES,
  type AlcoholFilter,
  type DeliveryStyle,
  type MenuPriceRange,
} from "@/lib/theater-fields";
import { DIRECTORY_PAGE_SIZE, getDirectoryListings, type DirectoryFilters } from "@/lib/queries";

const BASE_PATH = "/dine-in-theaters";

type SearchParams = {
  delivery_style?: string | string[];
  alcohol_served?: string | string[];
  menu_price_range?: string | string[];
  reserved_recliners?: string | string[];
  page?: string | string[];
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Narrows `alcohol_served` to the two nested options. "any" and the legacy
 * `beer_wine` value both mean "any alcohol"; `full_bar` alone means full bar;
 * "any" wins when both are present because it already includes full bar.
 * Anything else is ignored. */
function parseAlcohol(value: string | string[] | undefined): AlcoholFilter | null {
  const values = toArray(value);
  if (values.includes("any") || values.includes("beer_wine")) return "any";
  if (values.includes("full_bar")) return "full_bar";
  return null;
}

/** Narrows raw query params to known, filterable values. Anything else
 * (typos, "unknown", hand-edited URLs) is dropped rather than erroring. */
function parseFilters(params: SearchParams): ActiveFilters {
  return {
    deliveryStyle: toArray(params.delivery_style).filter((v): v is DeliveryStyle =>
      FILTERABLE_DELIVERY_STYLES.includes(v as DeliveryStyle)
    ),
    alcoholServed: parseAlcohol(params.alcohol_served),
    menuPriceRange: toArray(params.menu_price_range).filter((v): v is MenuPriceRange =>
      MENU_PRICE_RANGES.includes(v as MenuPriceRange)
    ),
    reservedRecliners: toArray(params.reserved_recliners).includes("true"),
  };
}

function parsePage(value: string | string[] | undefined): number {
  const page = Number.parseInt(toArray(value)[0] ?? "", 10);
  return Number.isFinite(page) && page > 1 ? page : 1;
}

function buildHref(filters: ActiveFilters, page: number): string {
  const query = new URLSearchParams();
  for (const value of filters.deliveryStyle) query.append("delivery_style", value);
  if (filters.alcoholServed) query.set("alcohol_served", filters.alcoholServed);
  for (const value of filters.menuPriceRange) query.append("menu_price_range", value);
  if (filters.reservedRecliners) query.set("reserved_recliners", "true");
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}

function countActive(filters: ActiveFilters): number {
  return (
    filters.deliveryStyle.length +
    (filters.alcoholServed ? 1 : 0) +
    filters.menuPriceRange.length +
    (filters.reservedRecliners ? 1 : 0)
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const filtered = countActive(parseFilters(params)) > 0 || parsePage(params.page) > 1;

  return {
    title: "Dine-In Movie Theaters Directory",
    description: "Browse the full directory of dine-in movie theaters across the United States.",
    alternates: { canonical: BASE_PATH },
    // Filter and pagination permutations are for visitors, not the index.
    robots: await resolveRobots(filtered ? { index: false, follow: true } : undefined),
  };
}

export default async function DineInTheatersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const active = parseFilters(params);
  const activeCount = countActive(active);
  const hasActiveFilters = activeCount > 0;
  const requestedPage = parsePage(params.page);

  const filters: DirectoryFilters = {
    deliveryStyle: active.deliveryStyle.length ? active.deliveryStyle : undefined,
    alcoholServed: active.alcoholServed ?? undefined,
    menuPriceRange: active.menuPriceRange.length ? active.menuPriceRange : undefined,
    reservedRecliners: active.reservedRecliners || undefined,
  };

  const { listings, total } = await getDirectoryListings(filters, requestedPage);
  const totalPages = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));

  // A stale or hand-edited ?page= past the end goes to the last real page.
  if (requestedPage > totalPages) {
    redirect(buildHref(active, totalPages));
  }

  const page = requestedPage;
  const firstShown = total === 0 ? 0 : (page - 1) * DIRECTORY_PAGE_SIZE + 1;
  const lastShown = (page - 1) * DIRECTORY_PAGE_SIZE + listings.length;

  return (
    <Container className="py-16 sm:py-24">
      <p className="font-sans text-sm font-medium uppercase tracking-wide text-gold-text">Directory</p>
      <h1 className="mt-2 font-display text-4xl text-burgundy-dark sm:text-5xl">
        Dine-In Movie Theaters
      </h1>

      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <DirectoryFilterPanel active={active} hasActive={hasActiveFilters} activeCount={activeCount} />

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-lg text-ink/80" aria-live="polite">
              <span className="font-display text-2xl text-burgundy-dark">
                {total.toLocaleString("en-US")} {total === 1 ? "theater" : "theaters"}
              </span>
              {hasActiveFilters ? " match your filters" : null}
            </p>
            {hasActiveFilters ? (
              <Link
                href={BASE_PATH}
                className="inline-flex min-h-11 items-center text-sm text-ink/60 underline hover:text-burgundy"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
          {hasActiveFilters ? (
            <p className="mt-1 text-sm text-ink/60">
              Filters only match theaters where we&rsquo;ve confirmed that detail.
            </p>
          ) : null}

          {listings.length > 0 ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {listings.map((location) => (
                  <TheaterCard key={location.id} location={location} />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav
                  aria-label="Pagination"
                  className="mt-10 flex items-center justify-between gap-4 text-sm"
                >
                  {page > 1 ? (
                    <Link
                      href={buildHref(active, page - 1)}
                      rel="prev"
                      className="inline-flex min-h-11 items-center rounded-full border border-burgundy px-5 font-medium text-burgundy hover:bg-burgundy/5"
                    >
                      &larr; Previous
                    </Link>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <p className="text-ink/60">
                    Showing {firstShown}&ndash;{lastShown} of {total.toLocaleString("en-US")}
                  </p>
                  {page < totalPages ? (
                    <Link
                      href={buildHref(active, page + 1)}
                      rel="next"
                      className="inline-flex min-h-11 items-center rounded-full border border-burgundy px-5 font-medium text-burgundy hover:bg-burgundy/5"
                    >
                      Next &rarr;
                    </Link>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </nav>
              ) : null}
            </>
          ) : (
            <div className="mt-6">
              <EmptyState
                title={hasActiveFilters ? "No theaters match those filters" : "No theaters listed yet"}
                message={
                  hasActiveFilters
                    ? "Try removing a filter. Filters only match theaters where we've confirmed that detail, so some theaters may be missing from these results."
                    : "We're actively building out this directory. Check back soon, or suggest a theater to add."
                }
              >
                {hasActiveFilters ? (
                  <Link
                    href={BASE_PATH}
                    className="rounded-full bg-burgundy px-5 py-2.5 font-medium text-cream hover:bg-burgundy-dark"
                  >
                    Clear filters
                  </Link>
                ) : null}
                <Link
                  href="/add-a-theater"
                  className="rounded-full border border-burgundy px-5 py-2.5 font-medium text-burgundy hover:bg-burgundy/5"
                >
                  Add a theater
                </Link>
              </EmptyState>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
