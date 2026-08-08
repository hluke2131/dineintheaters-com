// Phase B pilot: query Outscraper's Google Maps Search API for a chain's
// branches, one query per locator-list *location* (name + street + city/state,
// not just city) — a plain "chain, city, state" query collapses to a single
// best-match result and silently drops other branches in multi-location
// cities. Saves the raw response for reconcile.mjs to consume. Business
// listing data only (name/address/geo/phone) — no reviews, so no
// persistence restriction here.
//
// Usage: node fetch-outscraper.mjs <locator-list.json> <chain-query-name> <out-raw.json>

import { readFileSync, writeFileSync } from "node:fs";

const [, , locatorPath, chainQueryName, outPath] = process.argv;
const apiKey = process.env.OUTSCRAPER_API_KEY;

if (!locatorPath || !chainQueryName || !outPath || !apiKey) {
  console.error(
    "Usage: OUTSCRAPER_API_KEY=... node fetch-outscraper.mjs <locator-list.json> <chain-query-name> <out-raw.json>"
  );
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

const locatorList = readJson(locatorPath);
const queries = locatorList.map((l) => `${chainQueryName} ${l.name}, ${l.address}, ${l.city}, ${l.state}`);

const params = new URLSearchParams();
for (const q of queries) {
  params.append("query", q);
}
params.append("limit", "3");
params.append("dropDuplicates", "true");
params.append("async", "false");
params.append("region", "US");

console.log(`Querying Outscraper for ${queries.length} locations (chain query prefix "${chainQueryName}"):`);
for (const q of queries) console.log(`  ${q}`);

const res = await fetch(`https://api.outscraper.com/google-maps-search?${params.toString()}`, {
  headers: { "X-API-KEY": apiKey },
});

if (!res.ok) {
  console.error(`Outscraper request failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
writeFileSync(outPath, JSON.stringify(data, null, 2));

const count = Array.isArray(data.data) ? data.data.length : 0;
console.log(`Status: ${data.status}. Got ${count} places. Wrote raw response to ${outPath}`);
