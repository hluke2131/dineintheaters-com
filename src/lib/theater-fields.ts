export const DELIVERY_STYLES = ["in_seat_delivery", "counter_pickup", "unknown"] as const;
export type DeliveryStyle = (typeof DELIVERY_STYLES)[number];
export const DELIVERY_STYLE_LABELS: Record<DeliveryStyle, string> = {
  in_seat_delivery: "In-Seat Delivery",
  counter_pickup: "Counter Pickup",
  unknown: "Unknown",
};

export const ALCOHOL_SERVED_OPTIONS = ["none", "beer_wine", "full_bar", "unknown"] as const;
export type AlcoholServed = (typeof ALCOHOL_SERVED_OPTIONS)[number];
export const ALCOHOL_SERVED_LABELS: Record<AlcoholServed, string> = {
  none: "No Alcohol",
  beer_wine: "Beer & Wine",
  full_bar: "Full Bar",
  unknown: "Unknown",
};

export const MENU_PRICE_RANGES = ["$", "$$", "$$$"] as const;
export type MenuPriceRange = (typeof MENU_PRICE_RANGES)[number];

// "unknown" is a data-quality default, not something a visitor would ever
// want to filter for, so it's excluded from the filterable subsets below
// even though it's a legal column value.
export const FILTERABLE_DELIVERY_STYLES: readonly DeliveryStyle[] = [
  "in_seat_delivery",
  "counter_pickup",
];
export const FILTERABLE_ALCOHOL_SERVED: readonly AlcoholServed[] = [
  "none",
  "beer_wine",
  "full_bar",
];

// Fields a visitor can crowd-verify on a listing page. Keys match the
// `field_verification.field_name` values a submission/moderation flow
// (Phase D) will write. If a row exists for a field, show its vote counts;
// otherwise prompt the visitor to help verify it.
// DB check-constrained columns are typed as `string` by the generated
// Supabase types (Postgres CHECK constraints aren't enums), so lookups
// against the narrower label maps above need a safe, string-keyed fallback.
export function getLabel<T extends string>(labels: Record<T, string>, value: string): string {
  return (labels as Record<string, string>)[value] ?? value;
}

export const VERIFIABLE_FIELDS = [
  "hours",
  "delivery_style",
  "alcohol_served",
  "reserved_recliners",
  "parking_notes",
  "menu_price_range",
] as const;
export type VerifiableField = (typeof VERIFIABLE_FIELDS)[number];
export const VERIFIABLE_FIELD_LABELS: Record<VerifiableField, string> = {
  hours: "Hours",
  delivery_style: "Delivery Style",
  alcohol_served: "Alcohol Served",
  reserved_recliners: "Reserved Recliners",
  parking_notes: "Parking",
  menu_price_range: "Menu Price Range",
};
