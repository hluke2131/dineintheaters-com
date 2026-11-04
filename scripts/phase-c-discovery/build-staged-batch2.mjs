// Batch 2 (Half 1): merge one state's hand-authored grades/synthesis
// (output/grades-batch2-<st>.json) with the Outscraper candidate data
// (candidates-batch2-half1.json) into output/staged-batch2-<st>.json, shaped
// like the Batch 1 per-state staged files (plus a pilot-only website_domain
// field for the later chain-resolution domain sweep). Local files only. No
// writes to the live DB; chain_id is ALWAYS null (recognized-chain convention:
// chain_id null + recognized_chain_note; linking is a separate explicit step).
//
// Usage: node scripts/phase-c-discovery/build-staged-batch2.mjs <STATE>

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { assertChainRowsMapped, slugFor } from "../lib/slug-v3.mjs";

const OUT = "scripts/phase-c-discovery/output";
const state = (process.argv[2] ?? "").toUpperCase();
if (!state) {
  console.error("Usage: node scripts/phase-c-discovery/build-staged-batch2.mjs <STATE>");
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const cleanUrl = (u) => (u ? u.replace(/%3F.*$/i, "").replace(/\?.*$/, "") : null);
const domainOf = (u) => {
  if (!u) return null;
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

const candidates = readJson(`${OUT}/candidates-batch2-half1.json`).by_state[state];
const grades = readJson(`${OUT}/grades-batch2-${state.toLowerCase()}.json`);
const byPlace = new Map(grades.entries.map((e) => [e.place_id, e]));

const TIERS = new Set(["confirmed", "likely", "uncertain", "exclude"]);
const DELIVERY = new Set(["in_seat_delivery", "counter_pickup", "unknown"]);
const ALCOHOL = new Set(["none", "beer_wine", "full_bar", "unknown"]);
const EXCLUDE_CATS = new Set([
  "not_a_public_cinema",
  "closed",
  "ordinary_concessions_only",
  "marcus_family_held_out",
  "duplicate_listing",
  "other",
]);

const today = new Date().toISOString().slice(0, 10);
const problems = [];
const locations = [];
const excluded = [];
const counts = { confirmed: 0, likely: 0, uncertain: 0, exclude: 0 };
// optional env LIVE_SNAPSHOT = JSON array of rows with a `slug`, reserved for collision handling
const takenSlugs = new Set(process.env.LIVE_SNAPSHOT ? readJson(process.env.LIVE_SNAPSHOT).map((r) => r.slug) : []);
if (!process.env.LIVE_SNAPSHOT) console.warn("LIVE_SNAPSHOT not set: slugs are only deduped within this run");
// Slug chain token: optional env CHAIN_NAMES_JSON = { "<place_id>": "<chains.name>" } for rows already
// resolved to a chain (exact chains.name). Unlisted rows are independents and get no chain token.
const CHAIN_NAMES = process.env.CHAIN_NAMES_JSON ? readJson(process.env.CHAIN_NAMES_JSON) : {};

for (const cand of candidates) {
  const g = byPlace.get(cand.place_id);
  if (!g) {
    problems.push(`UNGRADED: ${cand.name} (${cand.city}) ${cand.place_id}`);
    continue;
  }
  if (!TIERS.has(g.tier)) {
    problems.push(`bad tier "${g.tier}": ${cand.name}`);
    continue;
  }
  counts[g.tier]++;

  if (g.tier === "exclude") {
    if (!EXCLUDE_CATS.has(g.exclusion_category)) problems.push(`bad exclusion_category "${g.exclusion_category}": ${cand.name}`);
    excluded.push({
      name: cand.name,
      city: cand.city,
      place_id: cand.place_id,
      website_domain: domainOf(cand.website),
      category: g.exclusion_category,
      reason: g.grading_note,
      recognized_chain_note: g.recognized_chain_note ?? null,
    });
    continue;
  }

  if (!g.description) problems.push(`staged tier but no description: ${cand.name}`);
  if (!DELIVERY.has(g.delivery_style ?? "unknown")) problems.push(`bad delivery_style: ${cand.name}`);
  if (!ALCOHOL.has(g.alcohol_served ?? "unknown")) problems.push(`bad alcohol_served: ${cand.name}`);
  if (cand.possible_chain_flag && !g.recognized_chain_note) problems.push(`chain-flagged but no recognized_chain_note: ${cand.name}`);

  const { slug } = slugFor({ name: cand.name, city: cand.city, state: cand.state_code ?? state, place_id: cand.place_id }, CHAIN_NAMES[cand.place_id] ?? null, takenSlugs);
  takenSlugs.add(slug);

  locations.push({
    slug,
    name: cand.name,
    chain_id: null,
    sub_brand: null,
    address: cand.street ?? cand.address,
    city: cand.city,
    state: cand.state_code,
    zip: cand.postal_code ?? null,
    lat: cand.latitude,
    lng: cand.longitude,
    place_id: cand.place_id,
    fsq_id: null,
    phone: cand.phone ?? null,
    website_url: cleanUrl(cand.website),
    ticketing_url: cleanUrl(cand.website),
    hours: null,
    delivery_style: g.delivery_style ?? "unknown",
    alcohol_served: g.alcohol_served ?? "unknown",
    age_restricted_auditoriums: null,
    reserved_recliners: g.reserved_recliners ?? null,
    menu_price_range: g.menu_price_range ?? null,
    amenities: g.amenities ?? null,
    accessibility_notes: g.accessibility_notes ?? null,
    parking_notes: g.parking_notes ?? null,
    safety_notes: g.safety_notes ?? null,
    description: g.description,
    status: g.status_override ?? (cand.business_status === "OPERATIONAL" ? "active" : "temporarily_closed"),
    last_verified_date: today,
    // `photos` is an exclusive sponsored-listing perk: ALWAYS null, never
    // scraped/warehoused third-party CDN content.
    photos: null,
    is_sponsored: false,
    // Pilot-only tracking fields, not real `locations` columns:
    confidence_tier: g.tier,
    possible_chain_flag: cand.possible_chain_flag ?? false,
    recognized_chain_note: g.recognized_chain_note ?? null,
    grading_note: g.grading_note,
    website_domain: domainOf(cand.website),
  });
}

// requests tally for this state, from the count-only log
let listReq = 0;
let deepReq = 0;
const logPath = `${OUT}/places-requests-log-batch2.jsonl`;
if (existsSync(logPath)) {
  for (const line of readFileSync(logPath, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.state !== state) continue;
    if (r.mode === "deep") deepReq += r.requests;
    else listReq += r.requests;
  }
}

const output = {
  state,
  generated_at: new Date().toISOString(),
  survivors_reviewed: candidates.length,
  google_places_requests_made: listReq + deepReq,
  google_places_list_requests: listReq,
  google_places_deep_dive_requests: deepReq,
  confidence_tier_counts: counts,
  locations,
  excluded,
  severe_allegations_flagged: grades.severe_allegations ?? [],
  new_chains_or_clusters_found: grades.chains_or_clusters ?? [],
  marcus_family_found: grades.marcus_family_found ?? [],
};

assertChainRowsMapped(locations, CHAIN_NAMES); // fail loud before anything is written
writeFileSync(`${OUT}/staged-batch2-${state.toLowerCase()}.json`, JSON.stringify(output, null, 2));

console.log(`${state}: reviewed ${candidates.length} | ${JSON.stringify(counts)} | staged ${locations.length} | excluded ${excluded.length}`);
console.log(`Places requests logged for ${state}: ${listReq} list + ${deepReq} deep-dive = ${listReq + deepReq}`);
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
console.log(`Written to ${OUT}/staged-batch2-${state.toLowerCase()}.json`);
