// Phase B pilot: insert a reviewed staged-output file into the live
// `locations` table. Uses the service role key (bypasses RLS, required since
// only service_role can write to `locations`) and the Supabase JS client so
// every value is sent as a real parameter — no hand-built SQL string
// escaping for free-text descriptions containing quotes/apostrophes.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node insert-staged.mjs <staged.json>

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [, , stagedPath] = process.argv;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stagedPath || !supabaseUrl || !serviceRoleKey) {
  console.error(
    "Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node insert-staged.mjs <staged.json>"
  );
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

const staged = readJson(stagedPath);

// Only real `locations` columns — drop the pilot-only tracking fields
// (metro_area, match_method) that aren't part of the table schema.
const rows = staged.locations.map((loc) => ({
  slug: loc.slug,
  name: loc.name,
  chain_id: loc.chain_id,
  sub_brand: loc.sub_brand,
  address: loc.address,
  city: loc.city,
  state: loc.state,
  zip: loc.zip,
  lat: loc.lat,
  lng: loc.lng,
  place_id: loc.place_id,
  fsq_id: loc.fsq_id,
  phone: loc.phone,
  website_url: loc.website_url,
  ticketing_url: loc.ticketing_url,
  hours: loc.hours,
  delivery_style: loc.delivery_style,
  alcohol_served: loc.alcohol_served,
  age_restricted_auditoriums: loc.age_restricted_auditoriums,
  reserved_recliners: loc.reserved_recliners,
  menu_price_range: loc.menu_price_range,
  amenities: loc.amenities,
  accessibility_notes: loc.accessibility_notes,
  parking_notes: loc.parking_notes,
  safety_notes: loc.safety_notes,
  description: loc.description,
  status: loc.status,
  last_verified_date: loc.last_verified_date,
  photos: loc.photos,
  is_sponsored: loc.is_sponsored,
}));

console.log(`Inserting ${rows.length} rows into public.locations...`);

const supabase = createClient(supabaseUrl, serviceRoleKey);
const { data, error } = await supabase.from("locations").insert(rows).select("id, slug, status");

if (error) {
  console.error("INSERT FAILED:", error.message, error.details ?? "");
  process.exit(1);
}

console.log(`Inserted ${data.length} rows successfully.`);
const statusCounts = data.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1;
  return acc;
}, {});
console.log("Status breakdown:", JSON.stringify(statusCounts));
