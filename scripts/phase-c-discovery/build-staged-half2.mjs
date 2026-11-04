// Batch 2 Half 2 (IN, MD, MO, WI, MN): merge the five per-state grade files (output/grades-half2-<st>.json, paraphrased
// verdicts only, no review text) with the Outscraper candidate data into local staging files. Local files only: NO writes
// to the live DB. photos is ALWAYS null; chain_id is ALWAYS null (the proposal file holds the link actions).
//
// Usage: node scripts/phase-c-discovery/build-staged-half2.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { assertChainRowsMapped, slugFor } from "../lib/slug-v3.mjs";

const OUT = "scripts/phase-c-discovery/output";
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const cleanUrl = (u) => (u ? u.replace(/%3F.*$/i, "").replace(/\?.*$/, "") : null);
const domainOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
const sentences = (t) => (t.match(/[^.!?]+[.!?]+(?=\s|$)/g) || []).length;

const STATES = ["IN", "MD", "MO", "WI", "MN"];
const set = readJson(`${OUT}/candidates-half2-review-set.json`);
const cand = new Map();
for (const [st, arr] of Object.entries(set.by_state)) for (const p of arr) cand.set(p.place_id, { ...p, __state: st });
const takenSlugs = new Set(readJson(process.env.LIVE_SNAPSHOT).map((r) => r.slug)); // live + staged-so-far
// Slug chain token: optional env CHAIN_NAMES_JSON = { "<place_id>": "<chains.name>" } for rows already
// resolved to a chain (exact chains.name). Unlisted rows are independents and get no chain token.
const CHAIN_NAMES = process.env.CHAIN_NAMES_JSON ? readJson(process.env.CHAIN_NAMES_JSON) : {};

const DELIVERY = new Set(["in_seat_delivery", "counter_pickup", "unknown"]);
const ALCOHOL = new Set(["none", "beer_wine", "full_bar", "unknown"]);
const today = new Date().toISOString().slice(0, 10);

const staged = [], held = [], fails = [], flagged = [], handCapture = [], closed = [], problems = [];
const perState = {};
let requests = 0;

for (const st of STATES) {
  const g = readJson(`${OUT}/grades-half2-${st.toLowerCase()}.json`);
  requests += g.requests_made ?? 0;
  const counts = { qualifies: 0, borderline: 0, fails: 0, operator_upgrades: 0 };
  const ids = new Set();
  for (const e of g.entries) {
    ids.add(e.place_id);
    const c = cand.get(e.place_id);
    if (!c) { problems.push(`entry not in review set: ${e.name}`); continue; }
    counts[e.tier]++;
    if (e.tier === "qualifies" && e.operator_upgraded) counts.operator_upgrades++;
    if (e.tier === "qualifies") {
      if (!e.description) problems.push(`no description: ${e.name}`);
      else if (sentences(e.description) < 4 || sentences(e.description) > 6) problems.push(`sentence count ${sentences(e.description)}: ${e.name}`);
      if (!DELIVERY.has(e.delivery_style)) problems.push(`bad delivery: ${e.name}`);
      if (!ALCOHOL.has(e.alcohol_served)) problems.push(`bad alcohol: ${e.name}`);
      const { slug } = slugFor({ name: c.name, city: c.city, state: c.state_code ?? st, place_id: c.place_id }, CHAIN_NAMES[c.place_id] ?? null, takenSlugs);
      takenSlugs.add(slug);
      staged.push({
        slug, name: c.name, chain_id: null, sub_brand: null,
        address: c.street ?? c.address, city: c.city, state: c.state_code, zip: c.postal_code ?? null,
        lat: c.latitude, lng: c.longitude, place_id: c.place_id, fsq_id: null, phone: c.phone ?? null,
        website_url: cleanUrl(c.website), ticketing_url: cleanUrl(c.website), hours: null,
        delivery_style: e.delivery_style, alcohol_served: e.alcohol_served,
        age_restricted_auditoriums: null, reserved_recliners: e.reserved_recliners ?? null,
        menu_price_range: e.menu_price_range ?? null, amenities: e.amenities ?? null,
        accessibility_notes: e.accessibility_notes ?? null, parking_notes: e.parking_notes ?? null,
        safety_notes: e.safety_notes ?? null, description: e.description,
        status: e.status_override ?? (c.business_status === "OPERATIONAL" ? "active" : "temporarily_closed"),
        last_verified_date: today, photos: null, is_sponsored: false, is_published: true,
        // pilot-only tracking fields, not real `locations` columns:
        website_domain: domainOf(c.website), grading_basis: e.basis, entree_items: e.entree_items ?? [],
        operator_upgraded: !!e.operator_upgraded, operator_url: e.operator_url ?? null, operator_items: e.operator_items ?? [],
        chain_note: e.chain_note ?? null,
      });
    } else if (e.tier === "borderline") {
      held.push({ place_id: e.place_id, name: c.name, city: c.city, state: st, website_domain: domainOf(c.website), reason: e.basis, entree_items: e.entree_items ?? [], operator_url: e.operator_url ?? null, operator_items: e.operator_items ?? [], chain_note: e.chain_note ?? null });
    } else {
      fails.push({ place_id: e.place_id, name: c.name, city: c.city, state: st, website_domain: domainOf(c.website), category: e.fail_category, reason: e.basis });
    }
  }
  for (const p of set.by_state[st]) if (!ids.has(p.place_id)) problems.push(`UNGRADED: ${p.name} (${st})`);
  for (const s of g.severe_allegations ?? []) flagged.push({ state: st, venue: s.venue, paraphrase: s.paraphrase });
  for (const h of g.hand_capture ?? []) handCapture.push({ ...h, state: h.state ?? st });
  for (const x of g.closed_venues ?? []) closed.push({ state: st, ...x });
  perState[st] = { reviewed: g.entries.length, ...counts };
}

assertChainRowsMapped(staged, CHAIN_NAMES); // fail loud before anything is written
writeFileSync(`${OUT}/half2-staged-qualifies.json`, JSON.stringify({ generated_at: new Date().toISOString(), per_state: perState, count: staged.length, locations: staged }, null, 2));
writeFileSync(`${OUT}/half2-held-borderline.json`, JSON.stringify({ generated_at: new Date().toISOString(), count: held.length, rows: held }, null, 2));
const mech = readJson(`${OUT}/exclusions-report-batch2-half2.json`);
writeFileSync(`${OUT}/half2-exclusions-log.json`, JSON.stringify({
  generated_at: new Date().toISOString(),
  mechanical_exclusions: mech.by_state,
  review_set_drops: ["IMAX Theatre in the Indiana State Museum (IN)", "IMAX, Evansville (IN, Showplace screen listing)", "IMAX at the Maryland Science Center (MD)", "Omnimax Theater (MO)", "Imax, Springfield (MO, AMC screen listing)", "IMAX Entertainment Complex, Branson (MO)"],
  marcus_domain_held_out_never_reviewed: Object.entries(mech.dropped_detail).flatMap(([s, d]) => d.marcus_held_out.map((m) => ({ state: s, ...m }))),
  graded_fails: fails,
}, null, 2));
writeFileSync(`${OUT}/half2-flagged-allegations.json`, JSON.stringify({ generated_at: new Date().toISOString(), note: "paraphrases only; none of this content appears in any staged description or safety_notes", count: flagged.length, rows: flagged }, null, 2));
writeFileSync(`${OUT}/half2-hand-capture-list.json`, JSON.stringify({ generated_at: new Date().toISOString(), count: handCapture.length, rows: handCapture }, null, 2));

console.log(JSON.stringify(perState));
console.log(`staged ${staged.length} | held borderline ${held.length} | graded fails ${fails.length} | flagged ${flagged.length} | hand-capture ${handCapture.length} | closed ${closed.length} | requests ${requests}`);
if (problems.length) { console.log("PROBLEMS:"); problems.forEach((p) => console.log("  - " + p)); process.exitCode = 1; }
