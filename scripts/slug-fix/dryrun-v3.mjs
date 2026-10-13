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

const CHAIN_OVERRIDES = {
  "Goodrich Quality Theaters (GQT)": "gqt",
  "Schulman Theatres": "schulmans",
  "Showcase Cinema de Lux": "showcase",
  "Reading International": "reading",
  Metropolitan: "metrolux",
  "Lee Neighborhood Theatres": "lee",
  // "" = never prepend a chain token (operator / catch-all names, not brands)
  "Independent Cinemas": "",
  "Far Away Entertainment": "",
  "Rochester Theater Management": "",
};
const STRIP_TOKENS = new Set(["formerly", "llc"]);
const STATE_CODES = new Set(
  "al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy".split(" ")
);
const ARTICLES = new Set(["the", "a", "an"]);
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
const chainTokenOf = (n) => slugify(n.replace(/\([^)]*\)/g, " "));
const firstWordOf = (token) => {
  const w = token.split("-");
  return w.find((x) => !ARTICLES.has(x)) ?? w[0];
};
const seqAt = (segs, seq, i) => seq.every((w, j) => segs[i + j] === w);
function lastIndexOfSeq(segs, seq) {
  for (let i = segs.length - seq.length; i >= 0; i--) if (seqAt(segs, seq, i)) return i;
  return -1;
}

// tagged segments: tag 'c' chain token, 'n' venue name, 'y' appended city
const text = (tagged) => tagged.map((t) => t.s).join("-");

function collapseAtJoins(tagged, log) {
  let again = true;
  while (again) {
    again = false;
    for (let n = 3; n >= 1 && !again; n--) {
      for (let i = 0; i + 2 * n <= tagged.length; i++) {
        const a = tagged.slice(i, i + n);
        const b = tagged.slice(i + n, i + 2 * n);
        if (!a.every((t, j) => t.s === b[j].s)) continue;
        if (a[n - 1].tag === b[0].tag) continue; // inside one part: leave it
        log.push(a.map((t) => t.s).join("-"));
        tagged.splice(i + n, n);
        again = true;
        break;
      }
    }
  }
}

// Shorten to <= limit, keeping the city. Mutates and returns tagged.
function fit(tagged, citySegs, limit, notes) {
  if (text(tagged).length <= limit) return tagged;
  const chainLen = tagged.filter((t) => t.tag === "c").length;
  if (chainLen > 1) {
    tagged.splice(1, chainLen - 1);
    notes.chainShortened = true;
  }
  const segs = () => tagged.map((t) => t.s);
  while (text(tagged).length > limit && tagged.length > 1) {
    const idx = lastIndexOfSeq(segs(), citySegs);
    const cityEnd = idx >= 0 ? idx + citySegs.length : tagged.length;
    if (cityEnd < tagged.length) {
      tagged.pop(); // trailing venue segment after the city
    } else {
      const dropAt = idx >= 0 ? idx - 1 : tagged.length - 2;
      if (dropAt < 1) break; // keep the first segment and the city
      tagged.splice(dropAt, 1);
      // keep the drop at the end of the venue words, not the middle
    }
    notes.venueSegmentsDropped = (notes.venueSegmentsDropped ?? 0) + 1;
  }
  return tagged;
}

function compose(row) {
  const notes = { prepended: false, collapsed: [], strippedTokens: [], chainShortened: false, truncated: false };
  const chainName = row.chain_id ? chainById.get(row.chain_id) : null;
  let nameSegs = slugify(row.name).split("-").filter(Boolean);
  const kept = nameSegs.filter((s) => !STRIP_TOKENS.has(s));
  notes.strippedTokens = nameSegs.filter((s) => STRIP_TOKENS.has(s));
  nameSegs = kept;

  let chainSegs = [];
  const override = chainName ? CHAIN_OVERRIDES[chainName] : undefined;
  if (chainName && override !== "") {
    const token = override ?? chainTokenOf(chainName);
    if (!nameSegs.includes(firstWordOf(token))) {
      chainSegs = token.split("-");
      notes.prepended = true;
    }
  }
  const citySegs = slugify(row.city).split("-").filter(Boolean);
  const body = [...chainSegs, ...nameSegs];
  const cityPresent = lastIndexOfSeq(body, citySegs) >= 0;

  let tagged = [
    ...chainSegs.map((s) => ({ s, tag: "c" })),
    ...nameSegs.map((s) => ({ s, tag: "n" })),
    ...(cityPresent ? [] : citySegs.map((s) => ({ s, tag: "y" }))),
  ];
  if (tagged[0]?.s === "indie") tagged.shift();
  const st = row.state.toLowerCase();
  if (tagged.length > 2 && tagged[0].s === st && STATE_CODES.has(st)) tagged.shift();

  collapseAtJoins(tagged, notes.collapsed);

  const before = text(tagged);
  if (before.length > MAX_LEN) {
    notes.truncated = true;
    notes.untruncated = before;
    fit(tagged, citySegs, MAX_LEN, notes);
  }
  return { tagged, citySegs, notes, chainName };
}

// ---- compute
const comp = new Map();
for (const r of all) comp.set(r.id, compose(r));
const candidate = (id) => text(comp.get(id).tagged);

const finalSlug = new Map();
const taken = new Set();
const collisions = [];
for (const r of all) {
  if (candidate(r.id) === r.slug) {
    finalSlug.set(r.id, r.slug);
    taken.add(r.slug);
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
const withSuffix = (row, suffix) => {
  const c = comp.get(row.id);
  const tagged = c.tagged.map((t) => ({ ...t }));
  const allowed = MAX_LEN - (suffix.length + 1);
  if (text(tagged).length > allowed) fit(tagged, c.citySegs, allowed, {});
  return `${text(tagged)}-${suffix}`;
};
for (const row of pending) {
  const base = candidate(row.id);
  let slug = base;
  if (taken.has(slug)) {
    const tries = [
      ["state suffix", withSuffix(row, row.state.toLowerCase())],
      ...(row.place_id ? [["place_id suffix", withSuffix(row, row.place_id.slice(-6).toLowerCase())]] : []),
    ];
    let resolved = tries.find(([, s]) => !taken.has(s));
    if (!resolved) {
      let n = 2;
      while (taken.has(withSuffix(row, String(n)))) n += 1;
      resolved = ["numeric suffix", withSuffix(row, String(n))];
    }
    slug = resolved[1];
    const holder = all.find((x) => finalSlug.get(x.id) === base);
    collisions.push({
      location_id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      is_published: row.is_published,
      base,
      new_slug: slug,
      resolution: resolved[0],
      first_holder: holder ? { location_id: holder.id, name: holder.name, address: holder.address } : null,
    });
  }
  finalSlug.set(row.id, slug);
  taken.add(slug);
}

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
