// Phase B pilot: merge the locator list (authoritative city/address/phone),
// the reconciliation report (Outscraper geo/contact data), and the hand-written
// synthesis (descriptions + judged fields) into the final staged output —
// shaped to match the `locations` table columns, but written to a local file
// only. No writes to the live DB happen here.
//
// Usage: node build-staged-output.mjs <locator-list.json> <reconciliation.json> <synthesis.json> \
//          <chain_id> <chain_slug> <chain_display_name> [namePrefix]
//
// chain_slug: short kebab identifier, used for the output filename and location slugs
//   (e.g. "flix-brewhouse" -> flix-brewhouse-staged.json, slug flix-brewhouse-<city>-<name>)
// chain_display_name: used as the `chain` field in the output header
// namePrefix: text prepended to each location's locator-list `name` to build its public
//   display name (e.g. "Flix Brewhouse" + "Katy" -> "Flix Brewhouse Katy"). Defaults to
//   chain_display_name if omitted — pass it explicitly when the two differ (e.g. the
//   `chains` table row is "Metropolitan" but the branch's own branding is "MetroLux").
//
// delivery_style / alcohol_served are read per-location from the synthesis entry (grounded
// in that location's reviews/site copy) rather than assumed chain-wide; synthesis should
// set them to 'unknown' when there's no real signal, matching the DB column default.

import { readFileSync, writeFileSync } from "node:fs";

const [, , locatorPath, reconciliationPath, synthesisPath, chainId, chainSlug, chainDisplayName, namePrefixArg] =
  process.argv;
const namePrefix = namePrefixArg ?? chainDisplayName;

if (!locatorPath || !reconciliationPath || !synthesisPath || !chainId || !chainSlug || !chainDisplayName) {
  console.error(
    "Usage: node build-staged-output.mjs <locator-list.json> <reconciliation.json> <synthesis.json> <chain_id> <chain_slug> <chain_display_name> [namePrefix]"
  );
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Strips query strings from an Outscraper `website` value, including ones
// that arrive percent-encoded into the path itself rather than as a real
// query string (seen with Flix Brewhouse's Google Business Profile export:
// ".../foo/%3Futm_source%3Dgoogle..." — a literal "?" that never got
// decoded before it reached us). Either way, a chain's own analytics/UTM
// tags have no reason to propagate through our links.
function cleanWebsiteUrl(url) {
  if (!url) return null;
  return url.replace(/%3F.*$/i, "").replace(/\?.*$/, "");
}

const locatorList = readJson(locatorPath);
const reconciliation = readJson(reconciliationPath);
const synthesis = readJson(synthesisPath);

const synthesisByName = new Map(synthesis.map((s) => [s.name, s]));
const matchedByName = new Map(
  reconciliation.matched.map((m) => [m.locator.name, m])
);

const today = new Date().toISOString().slice(0, 10);
const staged = [];
const problems = [];

for (const loc of locatorList) {
  const match = matchedByName.get(loc.name);
  const synth = synthesisByName.get(loc.name);

  if (!match) {
    problems.push(`No reconciliation match for locator entry: ${loc.name} (${loc.city}, ${loc.state})`);
    continue;
  }
  if (!synth) {
    problems.push(`No synthesis entry for: ${loc.name} (${loc.city}, ${loc.state})`);
    continue;
  }

  const o = match.outscraper;
  const slug = `${chainSlug}-${slugify(loc.city)}-${slugify(loc.name)}`;

  staged.push({
    slug,
    name: `${namePrefix} ${loc.name}`.trim(),
    chain_id: chainId,
    sub_brand: null,
    address: loc.address,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
    lat: o.latitude,
    lng: o.longitude,
    place_id: o.place_id,
    fsq_id: null,
    phone: loc.phone,
    website_url: cleanWebsiteUrl(o.website),
    ticketing_url: cleanWebsiteUrl(o.website),
    hours: null,
    delivery_style: synth.delivery_style ?? "unknown",
    alcohol_served: synth.alcohol_served ?? "unknown",
    age_restricted_auditoriums: null,
    reserved_recliners: synth.reserved_recliners,
    menu_price_range: synth.menu_price_range,
    amenities: synth.amenities,
    accessibility_notes: synth.accessibility_notes,
    parking_notes: synth.parking_notes,
    safety_notes: synth.safety_notes,
    description: synth.description,
    status: o.business_status === "OPERATIONAL" ? "active" : "temporarily_closed",
    last_verified_date: today,
    photos: o.photo ? [o.photo] : null,
    is_sponsored: false,
    metro_area: loc.metro_area,
    match_method: match.match_method,
  });
}

const output = {
  chain: chainDisplayName,
  chain_id: chainId,
  generated_at: new Date().toISOString(),
  source_counts: reconciliation.counts,
  locations: staged,
};

const outPath = new URL(`./output/${chainSlug}-staged.json`, import.meta.url);
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`Staged ${staged.length} of ${locatorList.length} locations.`);
if (problems.length) {
  console.log("\nProblems:");
  for (const p of problems) console.log(`  - ${p}`);
}
console.log(`\nWritten to ${outPath.pathname}`);
