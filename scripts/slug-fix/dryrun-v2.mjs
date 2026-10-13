// DRY RUN ONLY (v2). Computes proposed slugs for ALL rows from a snapshot.
// No database writes, no application changes. v1 files are left untouched.
//
// Rule v2, applied in this order:
//  1. base = slugify(name): accents folded, "&" removed with no hyphen
//     inserted (B&B -> bb), apostrophes dropped, ASCII, hyphenated, lowercase.
//  2. chain token: for rows with a chain, chainToken = slugify(chain.name with
//     parentheticals removed). If the base already contains the chain's first
//     word as a whole segment, nothing is added; otherwise the chain token is
//     prepended. (Leading articles "the/a/an" are skipped when picking the
//     first word.)
//  3. city: append slugify(city) unless its segment sequence is already in
//     the slug as whole segments.
//  4. strip a leading "indie-", a leading own-state code, and duplicated
//     adjacent segment runs ("x-x", "a-b-a-b").
//  5. collisions (vs other proposed slugs and slugs that stay unchanged):
//     append the lowercase state code, then the place_id last 6, then -2/-3.
//  6. keep the current slug when it already equals the v2 output.
//
// Usage: node dryrun-v2.mjs [snapshot.json]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const outDir = join(here, "output");
const snapshotFile = process.argv[2] ?? join(outDir, "locations-snapshot-v2-2026-10-13.json");
const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));
const all = snapshot.locations;
const chainById = new Map(snapshot.chains.map((c) => [c.id, c.name]));

const STATE_CODES = new Set(
  "al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy".split(" ")
);
const LEADING_ARTICLES = new Set(["the", "a", "an"]);
const MAX_LEN = 70;

const slugify = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’‘`´]/g, "")
    .replace(/&/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const chainTokenOf = (chainName) => slugify(chainName.replace(/\([^)]*\)/g, " "));
const firstWordOf = (token) => {
  const words = token.split("-");
  return words.find((w) => !LEADING_ARTICLES.has(w)) ?? words[0];
};

function containsSeq(segs, seq) {
  if (!seq.length) return true;
  for (let i = 0; i + seq.length <= segs.length; i++) {
    if (seq.every((w, j) => segs[i + j] === w)) return true;
  }
  return false;
}

function collapseRepeats(segs, log) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let n = 3; n >= 1 && !changed; n--) {
      for (let i = 0; i + 2 * n <= segs.length; i++) {
        const a = segs.slice(i, i + n).join("-");
        const b = segs.slice(i + n, i + 2 * n).join("-");
        if (a === b) {
          log.push(a);
          segs.splice(i + n, n);
          changed = true;
          break;
        }
      }
    }
  }
  return segs;
}

// overrides: { [chainName]: shortBrandToken } — empty for the primary run.
function candidateFor(row, overrides = {}) {
  const notes = { prepended: false, strippedIndie: false, strippedState: false, collapsed: [] };
  const chainName = row.chain_id ? chainById.get(row.chain_id) : null;

  let segs = slugify(row.name).split("-").filter(Boolean);

  // An override of "" means this chain's name is an operator/catch-all, not a
  // brand, so nothing is ever prepended for it.
  if (chainName && overrides[chainName] !== "") {
    const token = overrides[chainName] ?? chainTokenOf(chainName);
    const first = firstWordOf(token);
    if (!segs.includes(first)) {
      segs = [...token.split("-"), ...segs];
      notes.prepended = true;
    }
  }

  const citySegs = slugify(row.city).split("-").filter(Boolean);
  if (!containsSeq(segs, citySegs)) segs = [...segs, ...citySegs];

  if (segs[0] === "indie") {
    segs.shift();
    notes.strippedIndie = true;
  }
  const stateCode = row.state.toLowerCase();
  if (segs.length > 2 && segs[0] === stateCode && STATE_CODES.has(stateCode)) {
    segs.shift();
    notes.strippedState = true;
  }
  collapseRepeats(segs, notes.collapsed);

  return { slug: segs.join("-"), notes, chainName };
}

// ---- compute candidates
const cand = new Map(); // id -> {slug, notes, chainName}
for (const row of all) cand.set(row.id, candidateFor(row));

// ---- collisions
const finalSlug = new Map();
const taken = new Set();
const collisions = [];

// 6. unchanged rows claim their slug first
for (const row of all) {
  if (cand.get(row.id).slug === row.slug) {
    finalSlug.set(row.id, row.slug);
    taken.add(row.slug);
  }
}
const pending = all
  .filter((r) => !finalSlug.has(r.id))
  .sort(
    (a, b) =>
      Number(b.is_published) - Number(a.is_published) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  );

for (const row of pending) {
  const base = cand.get(row.id).slug;
  let slug = base;
  if (taken.has(slug)) {
    const steps = [];
    const stateTry = `${base}-${row.state.toLowerCase()}`;
    const placeTry = row.place_id ? `${base}-${row.place_id.slice(-6).toLowerCase()}` : null;
    let resolution;
    if (!taken.has(stateTry)) {
      slug = stateTry;
      resolution = "state suffix";
    } else if (placeTry && !taken.has(placeTry)) {
      slug = placeTry;
      resolution = "place_id suffix";
    } else {
      let n = 2;
      while (taken.has(`${base}-${n}`)) n += 1;
      slug = `${base}-${n}`;
      resolution = "numeric suffix";
    }
    const holder = all.find((r) => finalSlug.get(r.id) === base);
    collisions.push({
      location_id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      is_published: row.is_published,
      base,
      new_slug: slug,
      resolution,
      first_holder: holder ? { location_id: holder.id, name: holder.name, city: holder.city, state: holder.state, is_published: holder.is_published } : null,
      same_address: holder ? holder.address === row.address : null,
      same_place_id: holder ? Boolean(holder.place_id) && holder.place_id === row.place_id : null,
    });
    void steps;
  }
  finalSlug.set(row.id, slug);
  taken.add(slug);
}

// ---- mapping
const mapping = all.map((r) => ({
  old_slug: r.slug,
  new_slug: finalSlug.get(r.id),
  location_id: r.id,
  name: r.name,
  chain: r.chain_id ? chainById.get(r.chain_id) : null,
  is_published: r.is_published,
  changed: r.slug !== finalSlug.get(r.id),
}));
const rowById = new Map(all.map((r) => [r.id, r]));

// ---- integrity
const bySlug = new Map();
const dupSlugs = [];
for (const m of mapping) {
  if (bySlug.has(m.new_slug)) dupSlugs.push(m.new_slug);
  bySlug.set(m.new_slug, m.location_id);
}
const invalid = mapping.filter((m) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.new_slug));

// ---- stats
const changed = mapping.filter((m) => m.changed);
const lens = mapping.map((m) => m.new_slug.length);
const longest = mapping.reduce((a, m) => (m.new_slug.length > a.new_slug.length ? m : a), mapping[0]);
const over = mapping.filter((m) => m.new_slug.length > MAX_LEN);

// truncation preview (not applied). Proposed rule, in order:
//  a. if a chain token was prepended, shorten it to its first word;
//  b. still > 70: drop trailing venue segments one at a time at a segment
//     boundary, always keeping the city segments at the end.
function truncate(m) {
  const row = rowById.get(m.location_id);
  const city = slugify(row.city).split("-").filter(Boolean);
  let segs = m.new_slug.split("-");
  const n = cand.get(m.location_id);
  if (n.notes.prepended && n.chainName) {
    const token = chainTokenOf(n.chainName).split("-");
    if (token.length > 1 && token.every((w, i) => segs[i] === w)) segs = [token[0], ...segs.slice(token.length)];
  }
  if (segs.join("-").length <= MAX_LEN) return segs.join("-");
  const endsWithCity = segs.length > city.length && city.every((w, i) => segs[segs.length - city.length + i] === w);
  const head = endsWithCity ? segs.slice(0, segs.length - city.length) : [...segs];
  const tail = endsWithCity ? city : [];
  while (head.length > 1 && [...head, ...tail].join("-").length > MAX_LEN) head.pop();
  return [...head, ...tail].join("-");
}
const truncPreview = over.map((m) => ({ old_slug: m.old_slug, v2: m.new_slug, truncated: truncate(m), len_v2: m.new_slug.length }));
const truncTaken = new Set(mapping.filter((m) => m.new_slug.length <= MAX_LEN).map((m) => m.new_slug));
let truncCollisions = 0;
for (const t of truncPreview) {
  if (truncTaken.has(t.truncated)) truncCollisions += 1;
  truncTaken.add(t.truncated);
}

// ---- odd cases
const STOP = new Set(["the", "of", "at", "by", "de", "la", "and", "in", "on", "a", "an", "to", "for", "with", "el", "los", "del"]);
const ODD_WORDS = new Set(["formerly", "now", "closed", "temporarily", "permanently", "reopening", "soon", "coming", "opening", "www", "com", "net", "org", "inc", "llc", "ltd", "co", "indie"]);
const dupSegments = [];
const oddTokens = [];
const stateLeft = [];
for (const m of mapping) {
  const segs = m.new_slug.split("-");
  const seen = new Map();
  for (const s of segs) seen.set(s, (seen.get(s) ?? 0) + 1);
  const repeated = [...seen].filter(([s, n]) => n > 1 && !STOP.has(s) && !/^\d+$/.test(s)).map(([s]) => s);
  if (repeated.length) dupSegments.push({ new_slug: m.new_slug, repeated });
  // single letters (not digits), leftover words from parentheticals/legal
  // suffixes, and long numbers that read like a year or address
  const odd = segs.filter((s) => /^[a-z]$/.test(s) || ODD_WORDS.has(s) || /^\d{4,}$/.test(s));
  if (odd.length) oddTokens.push({ new_slug: m.new_slug, odd, name: m.name });
}
const stripped = {
  indie: all.filter((r) => cand.get(r.id).notes.strippedIndie).length,
  state_prefix: all.filter((r) => cand.get(r.id).notes.strippedState).map((r) => ({ old: r.slug, name: r.name })),
  repeats_collapsed: all
    .filter((r) => cand.get(r.id).notes.collapsed.length)
    .map((r) => ({ name: r.name, collapsed: cand.get(r.id).notes.collapsed, new_slug: finalSlug.get(r.id) })),
};
const nonAscii = all.filter((r) => /[^\x00-\x7F]/.test(r.name.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’‘´]/g, "")));

// ---- chain review: where does "prepend the chain token" look wrong?
// Hand-reviewed from the per-chain output (heuristics proposed junk tokens
// such as "studio" for Cinemark). "" means never prepend for that chain.
// These are PROPOSALS: the primary mapping above is computed without them.
const PROPOSED_OVERRIDES = {
  "Goodrich Quality Theaters (GQT)": { token: "gqt", why: "names already lead with the acronym GQT; full chain token makes goodrich-quality-theaters-gqt-..." },
  "Schulman Theatres": { token: "schulmans", why: "names say Schulman's; apostrophe is dropped so first-word match 'schulman' fails and the token is prepended on top of the brand" },
  "Showcase Cinema de Lux": { token: "showcase", why: "full token duplicates 'cinema-de-lux' already in the name (…-cinema-de-lux-blackstone-valley-14-cinema-de-lux-…)" },
  "Reading International": { token: "reading", why: "Angelika/Cal Oaks rows get 'reading-international-' while 'Reading Cinemas …' rows only 'reading-'; one short token makes them consistent and fixes the 73-char slug" },
  "Metropolitan": { token: "metrolux", why: "chain row is 'Metropolitan' but the branding is MetroLux" },
  "Lee Neighborhood Theatres": { token: "lee", why: "three-word operator token ahead of an unrelated venue name" },
  "Independent Cinemas": { token: "", why: "catch-all label, not a brand (independent-cinemas-new-paltz-cinemas)" },
  "Far Away Entertainment": { token: "", why: "operator name, venue is Admiral Theater" },
  "Rochester Theater Management": { token: "", why: "operator name, venue is Auburn Movieplex 10" },
};
const byChain = new Map();
for (const r of all) {
  if (!r.chain_id) continue;
  const n = chainById.get(r.chain_id);
  if (!byChain.has(n)) byChain.set(n, []);
  byChain.get(n).push(r);
}
const proposedOverrides = Object.fromEntries(Object.entries(PROPOSED_OVERRIDES).map(([k, v]) => [k, v.token]));
let overrideChanged = 0;
const overrideSamples = [];
const chainReview = [];
for (const [name, spec] of Object.entries(PROPOSED_OVERRIDES)) {
  const rows = byChain.get(name) ?? [];
  const changedRows = rows.filter((r) => candidateFor(r, proposedOverrides).slug !== cand.get(r.id).slug);
  overrideChanged += changedRows.length;
  const ex = changedRows[0] ?? rows[0];
  if (ex) {
    chainReview.push({
      chain: name,
      rows: rows.length,
      rows_changed_by_override: changedRows.length,
      current_chain_token: chainTokenOf(name),
      proposed_token: spec.token === "" ? "(none: never prepend)" : spec.token,
      why: spec.why,
      example: { name: ex.name, v2: cand.get(ex.id).slug, with_override: candidateFor(ex, proposedOverrides).slug },
    });
  }
}
for (const c of chainReview) overrideSamples.push(c.example);
// chains that merely look odd but come out fine
const reviewedOk = ["Cinemark (prefix 'cinemark-' matches the existing seeded convention for Studio Eats / Movie Bistro)", "Classic Cinemas, Picture Show, Cinema Cafe, Premiere Cinemas, America Cinemas, The Picture House Regional Film Center (generic first word, but every name already carries the brand)", "Georgia Theatre Company (3-word token, accurate; optional short token)", "BTM Cinemas (btm-cinemas-… is long but unambiguous; optional 'btm')"];

// ---- hazards and redirect map
const currentSlugOwner = new Map(all.map((r) => [r.slug, r.id]));
const newEqualsOthersOld = mapping.filter((m) => m.changed && currentSlugOwner.has(m.new_slug) && currentSlugOwner.get(m.new_slug) !== m.location_id);
const liveNew = new Set(mapping.map((m) => m.new_slug));
const redirectRows = mapping.filter((m) => m.changed && m.is_published);
const shadowing = redirectRows.filter((m) => liveNew.has(m.old_slug));
const targetsNotPublished = redirectRows.filter((m) => !rowById.get(m.location_id).is_published);
const redirectSourcesUnique = new Set(redirectRows.map((m) => m.old_slug)).size === redirectRows.length;
// a redirect hop onto another redirect source?
const chained = redirectRows.filter((m) => redirectRows.some((o) => o.old_slug === m.new_slug));

// ---- samples: 20 spanning the requested families
function pickFor(pred, n, used) {
  const out = [];
  for (const m of mapping) {
    if (out.length >= n) break;
    if (used.has(m.location_id) || !m.changed) continue;
    if (pred(m)) {
      out.push(m);
      used.add(m.location_id);
    }
  }
  return out;
}
const used = new Set();
const has = (m, s) => (m.chain ?? "").toLowerCase().includes(s);
const samples = [
  ...pickFor((m) => has(m, "marcus") && m.is_published, 2, used),
  ...pickFor((m) => m.chain === "AMC" && m.is_published, 2, used),
  ...pickFor((m) => has(m, "cinemark") && m.is_published, 2, used),
  ...pickFor((m) => has(m, "b&b") && m.is_published, 2, used),
  ...pickFor((m) => has(m, "goodrich"), 2, used),
  ...pickFor((m) => has(m, "reading") && m.is_published, 2, used),
  ...pickFor((m) => has(m, "showcase") && m.is_published, 2, used),
  ...pickFor((m) => has(m, "cin") && has(m, "polis") && m.is_published, 2, used),
  ...pickFor((m) => !m.chain && m.is_published, 3, used),
  ...pickFor((m) => !m.is_published, 1, used),
];

// ---- write
const summary = {
  generated_at: new Date().toISOString(),
  snapshot: relative(root, snapshotFile),
  counts: {
    rows: all.length,
    changed: changed.length,
    unchanged: mapping.length - changed.length,
    changed_published: changed.filter((m) => m.is_published).length,
    changed_unpublished: changed.filter((m) => !m.is_published).length,
    with_chain: all.filter((r) => r.chain_id).length,
    without_chain: all.filter((r) => !r.chain_id).length,
  },
  length: {
    longest: { slug: longest.new_slug, length: longest.new_slug.length },
    max: Math.max(...lens),
    over_70: over.length,
    over_70_published: over.filter((m) => m.is_published).length,
    median: lens.sort((a, b) => a - b)[Math.floor(lens.length / 2)],
  },
  integrity: { duplicate_new_slugs: dupSlugs.length, invalid_chars: invalid.length },
  collisions,
  steps: {
    chain_token_prepended: all.filter((r) => cand.get(r.id).notes.prepended).length,
    chain_rows: all.filter((r) => r.chain_id).length,
    stripped_indie_prefix: stripped.indie,
    stripped_state_prefix: stripped.state_prefix,
    adjacent_repeats_collapsed: stripped.repeats_collapsed,
    names_with_non_ascii_remaining: nonAscii.map((r) => r.name),
  },
  chain_review: chainReview,
  chains_reviewed_and_fine: reviewedOk,
  override_preview: { proposed_overrides: proposedOverrides, rows_changed: overrideChanged },
  odd_cases: { duplicated_segments: dupSegments, odd_tokens: oddTokens },
  truncation: { rule: `if length > ${MAX_LEN}: keep leading segments to the limit at a segment boundary, always keep the city segments at the end`, preview: truncPreview, preview_collisions_with_other_slugs: truncCollisions },
  hazards: {
    new_slug_equals_another_rows_current_slug: newEqualsOthersOld.map((m) => ({ new_slug: m.new_slug, location_id: m.location_id, held_by: currentSlugOwner.get(m.new_slug) })),
  },
  redirect: {
    entries: redirectRows.length,
    published_changed: redirectRows.length,
    excluded_unpublished_changed: changed.filter((m) => !m.is_published).length,
    sources_unique: redirectSourcesUnique,
    sources_that_are_live_new_slugs: shadowing.map((m) => ({ old_slug: m.old_slug, location_id: m.location_id })),
    targets_not_published: targetsNotPublished.length,
    redirect_to_redirect_hops: chained.length,
  },
  samples: samples.map((m) => ({ chain: m.chain, is_published: m.is_published, old: m.old_slug, new: m.new_slug })),
};

writeFileSync(join(outDir, "slug-mapping-v2-dryrun.json"), JSON.stringify(mapping, null, 2));
writeFileSync(join(outDir, "slug-dryrun-v2-summary.json"), JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify(
    { counts: summary.counts, length: summary.length, integrity: summary.integrity, collisions: collisions.length, redirect: { ...summary.redirect, sources_that_are_live_new_slugs: shadowing.length }, steps: { prepended: summary.steps.chain_token_prepended, indie: stripped.indie, state_prefix: stripped.state_prefix.length, repeats: stripped.repeats_collapsed.length }, hazards: newEqualsOthersOld.length, chains_flagged: chainReview.length },
    null,
    1
  )
);
