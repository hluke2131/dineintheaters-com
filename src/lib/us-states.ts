import { slugify } from "./format-slug";

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

export type USState = (typeof US_STATES)[number];

const SLUG_TO_STATE = new Map(US_STATES.map((state) => [slugify(state), state]));

// Looks up a URL slug (e.g. "new-york") against the fixed list of US states,
// so an unrecognized slug can 404 instead of rendering a page for a state
// that will never exist. Distinct from "a real state with 0 listings yet",
// which should render normally with an empty state.
export function getStateBySlug(slug: string): USState | undefined {
  return SLUG_TO_STATE.get(slug.toLowerCase());
}
