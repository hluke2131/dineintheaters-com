// Phase B pilot: live Place Details (New) pull requesting only the `reviews`
// field, for a batch of reconciled locations. Prints review text to stdout
// for synthesis in the same turn — this script must NEVER write raw review
// content to a file (scratch or otherwise); only synthesized descriptions
// get persisted, elsewhere, by hand.
//
// Usage: node fetch-reviews.mjs <reconciliation.json> <startIndex> <count>

import { readFileSync } from "node:fs";

const [, , reconciliationPath, startArg, countArg] = process.argv;
const apiKey = process.env.GOOGLE_PLACES_API_KEY;

if (!reconciliationPath || !apiKey) {
  console.error("Usage: GOOGLE_PLACES_API_KEY=... node fetch-reviews.mjs <reconciliation.json> <startIndex> <count>");
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

const start = Number(startArg ?? 0);
const count = Number(countArg ?? 10);

const report = readJson(reconciliationPath);
const batch = report.matched.slice(start, start + count);

console.log(`Fetching reviews for locations ${start}..${start + batch.length - 1} of ${report.matched.length}`);

let requestCount = 0;
for (const entry of batch) {
  const placeId = entry.outscraper.place_id;
  const label = entry.locator.metro_area + " / " + entry.locator.name;

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,reviews",
    },
  });
  requestCount++;

  if (!res.ok) {
    console.log(`\n=== ${label} (${placeId}) === ERROR ${res.status}: ${await res.text()}`);
    continue;
  }

  const data = await res.json();
  console.log(`\n=== ${label} (${placeId}) ===`);
  console.log(`Display name: ${data.displayName?.text}`);
  const reviews = data.reviews ?? [];
  if (reviews.length === 0) {
    console.log("No reviews returned.");
  }
  for (const r of reviews) {
    console.log(`--- ${r.rating}/5 stars, ${r.relativePublishTimeDescription} ---`);
    console.log(r.text?.text ?? "(no text)");
  }
}

console.error(`\n[fetch-reviews] ${requestCount} Place Details (Enterprise+Atmosphere) requests made this run.`);
