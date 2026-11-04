// Batch 1 (10-state) independent-theater rollout: mechanical pre-spend
// exclusion pipeline, generalized from the CO+NC pilot's apply-exclusions.mjs
// to run over an arbitrary list of states in one pass. Same steps, same
// rationale (see that file's header comment) — extended here with:
//  - ESTABLISHED_CHAINS: regional/national chains already confirmed real and
//    given a `chains` row from the CO+NC pilot (Harkins, Emagine, Brenden,
//    Cinergy, CMX CinéBistro, Silverspot, Paragon, Picture Show, Golden
//    Ticket Cinemas, Santikos, R/C). A survivor matching one of these is
//    flagged with a note regardless of in-batch count (cumulative check per
//    pilot finding #8 — these are known real chains even at 1 occurrence).
//  - BRAND_PHRASES carries forward the previously mechanically-detected
//    clusters (including ones that had zero CO/NC survivors — Allen
//    Theatres, Hometown Cinemas, UEC Theatres, RCE Theaters, Premiere
//    Theatre — since they might surface here) plus fresh phrase-based
//    detection across Half 1 states combined.
//
// Batch 2 HALF 2 copy of apply-exclusions-batch2.mjs (the Batch 2 original is untouched). Half 2 = IN, MD, MO, WI, MN.
// Half 2 changes vs the Batch 2 original:
//  - already-seeded check reads output/live-locations-all-incl-unpublished.json (ALL rows incl. unpublished, 948 at sub-batch 2 prep, so a
//    theater that failed the meal standard cannot resurface) and runs BEFORE the Marcus bucket. Each already-seeded hit
//    is annotated with whether the matched live row is published (output/live-published-flags-batch3-sub2.json) and with any
//    Marcus signal, so Marcus-rule hits that are already live are reported as such.
//  - Marcus hold-out: HARD hold when website domain is marcustheatres.com or movietavern.com, or the name matches the
//    Marcus regex (incl. names ending in "Cine" and Wehrenberg-branded names), or city+state matches
//    ../phase-b-pilot/output/marcus-dining-list.json AND the name contains that theater's name token. A city+state
//    match alone goes to a soft REVIEW bucket that is reported and NOT dropped (the row stays a survivor).
//  - No Malco, Goodrich, Landmark, Evo or Showcase exclusion: they flow through grading and chain resolution.
//  - Writes candidates-batch3-sub2.json / exclusions-report-batch3-sub2.json.
//
// Original header (Batch 2):
// Batch 2 copy of apply-exclusions-batch1.mjs (Batch 1 original is untouched).
// Differences from Batch 1:
//  - Half 1 states only (VA, WA, AZ, TN, MA); Batch 3 sub-batch 1 states get added to STATES
//    in a later, separately approved run.
//  - Marcus-owned names are pulled into their own "marcus_held_out" bucket
//    (reported separately, not folded into known_chain), and the rule now also
//    matches names ending in "Cine" and Wehrenberg-branded names. Marcus
//    acquired all 14 Wehrenberg Theatres locations on 2016-12-16 and kept the
//    Wehrenberg name (Marcus Corp 10-K FY2016, sec.gov; trade press Nov 2016).
//  - Reads output/live-locations-batch2.json (refreshed from the live table).
//  - Writes candidates-batch2-half1.json / exclusions-report-batch2-half1.json.
//
// Usage: node scripts/phase-c-discovery/apply-exclusions-batch3-sub2.mjs scripts/phase-c-discovery/output
// (Batch 3 sub-batch 2 copy of apply-exclusions-batch3-sub1.mjs: CT, UT, NV, IA, AR, KS. Needs output/live-published-flags-batch3-sub2.json
// with exactly one row per row of live-locations-all-incl-unpublished.json.)
// (reads output/outscraper-raw-<state>.json for each state below and
// output/live-locations-batch2.json for the live-DB cross-check)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [, , outDir] = process.argv;
if (!outDir) {
  console.error("Usage: node scripts/phase-c-discovery/apply-exclusions-batch3-sub2.mjs <out-dir>");
  process.exit(1);
}

const STATES = ["ct", "ut", "nv", "ia", "ar", "ks"];
const STATE_ABBR = { ct: "CT", ut: "UT", nv: "NV", ia: "IA", ar: "AR", ks: "KS" };

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

function normalizeStreet(s) {
  return normalize(s).replace(/\b(suite|ste|bldg|building|unit)\b.*$/, "").trim();
}

function flattenRaw(raw) {
  const batches = Array.isArray(raw.data?.[0]) ? raw.data : [raw.data ?? []];
  return batches.flat().filter(Boolean);
}

const CINEMA_TYPES = new Set(["Movie theater", "Drive-in movie theater", "IMAX theater", "Outdoor movie theater"]);

const KNOWN_CHAINS = [
  "cinemark", "amc", "regal", "alamo drafthouse", "look cinema", "look dine-in",
  "studio movie grill", "flix brewhouse", "star cinema grill", "roadhouse cinemas",
  "majestic", "metropolitan", "metrolux", "smitty's cinema", "smittys cinema",
  "nitehawk", "ipic", "apple cinemas", "marcus theatres", "marcus theatre",
  "movie tavern", "bistroplex", "southeast cinemas", "showplace cinemas",
];

function matchesKnownChain(name) {
  const n = normalize(name);
  return KNOWN_CHAINS.some((c) => n.includes(normalize(c)));
}

// Marcus Theatres hold-out rule (reported as its own bucket). Marcus names
// locations "Marcus <City> Cinema[s]" with no "theatre" adjacent to "Marcus"
// (e.g. "Marcus Elgin Cinema") -- batch 1 found 7 of these that slipped the
// plain substring check. Batch 2 additions: names ending in "Cine" (legacy
// Wehrenberg-style naming, e.g. Marcus's O'Fallon IL page slug) and any
// Wehrenberg-branded name (Marcus-owned since 2016-12-16).
const MARCUS_SUBSTRINGS = ["marcus theatres", "marcus theatre", "movie tavern", "bistroplex", "wehrenberg"];
function matchesMarcus(name) {
  const n = normalize(name);
  if (MARCUS_SUBSTRINGS.some((c) => n.includes(c))) return true;
  if (/^marcus\b.*\b(cinema|cinemas|theatre|theatres|bistroplex|cine)\b/.test(n)) return true;
  return false;
}

// Regional/national chains already confirmed real by the CO+NC pilot and
// given a `chains` row — flagged whenever they appear, at any count.
const ESTABLISHED_CHAINS = [
  "harkins theatres", "emagine", "brenden theatres", "brenden", "cinergy",
  "cmx cinébistro", "cmx cinebistro", "silverspot cinema", "silverspot",
  "paragon theaters", "picture show", "golden ticket cinemas", "santikos", "r/c",
  // found via n-gram frequency scan of this batch's 644 survivors, not
  // present in the CO/NC pilot — each confirmed real via direct name
  // inspection before any review-pull spend (see turn's discussion):
  "cinepolis", "classic cinemas", "ncg cinemas", "cmx cinemas", "epic theatres",
  "b b theatres", "phoenix theatres", "premiere lux", "cinema de lux",
  "rooftop cinema club", "scene one", "celebration cinema", "flagship premium cinemas",
];

function containsPhrase(name, phrase) {
  const nameWords = normalize(name).split(" ").filter(Boolean);
  const phraseWords = normalize(phrase).split(" ").filter(Boolean);
  for (let i = 0; i <= nameWords.length - phraseWords.length; i++) {
    if (phraseWords.every((w, j) => nameWords[i + j] === w)) return true;
  }
  return false;
}

function matchesEstablishedChain(name) {
  return ESTABLISHED_CHAINS.find((c) => containsPhrase(name, c));
}

// ---- Marcus hold-out (Half 2): hard hold vs soft review.
const marcusList = readJson(fileURLToPath(new URL("../phase-b-pilot/output/marcus-dining-list.json", import.meta.url))).theaters;
const MARCUS_DOMAINS = ["marcustheatres.com", "movietavern.com"];
function websiteDomain(p) {
  try { return new URL(p.website.startsWith("http") ? p.website : "https://" + p.website).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
// returns { hard: "signal" | null, soft: "signal" | null }
function marcusSignals(p, stateAbbr) {
  const dom = websiteDomain(p);
  if (MARCUS_DOMAINS.some((d) => dom === d || dom.endsWith("." + d))) return { hard: "website domain " + dom, soft: null };
  if (matchesMarcus(p.name)) return { hard: "name regex", soft: null };
  const n = normalize(p.name);
  const cityMatches = marcusList.filter((t) => normalize(t.city) === normalize(p.city) && t.state === stateAbbr);
  if (cityMatches.length) {
    const tokenHit = cityMatches.find((t) => n.includes(normalize(t.theater)));
    if (tokenHit) return { hard: `dining-list city+state + name token "${tokenHit.theater}"`, soft: null };
    return { hard: null, soft: `dining-list city+state match only (${cityMatches.map((t) => t.theater).join(", ")})` };
  }
  return { hard: null, soft: null };
}

const liveDb = readJson(`${outDir}/live-locations-all-incl-unpublished.json`);
const liveFlags = readJson(`${outDir}/live-published-flags-batch3-sub2.json`);
if (liveDb.length !== liveFlags.length) { console.error("live dedupe file and flags file differ in length"); process.exit(1); }
const livePubByPlaceId = new Map(liveFlags.filter((l) => l.place_id).map((l) => [l.place_id, l.is_published]));
const livePubByStreet = new Map(liveFlags.map((l) => [`${normalizeStreet(l.address)}|${l.state}`, l.is_published]));
const livePlaceIds = new Set(liveDb.map((l) => l.place_id).filter(Boolean));
const liveByStreetState = new Map(
  liveDb.map((l) => [`${normalizeStreet(l.address)}|${l.state}`, l])
);

function processState(stateCode) {
  const stateAbbr = STATE_ABBR[stateCode];
  const raw = readJson(`${outDir}/outscraper-raw-${stateCode}.json`);
  const all = flattenRaw(raw);

  const seen = new Set();
  const deduped = [];
  for (const p of all) {
    if (p.place_id && seen.has(p.place_id)) continue;
    if (p.place_id) seen.add(p.place_id);
    deduped.push(p);
  }

  const dropped = { off_state: [], non_business: [], permanently_closed: [], non_cinema_category: [], already_seeded: [], marcus_held_out: [], known_chain: [] };
  const marcusReview = [];

  let pool = deduped;

  pool = pool.filter((p) => {
    const ok = (p.state_code || "").toUpperCase() === stateAbbr;
    if (!ok) dropped.off_state.push({ name: p.name, city: p.city, state_code: p.state_code });
    return ok;
  });

  pool = pool.filter((p) => {
    const isPlaceholder = !p.type && p.rating == null && p.reviews == null;
    if (isPlaceholder) dropped.non_business.push({ name: p.name, city: p.city, website: p.website });
    return !isPlaceholder;
  });

  pool = pool.filter((p) => {
    const closed = p.business_status === "CLOSED_PERMANENTLY";
    if (closed) dropped.permanently_closed.push({ name: p.name, city: p.city, address: p.address });
    return !closed;
  });

  pool = pool.filter((p) => {
    const hasType = !!p.type;
    const keep = !hasType || CINEMA_TYPES.has(p.type);
    if (!keep) dropped.non_cinema_category.push({ name: p.name, city: p.city, type: p.type, subtypes: p.subtypes });
    return keep;
  });

  pool = pool.filter((p) => {
    const byPlaceId = p.place_id && livePlaceIds.has(p.place_id);
    const byAddress = liveByStreetState.get(`${normalizeStreet(p.street ?? p.address)}|${stateAbbr}`);
    const seeded = byPlaceId || !!byAddress;
    if (seeded) {
      const pub = byPlaceId ? livePubByPlaceId.get(p.place_id) : livePubByStreet.get(`${normalizeStreet(p.street ?? p.address)}|${stateAbbr}`);
      const sig = marcusSignals(p, stateAbbr);
      dropped.already_seeded.push({ name: p.name, city: p.city, address: p.address, matched_live: byAddress?.name ?? "(place_id match)", live_is_published: pub, marcus_signal: sig.hard ?? sig.soft });
    }
    return !seeded;
  });

  pool = pool.filter((p) => {
    const sig = marcusSignals(p, stateAbbr);
    if (sig.hard) { dropped.marcus_held_out.push({ name: p.name, city: p.city, state: p.state_code, address: p.address, website: p.website, signal: sig.hard }); return false; }
    if (sig.soft) marcusReview.push({ name: p.name, city: p.city, state: p.state_code, address: p.address, website: p.website, signal: sig.soft });
    return true;
  });

  pool = pool.filter((p) => {
    const isChain = matchesKnownChain(p.name);
    if (isChain) dropped.known_chain.push({ name: p.name, city: p.city, address: p.address });
    return !isChain;
  });


  return { state: stateAbbr, raw_total: all.length, deduped_total: deduped.length, survivors: pool, dropped, marcusReview };
}

const results = STATES.map(processState);
const allSurvivors = results.flatMap((r) => r.survivors.map((p) => ({ ...p, __state: r.state })));

// Brand clustering across Batch 3 sub-batch 2 states combined.
const BRAND_PHRASES = [
  "allen theatres", "golden ticket cinemas", "uec theatres", "r/c", "rce theaters",
  "premiere theatre", "picture show", "santikos",
  "harkins theatres", "emagine", "brenden theatres", "cinergy", "cmx cinébistro",
  "silverspot cinema", "paragon theaters",
  "cinepolis", "classic cinemas", "ncg cinemas", "cmx cinemas", "epic theatres",
  "b b theatres", "phoenix theatres", "premiere lux", "cinema de lux",
  "rooftop cinema club", "scene one", "celebration cinema", "flagship premium cinemas",
];

const nameGroups = new Map();
for (const p of allSurvivors) {
  const key = normalize(p.name);
  if (!nameGroups.has(key)) nameGroups.set(key, []);
  nameGroups.get(key).push(p);
}
const exactClusters = [...nameGroups.entries()]
  .filter(([, group]) => group.length >= 2)
  .map(([key, group]) => ({
    brand: key,
    method: "exact_name",
    count: group.length,
    locations: group.map((p) => ({ name: p.name, city: p.city, state: p.state_code, address: p.address })),
  }));

const phraseClusters = [];
for (const phrase of BRAND_PHRASES) {
  const matches = allSurvivors.filter((p) => containsPhrase(p.name, phrase));
  if (matches.length >= 2) {
    phraseClusters.push({
      brand: phrase,
      method: "shared_brand_phrase",
      count: matches.length,
      locations: matches.map((p) => ({ name: p.name, city: p.city, state: p.state_code, address: p.address })),
    });
  }
}

const brandClusters = [...exactClusters, ...phraseClusters];

const clusteredNameKeys = new Set();
for (const c of brandClusters) {
  for (const loc of c.locations) clusteredNameKeys.add(`${normalize(loc.name)}|${loc.city}|${loc.state}`);
}

const tagBrand = (p) => {
  const establishedMatch = matchesEstablishedChain(p.name);
  return {
    ...p,
    possible_chain_flag: clusteredNameKeys.has(`${normalize(p.name)}|${p.city}|${p.state_code}`) || !!establishedMatch,
    established_chain_match: establishedMatch ?? null,
  };
};

const candidates = {
  generated_at: new Date().toISOString(),
  by_state: Object.fromEntries(results.map((r) => [r.state, r.survivors.map(tagBrand)])),
  brand_clusters: brandClusters,
};

const report = {
  generated_at: new Date().toISOString(),
  by_state: Object.fromEntries(
    results.map((r) => [
      r.state,
      {
        raw_total: r.raw_total,
        deduped_total: r.deduped_total,
        survivor_count: r.survivors.length,
        dropped_counts: Object.fromEntries(Object.entries(r.dropped).map(([k, v]) => [k, v.length])),
      },
    ])
  ),
  brand_clusters: brandClusters,
  marcus_soft_review: Object.fromEntries(results.map((r) => [r.state, r.marcusReview])),
  dropped_detail: Object.fromEntries(results.map((r) => [r.state, r.dropped])),
};

writeFileSync(`${outDir}/candidates-batch3-sub2.json`, JSON.stringify(candidates, null, 2));
writeFileSync(`${outDir}/exclusions-report-batch3-sub2.json`, JSON.stringify(report, null, 2));

let totalSurvivors = 0;
for (const r of results) {
  console.log(`=== ${r.state} ===`);
  console.log(`Raw: ${r.raw_total}, deduped: ${r.deduped_total}`);
  for (const [k, v] of Object.entries(r.dropped)) console.log(`  dropped (${k}): ${v.length}`);
  console.log(`  marcus soft REVIEW (kept as survivors): ${r.marcusReview.length}`);
  console.log(`  SURVIVORS: ${r.survivors.length}`);
  totalSurvivors += r.survivors.length;
}

console.log(`\nBrand clusters flagged: ${brandClusters.length}`);
for (const c of brandClusters) {
  console.log(`  - "${c.brand}" (${c.method}) x${c.count}: ${c.locations.map((l) => `${l.name} — ${l.city}, ${l.state}`).join(" / ")}`);
}

console.log(`\nTotal survivors across Batch 3 sub-batch 2 states: ${totalSurvivors}`);
console.log(`Wrote candidates to ${outDir}/candidates-batch3-sub2.json`);
console.log(`Wrote full report to ${outDir}/exclusions-report-batch3-sub2.json`);
