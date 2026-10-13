// DRY RUN ONLY. Reads the locations snapshot and proposes new slugs for rows
// that carry an "indie-" slug but have a chain_id (chains resolved after
// seeding). Writes the mapping and a summary to scripts/slug-fix/output/.
// Makes no database writes and changes no application code.
//
// Rule (matches the chain-seeded convention `{chainSlug}-{city}-{label}` from
// scripts/phase-b-pilot/build-staged-output.mjs):
//   slug = chainToken - citySlug - venue
//   chainToken = slugify(chain.name, parentheticals removed, accents folded,
//                apostrophes dropped)
//   venue      = slugify(name) with a leading `${chainToken}-` removed, so the
//                brand appears once, in the chain slot (as Alamo/IPIC/Flix do)
//   Nothing is de-duplicated against the city: "...-plano-plano" is kept, as
//   in studio-movie-grill-plano-plano.
// Collisions: first row keeps the clean slug; later rows take the repo's
// existing fallback, a `-{place_id last 6, lowercase}` suffix; if that also
// collides (or there is no place_id) a numeric `-2`, `-3` suffix.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const outDir = join(here, "output");
const snapshotFile = process.argv[2] ?? join(outDir, "locations-snapshot-2026-10-13.json");
const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));

const chainById = new Map(snapshot.chains.map((c) => [c.id, c.name]));
const all = snapshot.locations;

const slugify = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const chainTokenOf = (chainName) => slugify(chainName.replace(/\([^)]*\)/g, " "));

// ---- 1. population counts
const indie = all.filter((r) => r.slug.startsWith("indie-"));
const inScope = indie.filter((r) => r.chain_id);
const trueIndependents = indie.filter((r) => !r.chain_id);
const nonIndie = all.filter((r) => !r.slug.startsWith("indie-"));
const pub = (rows) => rows.filter((r) => r.is_published).length;

// ---- 2. proposals, deterministic order: published first, then created_at, id
const ordered = [...inScope].sort(
  (a, b) =>
    Number(b.is_published) - Number(a.is_published) ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
);

const inScopeIds = new Set(inScope.map((r) => r.id));
// Slugs that must not be produced: every slug of a row that is NOT being
// renamed, plus every OLD slug (an old slug reused as someone's new slug would
// make the redirect source shadow a live page).
const reserved = new Set(nonIndie.map((r) => r.slug).concat(trueIndependents.map((r) => r.slug)));
const oldSlugs = new Set(inScope.map((r) => r.slug));
const taken = new Set();
const collisions = [];

const mapping = [];
for (const row of ordered) {
  const chainName = chainById.get(row.chain_id);
  const chainToken = chainTokenOf(chainName);
  const citySlug = slugify(row.city);
  let venue = slugify(row.name);
  let brandStripped = false;
  if (venue === chainToken) {
    venue = "";
    brandStripped = true;
  } else if (venue.startsWith(`${chainToken}-`)) {
    venue = venue.slice(chainToken.length + 1);
    brandStripped = true;
  }
  const repeatsCity = venue === citySlug || venue.startsWith(`${citySlug}-`);

  const base = [chainToken, citySlug, venue].filter(Boolean).join("-");
  let slug = base;
  const clash = (s) => reserved.has(s) || oldSlugs.has(s) || taken.has(s);
  let resolution = null;
  if (clash(slug)) {
    const collidedWith = reserved.has(slug)
      ? "existing non-renamed slug"
      : oldSlugs.has(slug)
        ? "another row's current slug"
        : "another proposed slug";
    const suffix = row.place_id ? row.place_id.slice(-6).toLowerCase() : null;
    if (suffix && !clash(`${base}-${suffix}`)) {
      slug = `${base}-${suffix}`;
      resolution = "place_id suffix";
    } else {
      let n = 2;
      while (clash(`${base}-${n}`)) n += 1;
      slug = `${base}-${n}`;
      resolution = "numeric suffix";
    }
    collisions.push({ location_id: row.id, old_slug: row.slug, base, new_slug: slug, collided_with: collidedWith, resolution });
  }
  taken.add(slug);
  mapping.push({
    old_slug: row.slug,
    new_slug: slug,
    location_id: row.id,
    name: row.name,
    chain: chainName,
    is_published: row.is_published,
    // analysis-only helpers, stripped before the mapping is written
    repeats_city: repeatsCity,
    brand_stripped: brandStripped,
  });
}

// ---- 3. integrity checks against ALL 948 slugs
const finalSlugs = new Map();
for (const r of all) finalSlugs.set(r.id, r.slug);
for (const m of mapping) finalSlugs.set(m.location_id, m.new_slug);
const seen = new Map();
const duplicates = [];
for (const [id, s] of finalSlugs) {
  if (seen.has(s)) duplicates.push({ slug: s, ids: [seen.get(s), id] });
  else seen.set(s, id);
}
const sameAsOld = mapping.filter((m) => m.old_slug === m.new_slug).length;
const badChars = mapping.filter((m) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.new_slug)).length;
const liveAfter = new Set(finalSlugs.values());
// A redirect source must not be a live slug after the rename.
const shadowing = mapping.filter((m) => liveAfter.has(m.old_slug));

// ---- 4. redirect scope: published rows only (an old-slug redirect for an
// unpublished row would answer 308 where the site must answer 404)
const redirectEntries = mapping.filter((m) => m.is_published);

// ---- 5. other references to old slugs in the repo (scripts, src, docs)
const oldList = [...oldSlugs];
const codeHits = new Map(); // src, supabase, and scripts outside any output/ folder
const outputHits = new Map(); // data snapshots under scripts/**/output (not code)
function scan(dir, inOutput) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      scan(p, inOutput || entry === "output");
    } else if (/\.(mjs|js|ts|tsx|json|md|sql|css)$/.test(entry) && st.size < 80_000_000) {
      const rel = relative(root, p);
      if (rel.startsWith(join("scripts", "slug-fix"))) continue; // this dry run's own files
      const text = readFileSync(p, "utf8");
      const hit = oldList.filter((s) => text.includes(s));
      if (hit.length) (inOutput ? outputHits : codeHits).set(rel, hit.length);
    }
  }
}
scan(join(root, "src"), false);
scan(join(root, "supabase"), false);
scan(join(root, "scripts"), false);

// ---- write
const summary = {
  generated_at: new Date().toISOString(),
  snapshot: relative(root, snapshotFile),
  rule: {
    pattern: "{chainToken}-{citySlug}-{venue}",
    chainToken: "slugify(chain.name without parentheticals; accents folded; apostrophes dropped)",
    venue: "slugify(name) with a leading '{chainToken}-' removed",
    collisions: "first row keeps clean slug; later rows get -{place_id last 6}, then -2/-3",
  },
  counts: {
    all_rows: all.length,
    published: pub(all),
    indie_with_chain_in_scope: { all: inScope.length, published: pub(inScope), unpublished: inScope.length - pub(inScope) },
    indie_without_chain_true_independents: { all: trueIndependents.length, published: pub(trueIndependents) },
    non_indie_slug: { all: nonIndie.length, published: pub(nonIndie) },
  },
  collisions,
  checks: {
    duplicate_slugs_after_rename: duplicates.length,
    new_equals_old: sameAsOld,
    invalid_slug_characters: badChars,
    redirect_sources_that_are_live_slugs_after_rename: shadowing.length,
  },
  redirect: {
    entries_if_published_only: redirectEntries.length,
    entries_if_all_rows: mapping.length,
    unpublished_excluded: mapping.length - redirectEntries.length,
  },
  shape: {
    // new slug where the venue segment repeats the city (…-plano-plano)
    venue_repeats_city: mapping.filter((m) => m.repeats_city).length,
    // name did not start with the chain token, so the venue keeps its own brand
    venue_keeps_other_brand: mapping.filter((m) => !m.brand_stripped).length,
    longest_new_slug: mapping.reduce((a, m) => (m.new_slug.length > a.length ? m.new_slug : a), ""),
  },
  references: {
    code_and_script_files_containing_old_slugs: [...codeHits].map(([f, n]) => ({ file: f, distinct_old_slugs: n })),
    data_output_files_containing_old_slugs: [...outputHits].map(([f, n]) => ({ file: f, distinct_old_slugs: n })),
  },
};

const cleanMapping = mapping.map(({ old_slug, new_slug, location_id, name, chain, is_published }) => ({
  old_slug,
  new_slug,
  location_id,
  name,
  chain,
  is_published,
}));
writeFileSync(join(outDir, "slug-mapping-dryrun.json"), JSON.stringify(cleanMapping, null, 2));
writeFileSync(join(outDir, "slug-dryrun-summary.json"), JSON.stringify(summary, null, 2));

console.log(JSON.stringify({ counts: summary.counts, collisions: collisions.length, checks: summary.checks, redirect: summary.redirect }, null, 1));
