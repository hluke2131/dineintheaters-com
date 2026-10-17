import { cache } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/supabase/database.types";
import { slugify } from "@/lib/format-slug";
import {
  ALCOHOL_FILTER_MATCHES,
  type AlcoholFilter,
  type DeliveryStyle,
  type MenuPriceRange,
} from "@/lib/theater-fields";
import { getStateBySlug } from "@/lib/us-states";

type LocationRow = Database["public"]["Tables"]["locations"]["Row"];
type ChainRow = Database["public"]["Tables"]["chains"]["Row"];
type FieldVerificationRow = Database["public"]["Tables"]["field_verification"]["Row"];
type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

export type StateCount = { state: string; count: number };
export type PopularCity = { state: string; city: string; slug: string; count: number };

export type LocationSummary = Pick<
  LocationRow,
  | "id"
  | "slug"
  | "name"
  | "city"
  | "state"
  | "sub_brand"
  | "delivery_style"
  | "alcohol_served"
  | "menu_price_range"
  | "reserved_recliners"
  | "is_sponsored"
> & { chain: { name: string } | null };

export type LocationDetail = LocationRow & {
  chain: ChainRow | null;
  field_verification: FieldVerificationRow[];
};

const LOCATION_SUMMARY_COLUMNS =
  "id, slug, name, city, state, sub_brand, delivery_style, alcohol_served, menu_price_range, reserved_recliners, is_sponsored, chain:chains(name)";

/** A city hub is only linked (and only indexable) at this many published
 * listings. Smaller cities still resolve if the URL is hit directly, but they
 * are never linked to; their theaters are reached through the state hub. */
export const MIN_CITY_HUB_LISTINGS = 3;

export type CityGroup<T extends { city: string } = LocationSummary> = {
  /** URL segment: slugify(city). Two spellings that slugify the same are one group. */
  slug: string;
  /** Display name: the most common stored spelling in the group. */
  city: string;
  count: number;
  /** True when the city has enough published listings for its own hub page. */
  linked: boolean;
  listings: T[];
};

export type StateHub = {
  /** Published listings in the state, across all cities. */
  total: number;
  linkedCities: CityGroup[];
  /** Cities below MIN_CITY_HUB_LISTINGS, so nothing is orphaned. */
  otherCities: CityGroup[];
};

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function groupByCity<T extends { city: string }>(rows: T[]): CityGroup<T>[] {
  const bySlug = new Map<string, T[]>();
  for (const row of rows) {
    const key = slugify(row.city);
    const group = bySlug.get(key);
    if (group) group.push(row);
    else bySlug.set(key, [row]);
  }

  return Array.from(bySlug, ([slug, listings]) => ({
    slug,
    city: mostCommon(listings.map((listing) => listing.city)),
    count: listings.length,
    linked: listings.length >= MIN_CITY_HUB_LISTINGS,
    listings,
  })).sort((a, b) => a.city.localeCompare(b.city));
}

/** PostgREST silently truncates any response at its max-rows setting (1,000 on
 * Supabase), with no error, so an unpaginated "fetch everything" read goes
 * quietly wrong the day the table outgrows it. Every query that needs all the
 * rows of a set goes through fetchAllRows below instead. */
const FETCH_PAGE_SIZE = 1000;

/** Reads a whole result set one `.range()` page at a time. `fetchPage` must
 * apply a total order that ends in a unique column, otherwise rows can repeat
 * or skip across page boundaries. */
async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + FETCH_PAGE_SIZE - 1);
    // A set whose size is an exact multiple of the page size ends on an empty
    // page, which PostgREST may report as 416 / PGRST103 rather than [].
    if (error?.code === "PGRST103" && from > 0) return rows;
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < FETCH_PAGE_SIZE) return rows;
  }
}

/** All published, active rows in one state (a 2-letter code), ordered by city,
 * name. Cached per request so the state hub, city hub, and listing breadcrumb
 * can all ask without repeating the query. */
const getStateRows = cache(async (stateCode: string): Promise<LocationSummary[]> => {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("locations")
      .select(LOCATION_SUMMARY_COLUMNS)
      .eq("status", "active")
      .eq("is_published", true)
      .ilike("state", stateCode)
      .order("city")
      .order("name")
      .order("slug") // unique tie-breaker so pages never overlap or skip rows
      .range(from, to)
  );
  return rows as unknown as LocationSummary[];
});

/** All states with at least one published, active location, alphabetical by
 * state name. Used by the state index page, the homepage state explorer, and
 * the homepage stat line, so a state with 0 listings is omitted everywhere by
 * one filter. */
export async function getStatesWithCounts(): Promise<StateCount[]> {
  const supabase = await createClient();
  const data = await fetchAllRows((from, to) =>
    supabase
      .from("locations")
      .select("state")
      .eq("status", "active")
      .eq("is_published", true)
      .order("id")
      .range(from, to)
  );

  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
  }

  const displayName = (code: string) => getStateBySlug(code)?.name ?? code;
  return Array.from(counts, ([state, count]) => ({ state, count })).sort((a, b) =>
    displayName(a.state).localeCompare(displayName(b.state))
  );
}

/** A state's published listings grouped by city: cities with enough listings
 * for their own hub first, then the small ones. Both sets together are every
 * published listing in the state. */
export async function getStateHub(stateCode: string): Promise<StateHub> {
  const rows = await getStateRows(stateCode);
  const groups = groupByCity(rows);
  return {
    total: rows.length,
    linkedCities: groups.filter((group) => group.linked),
    otherCities: groups.filter((group) => !group.linked),
  };
}

/** Resolves a city URL segment against the city values actually stored for
 * that state's published rows, instead of turning the slug back into a name.
 * (De-slugifying cannot round-trip "Orlando-Kissimmee" or "St. Louis".)
 * Returns null when the state has no published listing for that city. */
export async function getCityByStateAndSlug(
  stateCode: string,
  citySlug: string
): Promise<CityGroup | null> {
  let decoded = citySlug;
  try {
    decoded = decodeURIComponent(citySlug);
  } catch {
    // Malformed escape: fall through with the raw segment, which won't match.
  }
  const wanted = slugify(decoded);
  const groups = groupByCity(await getStateRows(stateCode));
  return groups.find((group) => group.slug === wanted) ?? null;
}

/** Whether a listing's city has its own linkable hub page, so the listing
 * breadcrumb can fall back to the state hub for small cities. */
export async function isCityHubLinked(stateCode: string, city: string): Promise<boolean> {
  const wanted = slugify(city);
  const groups = groupByCity(await getStateRows(stateCode));
  return groups.some((group) => group.slug === wanted && group.linked);
}

/** A single published location by slug, with its chain (if any) and
 * field_verification rows, for the listing page. Returns null if no published
 * location has that slug, so unpublished rows 404. Any status is fine, not
 * just active, since a temporarily/permanently closed theater should still
 * resolve to its page rather than 404. */
export const getLocationBySlug = cache(async (slug: string): Promise<LocationDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*, chain:chains(*), field_verification(*)")
    .eq("is_published", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data as LocationDetail | null;
});

/** Name and place of a published listing, for the correction page to say what
 * is being corrected. Null for an unknown or unpublished slug. */
export const getListingLabel = cache(
  async (slug: string): Promise<{ slug: string; name: string; city: string; state: string } | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .select("slug, name, city, state")
      .eq("is_published", true)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
);

/** Reviews for a given location, most recent first. */
export async function getReviewsByLocationId(locationId: string): Promise<ReviewRow[]> {
  const supabase = await createClient();
  return fetchAllRows((from, to) =>
    supabase
      .from("reviews")
      .select("*")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
  );
}

export type DirectoryFilters = {
  deliveryStyle?: DeliveryStyle[];
  /** "any" = beer & wine or full bar; "full_bar" = full bar only. */
  alcoholServed?: AlcoholFilter;
  menuPriceRange?: MenuPriceRange[];
  reservedRecliners?: boolean;
};

export const DIRECTORY_PAGE_SIZE = 48;

export type DirectoryPage = {
  listings: LocationSummary[];
  /** Total rows matching the filters across all pages. */
  total: number;
};

/** One page of the directory, always scoped to status = 'active' and
 * is_published = true (no filter below offers a way to ask otherwise), sorted
 * by state, then city, then name. Every filter is a multi-field AND; values
 * within one field are OR'd. A row whose value for a filtered field is
 * unknown/null never matches, because the comparison is against confirmed
 * values only. `page` is 1-based. */
export async function getDirectoryListings(
  filters: DirectoryFilters = {},
  page = 1,
  pageSize = DIRECTORY_PAGE_SIZE
): Promise<DirectoryPage> {
  const supabase = await createClient();
  let query = supabase
    .from("locations")
    .select(LOCATION_SUMMARY_COLUMNS, { count: "exact" })
    .eq("status", "active")
    .eq("is_published", true);

  if (filters.deliveryStyle?.length) {
    query = query.in("delivery_style", filters.deliveryStyle);
  }
  if (filters.alcoholServed) {
    query = query.in("alcohol_served", [...ALCOHOL_FILTER_MATCHES[filters.alcoholServed]]);
  }
  if (filters.menuPriceRange?.length) {
    query = query.in("menu_price_range", filters.menuPriceRange);
  }
  if (filters.reservedRecliners) {
    query = query.eq("reserved_recliners", true);
  }

  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, error, count } = await query
    .order("state")
    .order("city")
    .order("name")
    .order("slug") // unique tie-breaker so pages never overlap or skip rows
    .range(from, from + pageSize - 1);

  if (error) {
    // PostgREST answers a page past the end with 416 / PGRST103 instead of an
    // empty list. Report the real total so the caller can send the visitor to
    // the last page.
    if (error.code === "PGRST103" && page > 1) {
      return { listings: [], total: (await getDirectoryListings(filters, 1, pageSize)).total };
    }
    throw error;
  }
  return { listings: (data ?? []) as LocationSummary[], total: count ?? 0 };
}

/** Linkable cities (MIN_CITY_HUB_LISTINGS+ published, active listings) ranked
 * by listing count, for the homepage. Smaller cities are left out because
 * their hub pages are not linked to. Returns an empty list when no city
 * qualifies, so the homepage can render a "check back soon" message. */
export async function getPopularCities(limit = 6): Promise<PopularCity[]> {
  const supabase = await createClient();
  const data = await fetchAllRows((from, to) =>
    supabase
      .from("locations")
      .select("state, city")
      .eq("status", "active")
      .eq("is_published", true)
      .order("id")
      .range(from, to)
  );

  const counts = new Map<string, PopularCity>();
  const spellings = new Map<string, string[]>();
  for (const row of data) {
    const slug = slugify(row.city);
    const key = `${row.state}|${slug}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      spellings.get(key)!.push(row.city);
    } else {
      counts.set(key, { state: row.state, city: row.city, slug, count: 1 });
      spellings.set(key, [row.city]);
    }
  }

  return Array.from(counts, ([key, city]) => ({ ...city, city: mostCommon(spellings.get(key)!) }))
    .filter((city) => city.count >= MIN_CITY_HUB_LISTINGS)
    .sort(
      (a, b) =>
        b.count - a.count || a.state.localeCompare(b.state) || a.city.localeCompare(b.city)
    )
    .slice(0, limit);
}

export type SitemapListing = { slug: string; updatedAt: string };
export type SitemapCity = { state: string; slug: string };
export type SitemapData = {
  /** Every indexable listing: published and not permanently closed. */
  listings: SitemapListing[];
  /** Lowercase state codes with at least one published, active listing. */
  states: string[];
  /** Cities with MIN_CITY_HUB_LISTINGS+ published, active listings. */
  cities: SitemapCity[];
};

/** Everything the sitemap needs, from one paged read of the published rows
 * through a cookie-free client (so the sitemap can be prerendered and
 * revalidated on a timer). The filters mirror the pages: listings are
 * is_published = true minus permanently_closed (the listing page noindexes
 * those); state and city hubs count only status = 'active', exactly like
 * getStateRows, and use the same groupByCity / MIN_CITY_HUB_LISTINGS rule that
 * decides hub linking and indexability. */
export async function getSitemapData(): Promise<SitemapData> {
  const supabase = createPublicClient();
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("locations")
      .select("slug, city, state, status, updated_at")
      .eq("is_published", true)
      .order("slug") // unique, so pages never overlap or skip rows
      .range(from, to)
  );

  const listings = rows
    .filter((row) => row.status !== "permanently_closed")
    .map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));

  const activeByState = new Map<string, { city: string }[]>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const code = row.state.toUpperCase();
    const bucket = activeByState.get(code);
    if (bucket) bucket.push({ city: row.city });
    else activeByState.set(code, [{ city: row.city }]);
  }

  const states: string[] = [];
  const cities: SitemapCity[] = [];
  for (const [code, stateRows] of Array.from(activeByState).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    if (!getStateBySlug(code)) continue; // the route would 404 on it
    const stateSlug = code.toLowerCase();
    states.push(stateSlug);
    for (const group of groupByCity(stateRows)) {
      if (group.linked) cities.push({ state: stateSlug, slug: group.slug });
    }
  }

  return { listings, states, cities };
}
