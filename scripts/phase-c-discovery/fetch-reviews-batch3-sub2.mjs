// Batch 3 Sub-batch 2 review pull (CT, UT, NV, IA, AR, KS). Copy of fetch-reviews-batch3-sub1.mjs (originals untouched). Reads
// output/candidates-batch3-sub2-review-set.json, logs COUNT-ONLY lines to output/places-requests-log-batch3-sub2.jsonl,
// HARD STOP at 400 cumulative requests for this sub-batch. Review text goes to stdout only, NEVER to a file.
// Usage: node --env-file=.env.local scripts/phase-c-discovery/fetch-reviews-batch3-sub2.mjs <STATE> <start> <count>

import { readFileSync, appendFileSync, existsSync } from "node:fs";

const OUT = "scripts/phase-c-discovery/output";
const CANDIDATES = `${OUT}/candidates-batch3-sub2-review-set.json`;
const LOG = `${OUT}/places-requests-log-batch3-sub2.jsonl`;
const NOVEMBER_BASELINE = 0; // this script counts ONLY this sub-batch (November's 1,000 free requests/month; check Cloud Console for the true month-to-date before each run)
const HALT_AT = 400; // hard stop: cumulative requests for this sub-batch

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
const args = process.argv.slice(2);
const deep = args[0] === "--deep";
if (deep) args.shift();
const [stateArg, a1, a2] = args;

if (!apiKey || !stateArg) {
  console.error("Usage: node --env-file=.env.local fetch-reviews-batch3-sub2.mjs <STATE> <start> <count>  |  --deep <STATE> <place_id> [langs]");
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
const candidates = readJson(CANDIDATES);
const state = stateArg.toUpperCase();
const list = candidates.by_state[state];
if (!list) {
  console.error(`Unknown state "${stateArg}", expected one of: ${Object.keys(candidates.by_state).join(", ")}`);
  process.exit(1);
}

const domainOf = (u) => {
  if (!u) return null;
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return u;
  }
};
const byDomain = new Map();
for (const [st, arr] of Object.entries(candidates.by_state)) {
  for (const p of arr) {
    const d = domainOf(p.website);
    if (!d) continue;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d).push(`${p.name} (${p.city}, ${st})`);
  }
}

function loggedTotal() {
  if (!existsSync(LOG)) return 0;
  return readFileSync(LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .reduce((n, line) => n + (JSON.parse(line).requests ?? 0), 0);
}

function guard(planned) {
  const projected = NOVEMBER_BASELINE + loggedTotal() + planned;
  if (projected > HALT_AT) {
    console.error(`HALT: projected sub-batch total ${projected} (November) would exceed ${HALT_AT}. Not fetching.`);
    process.exit(2);
  }
}

function header(entry) {
  const d = domainOf(entry.website);
  const sib = d ? (byDomain.get(d) ?? []).filter((s) => !s.startsWith(`${entry.name} (${entry.city}`)) : [];
  const flag = entry.possible_chain_flag
    ? ` [CHAIN-FLAGGED${entry.established_chain_match ? ": " + entry.established_chain_match : ""}]`
    : "";
  const shared = sib.length ? ` | SHARED DOMAIN with ${sib.length} other survivor(s): ${sib.join("; ")}` : "";
  return `${entry.name} (${entry.city}, ${entry.state_code})${flag}\nplace_id: ${entry.place_id} | website domain: ${d ?? "(none)"}${shared}`;
}

async function pull(placeId, lang) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${lang}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,reviews,businessStatus,rating,userRatingCount",
    },
  });
  return res;
}

let requests = 0;

if (deep) {
  const placeId = a1;
  const langs = (a2 ?? "en,es,fr").split(",");
  const entry = list.find((p) => p.place_id === placeId);
  if (!entry) {
    console.error(`place_id ${placeId} is not a ${state} survivor`);
    process.exit(1);
  }
  guard(langs.length);
  console.log(`DEEP-DIVE ${header(entry)}`);
  const seen = new Map();
  for (const lang of langs) {
    const res = await pull(placeId, lang);
    requests++;
    if (!res.ok) {
      console.log(`languageCode=${lang}: ERROR ${res.status}`);
      continue;
    }
    const data = await res.json();
    for (const r of data.reviews ?? []) {
      const key = r.name ?? `${r.publishTime}-${r.rating}-${(r.originalText?.text ?? r.text?.text ?? "").slice(0, 40)}`;
      if (!seen.has(key)) seen.set(key, r);
    }
  }
  console.log(`COMBINED: ${seen.size} distinct reviews across ${langs.length} language variants`);
  for (const r of seen.values()) {
    console.log(`--- ${r.rating}/5 stars, ${r.relativePublishTimeDescription ?? "(no date)"} ---`);
    console.log(r.originalText?.text ?? r.text?.text ?? "(no text)");
  }
  appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), state, mode: "deep", place_id: placeId, requests }) + "\n");
} else {
  const start = Number(a1 ?? 0);
  const count = Number(a2 ?? 6);
  const batch = list.slice(start, start + count);
  guard(batch.length);
  console.log(`Fetching reviews for ${state} candidates ${start}..${start + batch.length - 1} of ${list.length}`);
  for (const entry of batch) {
    const res = await pull(entry.place_id, "en");
    requests++;
    console.log(`\n=== ${header(entry)} ===`);
    if (!res.ok) {
      console.log(`ERROR ${res.status}: ${await res.text()}`);
      continue;
    }
    const data = await res.json();
    console.log(`Display name: ${data.displayName?.text} | status: ${data.businessStatus} | rating: ${data.rating ?? "n/a"} (${data.userRatingCount ?? 0} ratings)`);
    const reviews = data.reviews ?? [];
    if (reviews.length === 0) console.log("No reviews returned.");
    for (const r of reviews) {
      console.log(`--- ${r.rating}/5 stars, ${r.relativePublishTimeDescription} ---`);
      console.log(r.text?.text ?? "(no text)");
    }
  }
  appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), state, mode: "list", start, count: batch.length, requests }) + "\n");
}

console.error(`\n[fetch-reviews-batch3-sub2] ${requests} Place Details (Enterprise+Atmosphere) requests made this run. November sub-batch total (incl. baseline ${NOVEMBER_BASELINE}): ${NOVEMBER_BASELINE + loggedTotal()}`);
