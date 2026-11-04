// Marcus completion: merge matched Outscraper candidates with hand-written grades
// (marcus-completion-grades-part*.json) into marcus-completion-staged.json plus a
// flagged-allegations file. Local files only; no live writes (the live table is
// read only to check place_id / slug collisions). chain_id is the existing Marcus row.
//
// Usage: node --env-file=.env.local scripts/phase-b-pilot/build-marcus-completion-staged.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { slugFor } from "../lib/slug-v3.mjs";

const OUT = "scripts/phase-b-pilot/output/";
const MARCUS = "6eace755-4aa5-48f2-b0f8-dc7162e7363a";
const rd = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const cleanUrl = (u) => (u ? u.replace(/%3F.*$/i, "").replace(/\?.*$/, "") : null);
const domainOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
const phone10 = (p) => (p ? p.replace(/\D/g, "").slice(-10) : null);

const cands = rd(`${OUT}marcus-completion-candidates.json`);
const grades = new Map();
for (const f of readdirSync(OUT).filter((f) => /^marcus-completion-grades-part\d+\.json$/.test(f)).sort()) {
  for (const g of rd(OUT + f)) grades.set(g.place_id, g);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const live = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("locations").select("place_id,slug,address,state").order("id").range(from, from + 999);
  if (error) throw new Error(error.message);
  live.push(...data);
  if (data.length < 1000) break;
}
const livePlace = new Set(live.map((r) => r.place_id));
const takenSlugs = new Set(live.map((r) => r.slug)); // live + staged-so-far
// chain token for the v3 slug rule: the existing Marcus row's exact chains.name (read-only)
const { data: marcusChain, error: chainErr } = await sb.from("chains").select("name").eq("id", MARCUS).single();
if (chainErr) throw new Error(chainErr.message);

const DEL = new Set(["in_seat_delivery", "counter_pickup", "unknown"]);
const ALC = new Set(["none", "beer_wine", "full_bar", "unknown"]);
const PR = new Set(["$", "$$", "$$$", null]);
const leak = /rodent|\brats?\b|\bmice\b|\bmouse\b|vermin|pest|roach|\bbugs?\b|\bflies\b|odor|smell|musty|mold|filth|urine|sewer|cricket|manager|owner|employee|staff member|discriminat|racis|profil|overcharg|kicked out|ejected|theft|\bstole\b|raw chicken|food poison|\bsick\b/i;
const today = new Date().toISOString().slice(0, 10);

const locations = [];
const problems = [];
const flagged = [];
for (const c of cands) {
  const g = grades.get(c.place_id);
  if (!g) { problems.push(`UNGRADED: ${c.theater} (${c.state})`); continue; }
  if (livePlace.has(c.place_id)) problems.push(`place_id already live: ${c.theater}`);
  if (!DEL.has(g.delivery_style)) problems.push(`bad delivery_style: ${c.theater}`);
  if (!ALC.has(g.alcohol_served)) problems.push(`bad alcohol_served: ${c.theater}`);
  if (!PR.has(g.menu_price_range ?? null)) problems.push(`bad menu_price_range: ${c.theater}`);
  // field mapping per ruling
  if (c.bars && g.alcohol_served !== "full_bar") problems.push(`Bars listed but alcohol_served=${g.alcohol_served}: ${c.theater}`);
  if (!c.bars && g.alcohol_served !== "unknown") problems.push(`no Bars listed but alcohol_served=${g.alcohol_served}: ${c.theater}`);
  if (c.concepts.includes("In-Theatre Dining") && g.delivery_style !== "in_seat_delivery") problems.push(`In-Theatre Dining but delivery=${g.delivery_style}: ${c.theater}`);
  if (!c.concepts.includes("In-Theatre Dining") && g.delivery_style === "in_seat_delivery") problems.push(`non-In-Theatre concept mapped to in_seat_delivery: ${c.theater}`);
  const sentences = (g.description.match(/[.!?](\s|$)/g) || []).length;
  if (sentences < 4 || sentences > 6) problems.push(`description sentences=${sentences}: ${c.theater}`);
  const lk = (g.description + " " + (g.safety_notes || "") + " " + (g.accessibility_notes || "")).match(leak);
  if (lk) problems.push(`leak-scan hit "${lk[0]}" in public text: ${c.theater}`);

  const name = c.google_name;
  const { slug } = slugFor({ name, city: c.google_city || c.city, state: c.state, place_id: c.place_id }, marcusChain.name, takenSlugs);
  takenSlugs.add(slug);
  const web = cleanUrl(c.website);

  locations.push({
    slug, name, chain_id: MARCUS, sub_brand: c.sub_brand,
    address: c.address, city: c.google_city || c.city, state: c.state, zip: c.postal_code,
    lat: c.latitude, lng: c.longitude, place_id: c.place_id, fsq_id: null, phone: phone10(c.phone),
    website_url: web, ticketing_url: web, hours: null,
    delivery_style: g.delivery_style, alcohol_served: g.alcohol_served, age_restricted_auditoriums: null,
    reserved_recliners: g.reserved_recliners ?? null, menu_price_range: g.menu_price_range ?? null,
    amenities: g.amenities ?? null, accessibility_notes: g.accessibility_notes ?? null, parking_notes: g.parking_notes ?? null,
    safety_notes: g.safety_notes ?? null, description: g.description,
    status: g.status_override ?? (c.business_status === "OPERATIONAL" ? "active" : "temporarily_closed"),
    last_verified_date: today,
    photos: null, is_sponsored: false,
    // pilot-only tracking fields (not real columns):
    dining_concepts: c.concepts, dining_group: c.group, reinstated_venue: c.reinstated,
    grading_note: g.evidence_note, website_domain: domainOf(c.website),
  });
  for (const s of g.severe ?? []) flagged.push({ venue: name, city: c.city, state: c.state, summary: s });
}

const out = {
  chain: "Marcus Theatres", chain_id: MARCUS, generated_at: new Date().toISOString(),
  source: "Dining facts: marcus-dining-list.json (Luke's browser capture of Marcus's own dining page). Geo/contact: Outscraper per-location queries. Reviews: Google Places, 1 request per venue. marcustheatres.com was never fetched.",
  staged_count: locations.length,
  by_state: locations.reduce((a, l) => ((a[l.state] = (a[l.state] || 0) + 1), a), {}),
  locations,
};
writeFileSync(`${OUT}marcus-completion-staged.json`, JSON.stringify(out, null, 2));
writeFileSync(`${OUT}flagged-allegations-marcus-completion.json`, JSON.stringify({ note: "Internal log. Paraphrased; no raw review text. Single-source severe staff-conduct, discrimination, sanitation/pest and facility claims are kept out of descriptions and safety_notes.", flagged }, null, 2));

console.log(`staged ${locations.length} of ${cands.length} candidates | by state ${JSON.stringify(out.by_state)} | flagged entries ${flagged.length}`);
const dist = {};
for (const l of locations) { const k = `${l.delivery_style}/${l.alcohol_served}`; dist[k] = (dist[k] || 0) + 1; }
console.log("delivery/alcohol distribution:", JSON.stringify(dist));
console.log("sub_brand:", JSON.stringify(locations.reduce((a, l) => ((a[l.sub_brand] = (a[l.sub_brand] || 0) + 1), a), {})), "| photos non-null:", locations.filter((l) => l.photos !== null).length, "| chain_id != Marcus:", locations.filter((l) => l.chain_id !== MARCUS).length);
console.log("problems:", problems.length);
for (const p of problems) console.log("  -", p);
if (problems.length) process.exitCode = 1;
