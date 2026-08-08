// Phase B pilot: reconcile a chain locator-scrape list (authoritative "is this
// a real, current, active location" source) against an Outscraper Google Maps
// pull (geo/contact data source). Flags anything appearing in only one list
// rather than silently dropping or guessing.
//
// Usage: node reconcile.mjs <locator-list.json> <outscraper-raw.json> <chain-name> [namePrefixRegex]
//
// locator-list.json: array of { metro_area, name, address, city, state, zip, phone }
// outscraper-raw.json: raw Outscraper /google-maps-search response ({ data: [[...]] })
// namePrefixRegex: optional case-insensitive pattern (source only, no slashes) matching
//   the chain's own name as it appears at the start of Outscraper's `name` field, so it
//   can be stripped before comparing to the locator list's bare branch name. Defaults to
//   matching nothing (no prefix stripped) if omitted.

import { readFileSync, writeFileSync } from "node:fs";

const [, , locatorPath, outscraperPath, chainName, namePrefixArg] = process.argv;

if (!locatorPath || !outscraperPath) {
  console.error("Usage: node reconcile.mjs <locator-list.json> <outscraper-raw.json> <chain-name> [namePrefixRegex]");
  process.exit(1);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// PowerShell's `Out-File -Encoding utf8` prepends a UTF-8 BOM, which JSON.parse
// doesn't strip on its own.
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

function normalize(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(s) {
  const digits = (s ?? "").replace(/\D/g, "");
  return digits.slice(-10);
}

// Drops suite/unit/building qualifiers so formatting differences between
// sources (e.g. "Suite 120" vs "#120", "Bldg F" vs "Building F") don't break
// an otherwise-identical street address match.
function normalizeStreet(s) {
  return normalize(s)
    .replace(/\b(suite|ste|bldg|building|unit)\b.*$/, "")
    .trim();
}

const locatorList = readJson(locatorPath);
const outscraperRaw = readJson(outscraperPath);

// With dropDuplicates=true, Outscraper flattens `data` into one array of
// places directly. Without it, `data` is an array of per-query sub-arrays.
// Handle both shapes.
const rawData = outscraperRaw.data ?? [];
const batches = Array.isArray(rawData[0]) ? rawData : [rawData];

const outscraperPlaces = [];
const seenPlaceIds = new Set();
for (const batch of batches) {
  for (const place of batch ?? []) {
    if (!seenPlaceIds.has(place.place_id)) {
      seenPlaceIds.add(place.place_id);
      outscraperPlaces.push(place);
    }
  }
}

const chainPrefixPattern = namePrefixArg ? new RegExp(`^${namePrefixArg}\\s*`, "i") : /^$/;

function outscraperBranchName(place) {
  return normalize(place.name.replace(chainPrefixPattern, ""));
}

const matched = [];
const locatorOnly = [];
const claimedPlaceIds = new Set();

for (const loc of locatorList) {
  const locCity = normalize(loc.city);
  const locState = loc.state.toLowerCase();
  const locBranch = normalize(loc.name);

  const candidates = outscraperPlaces.filter((p) => {
    // Outscraper's `state` is the full name (e.g. "Texas"); `state_code` is
    // the abbreviation our locator list actually uses (e.g. "TX").
    const pStateCode = (p.state_code || "").toLowerCase();
    return normalize(p.city) === locCity && pStateCode === locState;
  });

  let best = null;
  for (const candidate of candidates) {
    if (claimedPlaceIds.has(candidate.place_id)) continue;
    const branch = outscraperBranchName(candidate);
    // branch.length check guards against a degenerate false-positive: when a
    // chain's Google listing carries no location-distinguishing suffix at all
    // (branch === "" after stripping the chain name), `locBranch.includes("")`
    // is trivially true in JS, which would otherwise "match" the first
    // same-city candidate in array order regardless of which one it actually
    // is. Falling through to the address/phone pass is the correct behavior
    // when there's no real name signal to go on.
    if (branch.length > 0 && (branch === locBranch || branch.includes(locBranch) || locBranch.includes(branch))) {
      best = candidate;
      break;
    }
  }
  // Fall back to the single unclaimed candidate in that city if name matching was inconclusive
  if (!best) {
    const unclaimed = candidates.filter((c) => !claimedPlaceIds.has(c.place_id));
    if (unclaimed.length === 1) best = unclaimed[0];
  }

  if (best) {
    claimedPlaceIds.add(best.place_id);
    matched.push({ locator: loc, outscraper: best, match_method: "city_and_name" });
  } else {
    locatorOnly.push(loc);
  }
}

// Second pass: city labels can legitimately differ between sources (e.g. a
// suburb address that Google geocodes to the larger neighboring metro), so
// retry any remaining locator-only entries against remaining unclaimed
// Outscraper places using street address or phone number instead of city.
const stillUnmatched = [];
for (const loc of locatorOnly) {
  const locStreet = normalizeStreet(loc.address);
  const locPhone = normalizePhone(loc.phone);

  const match = outscraperPlaces.find((p) => {
    if (claimedPlaceIds.has(p.place_id)) return false;
    return normalizeStreet(p.street ?? p.address) === locStreet || normalizePhone(p.phone) === locPhone;
  });

  if (match) {
    claimedPlaceIds.add(match.place_id);
    matched.push({ locator: loc, outscraper: match, match_method: "address_or_phone_fallback" });
  } else {
    stillUnmatched.push(loc);
  }
}
// Third pass: within a single city+state, if exactly one locator-only entry
// and exactly one outscraper-only entry remain after name and address/phone
// matching both failed (e.g. the site abbreviates a city — "ABQ" vs Google's
// "Albuquerque" — in a way that also defeats street/phone matching), they're
// almost certainly the same place: nothing else in that city is left to
// confuse the pairing with. Still recorded with a distinct match_method so
// it's easy to spot-check during review rather than silently blessed.
const outscraperUnclaimed = () => outscraperPlaces.filter((p) => !claimedPlaceIds.has(p.place_id));
const finalUnmatched = [];
for (const loc of stillUnmatched) {
  const locCity = normalize(loc.city);
  const locState = loc.state.toLowerCase();
  const cityLocatorOnly = stillUnmatched.filter(
    (l) => normalize(l.city) === locCity && l.state.toLowerCase() === locState
  );
  const cityOutscraperOnly = outscraperUnclaimed().filter(
    (p) => normalize(p.city) === locCity && (p.state_code || "").toLowerCase() === locState
  );

  if (cityLocatorOnly.length === 1 && cityOutscraperOnly.length === 1) {
    const match = cityOutscraperOnly[0];
    claimedPlaceIds.add(match.place_id);
    matched.push({ locator: loc, outscraper: match, match_method: "last_unclaimed_in_city" });
  } else {
    finalUnmatched.push(loc);
  }
}
const locatorOnlyFinal = finalUnmatched;

const outscraperOnly = outscraperPlaces.filter((p) => !claimedPlaceIds.has(p.place_id));

const report = {
  chain: chainName ?? "unknown",
  generated_at: new Date().toISOString(),
  counts: {
    locator_total: locatorList.length,
    outscraper_total: outscraperPlaces.length,
    matched: matched.length,
    locator_only: locatorOnlyFinal.length,
    outscraper_only: outscraperOnly.length,
  },
  matched,
  locator_only: locatorOnlyFinal,
  outscraper_only: outscraperOnly.map((p) => ({
    name: p.name,
    address: p.address,
    city: p.city,
    state: p.state,
    place_id: p.place_id,
  })),
};

const outSlug = chainName ? slugify(chainName) : "unknown";
const outPath = new URL(`./output/reconciliation-${outSlug}.json`, import.meta.url);
writeFileSync(outPath, JSON.stringify(report, null, 2));

const fallbackMatches = matched.filter((m) => m.match_method === "address_or_phone_fallback");
const lastUnclaimedMatches = matched.filter((m) => m.match_method === "last_unclaimed_in_city");

console.log(`Locator total:     ${report.counts.locator_total}`);
console.log(`Outscraper total:  ${report.counts.outscraper_total}`);
console.log(`Matched:           ${report.counts.matched} (${fallbackMatches.length} via address/phone fallback, ${lastUnclaimedMatches.length} via last-unclaimed-in-city)`);
console.log(`Locator only:      ${report.counts.locator_only}`);
console.log(`Outscraper only:   ${report.counts.outscraper_only}`);
if (fallbackMatches.length) {
  console.log("\nMatched via address/phone fallback (city label differed between sources):");
  for (const m of fallbackMatches) {
    console.log(`  - ${m.locator.name}: locator says "${m.locator.city}, ${m.locator.state}", Outscraper says "${m.outscraper.city}, ${m.outscraper.state_code}"`);
  }
}
if (lastUnclaimedMatches.length) {
  console.log("\nMatched via last-unclaimed-in-city (name AND address/phone both failed — spot-check these):");
  for (const m of lastUnclaimedMatches) {
    console.log(`  - locator "${m.locator.name}" (${m.locator.address}, ${m.locator.city}) <-> outscraper "${m.outscraper.name}" (${m.outscraper.street ?? m.outscraper.address})`);
  }
}
if (locatorOnlyFinal.length) {
  console.log("\nLocator-only (no Outscraper match found):");
  for (const l of locatorOnlyFinal) console.log(`  - ${l.name} (${l.city}, ${l.state})`);
}
if (outscraperOnly.length) {
  console.log("\nOutscraper-only (no locator match found):");
  for (const p of outscraperOnly) console.log(`  - ${p.name} (${p.city}, ${p.state})`);
}
console.log(`\nWritten to ${outPath.pathname}`);
