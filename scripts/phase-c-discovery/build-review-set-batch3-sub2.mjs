// Batch 3 Sub-batch 2 (CT, UT, NV, IA, AR, KS): build the review set from the exclusions output.
//
// Reads  output/candidates-batch3-sub2.json  (written by apply-exclusions-batch3-sub2.mjs: { generated_at, by_state, brand_clusters })
// Writes output/candidates-batch3-sub2-review-set.json  ({ generated_at, drops, by_state, brand_clusters }), the file that
// fetch-reviews-batch3-sub2.mjs and build-staged-batch3-sub2.mjs read.
//
// Rule (inferred from how sub-batch 1's review set relates to its candidates file; see the sub-batch 1 equivalence test):
//   review set = candidates minus a short list of "drops". Every surviving row is copied unchanged (same fields, same order);
//   brand_clusters is copied unchanged; each drop is logged as { state, name, city, place_id, reason }, in candidate order.
//   Drops come from three sources, in this precedence:
//     1. MANUAL_DROPS (optional JSON file of { place_id, reason }): the judgement calls (IMAX-only listings, museum/military/
//        non-public screens). Reason strings used in sub-batch 1: "imax_or_museum_or_nonpublic".
//     2. drive-ins: name matches /drive[\s-]?in/i or the Google type/subtypes say drive-in. Reason "drive_in".
//     3. website domain belongs to a chain operator already tracked in the DB (CHAIN_OPERATOR_DOMAINS):
//        reason "known_chain_operator_domain:<domain>".
//   Nothing is capped and no row is added. Rows that merely look like IMAX/museum venues are NOT dropped automatically
//   (sub-batch 1 kept several, e.g. "CMX Hollywood 16 & IMAX"); they are printed for review so MANUAL_DROPS can be filled in.
//
// Pure: no network, no DB. Refuses to overwrite an existing output file unless REVIEWSET_OVERWRITE=1.
// Usage: node scripts/phase-c-discovery/build-review-set-batch3-sub2.mjs
//
// ---- parameters (env vars override, used for the sub-batch 1 equivalence test) ----
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "scripts/phase-c-discovery/output";
const STATES = (process.env.REVIEWSET_STATES ?? "CT,UT,NV,IA,AR,KS").split(",");
const INPUT = process.env.REVIEWSET_INPUT ?? `${OUT}/candidates-batch3-sub2.json`;
const OUTPUT = process.env.REVIEWSET_OUTPUT ?? `${OUT}/candidates-batch3-sub2-review-set.json`;
const MANUAL_DROPS_FILE = process.env.REVIEWSET_MANUAL_DROPS ?? `${OUT}/review-set-manual-drops-batch3-sub2.json`; // optional
const CHAIN_OPERATOR_DOMAINS = ["cinemark.com", "amctheatres.com"];
const DRIVE_IN = /drive[\s-]?in/i;

const die = (msg) => {
  console.error(`build-review-set: ${msg}`);
  process.exit(1);
};
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const domainOf = (u) => {
  try {
    return new URL(u.startsWith("http") ? u : "https://" + u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

if (!existsSync(INPUT)) die(`input not found: ${INPUT} (run apply-exclusions-batch3-sub2.mjs first)`);
const cand = readJson(INPUT);
if (!cand.by_state || typeof cand.by_state !== "object") die(`${INPUT} has no by_state object`);
const missing = STATES.filter((s) => !Array.isArray(cand.by_state[s]));
if (missing.length) die(`${INPUT} has no rows array for state(s): ${missing.join(", ")}`);
const extra = Object.keys(cand.by_state).filter((s) => !STATES.includes(s));
if (extra.length) die(`${INPUT} has unexpected state(s) not in STATES: ${extra.join(", ")}`);
const total = STATES.reduce((n, s) => n + cand.by_state[s].length, 0);
if (total === 0) die(`${INPUT} has zero candidate rows`);
if (existsSync(OUTPUT) && process.env.REVIEWSET_OVERWRITE !== "1") die(`refusing to overwrite existing ${OUTPUT} (set REVIEWSET_OVERWRITE=1 to allow)`);

// manual drops (optional file): [{ place_id, reason }]
let manual = new Map();
if (existsSync(MANUAL_DROPS_FILE)) {
  const list = readJson(MANUAL_DROPS_FILE);
  if (!Array.isArray(list)) die(`${MANUAL_DROPS_FILE} must be an array of { place_id, reason }`);
  const known = new Set(STATES.flatMap((s) => cand.by_state[s].map((p) => p.place_id)));
  for (const d of list) {
    if (!d.place_id || !d.reason) die(`manual drop needs place_id and reason: ${JSON.stringify(d)}`);
    if (!known.has(d.place_id)) die(`manual drop place_id not in ${INPUT}: ${d.place_id}`);
  }
  manual = new Map(list.map((d) => [d.place_id, d.reason]));
}

const drops = [];
const by_state = {};
const reviewSignals = [];
for (const st of STATES) {
  by_state[st] = [];
  for (const p of cand.by_state[st]) {
    let reason = manual.get(p.place_id) ?? null;
    if (!reason && (DRIVE_IN.test(p.name ?? "") || DRIVE_IN.test(p.type ?? "") || DRIVE_IN.test(JSON.stringify(p.subtypes ?? "")))) reason = "drive_in";
    if (!reason) {
      const d = domainOf(p.website ?? "");
      const hit = CHAIN_OPERATOR_DOMAINS.find((c) => d === c || d.endsWith("." + c));
      if (hit) reason = `known_chain_operator_domain:${hit}`;
    }
    if (reason) {
      drops.push({ state: st, name: p.name, city: p.city, place_id: p.place_id, reason });
    } else {
      by_state[st].push(p);
      if (/imax|museum|tourist attraction|education center|science|military|base exchange/i.test(`${p.name} ${p.type ?? ""} ${JSON.stringify(p.subtypes ?? "")} ${p.website ?? ""}`)) {
        reviewSignals.push(`${st} | ${p.name} | ${p.city} | ${p.type ?? ""} | ${JSON.stringify(p.subtypes ?? "")}`);
      }
    }
  }
}
const kept = STATES.reduce((n, s) => n + by_state[s].length, 0);
if (kept === 0) die("every candidate was dropped; refusing to write an empty review set");
for (const st of STATES) if (by_state[st].length === 0) console.warn(`warning: no review-set rows left for ${st}`);

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify({ generated_at: new Date().toISOString(), drops, by_state, brand_clusters: cand.brand_clusters ?? [] }, null, 2));

console.log(`candidates ${total} -> review set ${kept}, drops ${drops.length}: ${JSON.stringify(drops.reduce((a, d) => ((a[d.reason.split(":")[0]] = (a[d.reason.split(":")[0]] || 0) + 1), a), {}))}`);
console.log(`per state: ${STATES.map((s) => `${s} ${by_state[s].length}`).join(", ")}`);
console.log(`wrote ${OUTPUT}`);
if (reviewSignals.length) {
  console.log(`\n${reviewSignals.length} KEPT row(s) look like IMAX/museum/military/non-public venues. Review them; add place_ids to ${MANUAL_DROPS_FILE} if they should be dropped, then re-run with REVIEWSET_OVERWRITE=1:`);
  for (const l of reviewSignals) console.log("  - " + l);
}
