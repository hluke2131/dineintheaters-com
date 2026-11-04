// Slug rewrite v3 (final): rule v2 plus the approved overrides. READ-ONLY:
// computes the mapping and runs the hard gates; it never touches the database.
// v1 and v2 dry-run files are left in place.
//
// Rule (in order):
//  1. base = slugify(name): accents folded, "&" removed without a hyphen,
//     apostrophes dropped, ASCII, lowercase, hyphen-separated; the standalone
//     tokens "formerly" and "llc" are dropped.
//  2. chain token: for rows with a chain, token = override, else
//     slugify(chain.name without parentheticals). If the base already contains
//     the token's first word as a whole segment nothing is added, otherwise
//     the token is prepended. Chains with override "" never get a token.
//  3. city: appended unless its segment sequence is already present.
//  4. strip a leading "indie-" / own-state code; collapse adjacent repeats
//     ONLY where the chain token or the city was joined to the name, never
//     inside the venue name itself.
//  5. > 70 chars: shorten a prepended chain token to its first word; if still
//     > 70, drop trailing venue segments at a segment boundary, always
//     keeping the city.
//  6. collisions (vs other proposed slugs and slugs that stay unchanged):
//     append the lowercase state, then place_id last 6, then -2/-3 (the base
//     is re-truncated first if a suffix would push it over 70).
//  7. a row whose current slug already equals its output keeps it.
//
// Usage: node dryrun-v3.mjs [snapshot.json] [--write-redirects]
// Exit codes: 0 all gates passed, 3 one or more gates failed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { assignSlugs, CHAIN_OVERRIDES, MAX_LEN, seqAt, slugify } from "../lib/slug-v3.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const outDir = join(here, "output");
const args = process.argv.slice(2);
const writeRedirects = args.includes("--write-redirects");
const snapshotFile = args.find((a) => !a.startsWith("--")) ?? join(outDir, "locations-snapshot-pre-slug-v3.json");
const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));
const all = snapshot.locations;
const chainById = new Map(snapshot.chains.map((c) => [c.id, c.name]));
const chainNames = new Set(snapshot.chains.map((c) => c.name));

// The rule itself lives in scripts/lib/slug-v3.mjs (shared with the staging scripts).
const comp = new Map();
const results = assignSlugs(all, {
  chainNameOf: (r) => (r.chain_id ? chainById.get(r.chain_id) : null),
  keepCurrent: true,
  compare: (a, b) =>
    Number(b.is_published) - Number(a.is_published) ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id),
});
const finalSlug = new Map();
const collisions = [];
// iterate in resolution order so the collision list reads as before
all.forEach((r, i) => {
  comp.set(r.id, results[i].comp);
  finalSlug.set(r.id, results[i].slug);
});
all
  .map((r, i) => i)
  .filter((i) => results[i].resolution)
  .sort((a, b) => {
    const A = all[a], B = all[b];
    return Number(B.is_published) - Number(A.is_published) || A.created_at.localeCompare(B.created_at) || A.id.localeCompare(B.id);
  })
  .forEach((i) => {
    const row = all[i];
    const res = results[i];
    const holder = res.holder === null ? null : all[res.holder];
    collisions.push({
      location_id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      is_published: row.is_published,
      base: res.base,
      new_slug: res.slug,
      resolution: res.resolution,
      first_holder: holder ? { location_id: holder.id, name: holder.name, address: holder.address } : null,
    });
  });

const rowById = new Map(all.map((r) => [r.id, r]));
const mapping = all.map((r) => ({
  old_slug: r.slug,
  new_slug: finalSlug.get(r.id),
  location_id: r.id,
  name: r.name,
  chain: r.chain_id ? chainById.get(r.chain_id) : null,
  is_published: r.is_published,
  changed: r.slug !== finalSlug.get(r.id),
}));

// ---- hard gates
const gates = [];
const gate = (name, offenders) => gates.push({ gate: name, pass: offenders.length === 0, offenders: offenders.slice(0, 25), offender_count: offenders.length });

const seen = new Map();
const duplicates = [];
for (const m of mapping) {
  if (seen.has(m.new_slug)) duplicates.push({ slug: m.new_slug, ids: [seen.get(m.new_slug), m.location_id] });
  else seen.set(m.new_slug, m.location_id);
}
gate("0 duplicate slugs across all rows", duplicates);
gate(`0 slugs over ${MAX_LEN} chars`, mapping.filter((m) => m.new_slug.length > MAX_LEN).map((m) => ({ slug: m.new_slug, length: m.new_slug.length, location_id: m.location_id })));
gate('0 slugs starting with "indie-"', mapping.filter((m) => m.new_slug.startsWith("indie-")).map((m) => m.new_slug));
gate("0 slugs outside [a-z0-9-], or with leading/trailing/doubled hyphens", mapping.filter((m) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.new_slug)).map((m) => m.new_slug));

// join-created adjacent repeats: any adjacent repeated n-gram in the final
// slug that is not already an adjacent repeat inside the venue name itself
function adjacentRepeats(segs) {
  const out = new Set();
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i + 2 * n <= segs.length; i++) {
      if (seqAt(segs, segs.slice(i + n, i + 2 * n), i)) out.add(segs.slice(i, i + n).join("-"));
    }
  }
  return out;
}
const joinRepeats = [];
for (const m of mapping) {
  const nameRep = adjacentRepeats(slugify(rowById.get(m.location_id).name).split("-").filter(Boolean));
  const finalRep = adjacentRepeats(m.new_slug.split("-"));
  const created = [...finalRep].filter((x) => !nameRep.has(x));
  if (created.length) joinRepeats.push({ slug: m.new_slug, repeats: created });
}
gate("0 join-created adjacent repeats", joinRepeats);

const redirectRows = mapping.filter((m) => m.changed && m.is_published);
const newSlugs = new Set(mapping.map((m) => m.new_slug));
const redirectSources = new Set(redirectRows.map((m) => m.old_slug));
gate("every redirect source distinct from every new slug", redirectRows.filter((m) => newSlugs.has(m.old_slug)).map((m) => m.old_slug));
gate("0 redirect chains (no target is itself a redirect source)", redirectRows.filter((m) => redirectSources.has(m.new_slug)).map((m) => m.new_slug));
gate("0 redirect targets that are unpublished", redirectRows.filter((m) => !rowById.get(m.location_id).is_published).map((m) => m.new_slug));
gate("redirect sources unique", redirectRows.length === redirectSources.size ? [] : [{ entries: redirectRows.length, unique: redirectSources.size }]);
gate("every override names a real chain", Object.keys(CHAIN_OVERRIDES).filter((k) => !chainNames.has(k)));
const currentOwner = new Map(all.map((r) => [r.slug, r.id]));
gate("no apply-order hazards (a new slug equal to another row's current slug)", mapping.filter((m) => m.changed && currentOwner.has(m.new_slug) && currentOwner.get(m.new_slug) !== m.location_id).map((m) => ({ new_slug: m.new_slug, location_id: m.location_id })));
gate("published unchanged rows have no redirect and changed published rows have exactly one", redirectRows.length === mapping.filter((m) => m.is_published && m.changed).length ? [] : [{ redirectRows: redirectRows.length }]);

// ---- v2 comparison, outcomes, samples
let v2 = null;
try {
  v2 = new Map(JSON.parse(readFileSync(join(outDir, "slug-mapping-v2-dryrun.json"), "utf8")).map((m) => [m.location_id, m.new_slug]));
} catch {
  v2 = null;
}
const diffV2 = v2 ? mapping.filter((m) => v2.get(m.location_id) !== m.new_slug).map((m) => ({ name: m.name, chain: m.chain, v2: v2.get(m.location_id), v3: m.new_slug })) : [];

const over70Outcome = all
  .filter((r) => comp.get(r.id).notes.truncated)
  .map((r) => ({ name: r.name, is_published: r.is_published, before: comp.get(r.id).notes.untruncated, before_len: comp.get(r.id).notes.untruncated.length, after: finalSlug.get(r.id), after_len: finalSlug.get(r.id).length, chain_shortened: comp.get(r.id).notes.chainShortened, venue_segments_dropped: comp.get(r.id).notes.venueSegmentsDropped ?? 0 }));

const overrideOutcome = Object.keys(CHAIN_OVERRIDES).map((chain) => {
  const rows = all.filter((r) => r.chain_id && chainById.get(r.chain_id) === chain);
  const changedVsV2 = v2 ? rows.filter((r) => v2.get(r.id) !== finalSlug.get(r.id)) : [];
  const ex = changedVsV2[0] ?? rows[0];
  return {
    chain,
    token: CHAIN_OVERRIDES[chain] === "" ? "(never prepend)" : CHAIN_OVERRIDES[chain],
    rows: rows.length,
    rows_changed_vs_v2: changedVsV2.length,
    example: ex ? { name: ex.name, v2: v2?.get(ex.id) ?? null, v3: finalSlug.get(ex.id) } : null,
  };
});

const tokensStripped = all
  .filter((r) => comp.get(r.id).notes.strippedTokens.length)
  .map((r) => ({ name: r.name, stripped: comp.get(r.id).notes.strippedTokens, new_slug: finalSlug.get(r.id) }));
const repeatsCollapsed = all
  .filter((r) => comp.get(r.id).notes.collapsed.length)
  .map((r) => ({ name: r.name, collapsed: comp.get(r.id).notes.collapsed, new_slug: finalSlug.get(r.id) }));
const repeatsKept = all
  .filter((r) => adjacentRepeats(slugify(r.name).split("-").filter(Boolean)).size)
  .map((r) => ({ name: r.name, new_slug: finalSlug.get(r.id) }));

function pick(pred, n, used) {
  const out = [];
  for (const m of mapping) {
    if (out.length >= n) break;
    if (used.has(m.location_id) || !m.changed || !pred(m)) continue;
    out.push(m);
    used.add(m.location_id);
  }
  return out;
}
const used = new Set();
const ch = (m, s) => (m.chain ?? "").toLowerCase().includes(s);
const samples = [
  ...pick((m) => ch(m, "marcus"), 2, used),
  ...pick((m) => m.chain === "AMC", 2, used),
  ...pick((m) => ch(m, "cinemark"), 2, used),
  ...pick((m) => ch(m, "b&b"), 2, used),
  ...pick((m) => ch(m, "goodrich"), 2, used),
  ...pick((m) => ch(m, "reading"), 2, used),
  ...pick((m) => ch(m, "showcase"), 2, used),
  ...pick((m) => ch(m, "cin") && ch(m, "polis"), 2, used),
  ...pick((m) => /kan-kan/i.test(m.name), 1, used),
  ...pick((m) => !m.chain && m.is_published, 3, used),
].map((m) => ({ chain: m.chain, is_published: m.is_published, old: m.old_slug, new: m.new_slug }));

const lens = mapping.map((m) => m.new_slug.length).sort((a, b) => a - b);
const summary = {
  generated_at: new Date().toISOString(),
  snapshot: relative(root, snapshotFile),
  all_gates_passed: gates.every((g) => g.pass),
  gates,
  counts: {
    rows: all.length,
    published: all.filter((r) => r.is_published).length,
    unpublished: all.filter((r) => !r.is_published).length,
    chains: snapshot.chains.length,
    changed: mapping.filter((m) => m.changed).length,
    unchanged: mapping.filter((m) => !m.changed).length,
    changed_published: redirectRows.length,
    changed_unpublished: mapping.filter((m) => m.changed && !m.is_published).length,
  },
  length: { min: lens[0], median: lens[Math.floor(lens.length / 2)], max: lens[lens.length - 1] },
  collisions,
  over_70_outcome: over70Outcome,
  override_outcome: overrideOutcome,
  changes_vs_v2: { count: diffV2.length, rows: diffV2 },
  tokens_stripped: tokensStripped,
  join_repeats_collapsed: repeatsCollapsed,
  name_internal_repeats_kept: repeatsKept,
  redirect: { entries: redirectRows.length },
  samples,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "slug-mapping-v3-final.json"), JSON.stringify(mapping, null, 2));
writeFileSync(join(outDir, "slug-dryrun-v3-summary.json"), JSON.stringify(summary, null, 2));

if (summary.all_gates_passed && writeRedirects) {
  const sorted = Object.fromEntries(redirectRows.map((m) => [m.old_slug, m.new_slug]).sort((a, b) => a[0].localeCompare(b[0])));
  mkdirSync(join(root, "src", "data"), { recursive: true });
  writeFileSync(join(root, "src", "data", "slug-redirects.json"), JSON.stringify(sorted, null, 1) + "\n");
}

console.log(JSON.stringify({ all_gates_passed: summary.all_gates_passed, gates: gates.map((g) => ({ gate: g.gate, pass: g.pass, offenders: g.offender_count })), counts: summary.counts, length: summary.length, collisions: collisions.length, changes_vs_v2: diffV2.length, over_70: over70Outcome.length }, null, 1));
process.exit(summary.all_gates_passed ? 0 : 3);
