// Phase C discovery pilot: merge the surviving candidates (Outscraper geo/
// contact data) with the confidence grades and hand-written synthesis into
// the final staged output — shaped to match the `locations` table columns,
// but written to a local file only. No writes to the live DB happen here.
//
// Only Confirmed/Likely/Uncertain candidates are staged (anything graded
// exclude or exclude_known_chain was already dropped before synthesis).
// chain_id stays null for every row this session — brand-cluster and
// recognized-chain flags are carried as pilot-only metadata
// (possible_chain_flag / recognized_chain_note) for human review, not
// resolved to a real chains.id, since that would require a live `chains`
// table write this pilot doesn't make.
//
// Usage: node build-staged-output.mjs
// Slugs come from the shared v3 rule (scripts/lib/slug-v3.mjs). Optional env LIVE_SNAPSHOT = JSON array of
// rows with a `slug`, reserved for collision handling.

import { readFileSync, writeFileSync } from "node:fs";
import { assertChainRowsMapped, slugFor } from "../lib/slug-v3.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

function cleanWebsiteUrl(url) {
  if (!url) return null;
  return url.replace(/%3F.*$/i, "").replace(/\?.*$/, "");
}

const candidates = readJson("scripts/phase-c-discovery/output/candidates.json");
const allGrades = readJson("scripts/phase-c-discovery/output/all-grades.json");
const synthesis = readJson("scripts/phase-c-discovery/output/synthesis.json");

const allCandidates = [...candidates.co, ...candidates.nc];
const gradeByKey = new Map(allGrades.map((g) => [`${g.name}|${g.city}`, g]));
const synthByKey = new Map(synthesis.map((s) => [`${s.name}|${s.city}`, s]));

const STAGED_TIERS = new Set(["confirmed", "likely", "uncertain"]);
const today = new Date().toISOString().slice(0, 10);

const staged = [];
const problems = [];
const takenSlugs = new Set(process.env.LIVE_SNAPSHOT ? readJson(process.env.LIVE_SNAPSHOT).map((r) => r.slug) : []);
if (!process.env.LIVE_SNAPSHOT) console.warn("LIVE_SNAPSHOT not set: slugs are only deduped within this run");
// Slug chain token: optional env CHAIN_NAMES_JSON = { "<place_id>": "<chains.name>" } for rows already
// resolved to a chain (exact chains.name). Unlisted rows are independents and get no chain token.
const CHAIN_NAMES = process.env.CHAIN_NAMES_JSON ? readJson(process.env.CHAIN_NAMES_JSON) : {};

for (const cand of allCandidates) {
  const key = `${cand.name}|${cand.city}`;
  const grade = gradeByKey.get(key);
  if (!grade) {
    problems.push(`No grade found for candidate: ${cand.name} (${cand.city}, ${cand.state_code})`);
    continue;
  }
  if (!STAGED_TIERS.has(grade.confidence)) continue;

  const synth = synthByKey.get(key);
  if (!synth) {
    problems.push(`Graded ${grade.confidence} but no synthesis entry: ${cand.name} (${cand.city}, ${cand.state_code})`);
    continue;
  }

  const { slug } = slugFor({ name: cand.name, city: cand.city, state: cand.state_code, place_id: cand.place_id }, CHAIN_NAMES[cand.place_id] ?? null, takenSlugs);
  takenSlugs.add(slug);

  staged.push({
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
    website_url: cleanWebsiteUrl(cand.website),
    ticketing_url: cleanWebsiteUrl(cand.website),
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
    status: synth.status_override ?? (cand.business_status === "OPERATIONAL" ? "active" : "temporarily_closed"),
    last_verified_date: today,
    // `photos` is spec'd as crowd-sourced/login-gated uploads only — never
    // scraped/warehoused third-party CDN content (see ROADMAP.md Phase D).
    // Outscraper's raw `photo` field is Google Places CDN and must not flow
    // into this column, unlike the rest of the pipeline's Phase B output.
    photos: null,
    is_sponsored: false,
    // Pilot-only tracking fields, not real `locations` columns:
    confidence_tier: grade.confidence,
    possible_chain_flag: cand.possible_chain_flag ?? false,
    recognized_chain_note: grade.recognized_chain_note ?? null,
    grading_note: grade.grading_note,
  });
}

const output = {
  pilot: "Phase C: Independent Theater Discovery (CO + NC)",
  generated_at: new Date().toISOString(),
  source_counts: {
    total_candidates: allCandidates.length,
    confirmed: allGrades.filter((g) => g.confidence === "confirmed").length,
    likely: allGrades.filter((g) => g.confidence === "likely").length,
    uncertain: allGrades.filter((g) => g.confidence === "uncertain").length,
    excluded: allGrades.filter((g) => g.confidence === "exclude" || g.confidence === "exclude_known_chain").length,
  },
  locations: staged,
};

assertChainRowsMapped(staged, CHAIN_NAMES); // fail loud before anything is written
writeFileSync("scripts/phase-c-discovery/output/indie-co-nc-staged.json", JSON.stringify(output, null, 2));

console.log(`Staged ${staged.length} of ${allCandidates.length} candidates.`);
if (problems.length) {
  console.log("\nProblems:");
  for (const p of problems) console.log(`  - ${p}`);
}
console.log(`\nWritten to scripts/phase-c-discovery/output/indie-co-nc-staged.json`);
