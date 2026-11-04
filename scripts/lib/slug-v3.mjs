// Shared v3 location-slug rule. Pure and side-effect free: no I/O, no clock, no
// randomness. Extracted verbatim from scripts/slug-fix/dryrun-v3.mjs so the
// slug-fix dry run and every staging/pipeline script produce the same slugs.
//
// Rule (in order):
//  1. base = slugify(name): accents folded, "&" removed without a hyphen,
//     apostrophes dropped, ASCII, lowercase, hyphen-separated; the standalone
//     tokens "formerly" and "llc" are dropped.
//  2. chain token: for rows with a chain, token = override, else
//     slugify(chain name without parentheticals). If the base already contains
//     the token's first word as a whole segment nothing is added, otherwise
//     the token is prepended (so a Marcus row without "Marcus" in its name
//     gets marcus-theatres-). Chains with override "" never get a token.
//     Rows with no chain (independents) never get a token.
//  3. city: appended unless its segment sequence is already present.
//  4. strip a leading "indie-" / own-state code; collapse adjacent repeats
//     ONLY where the chain token or the city was joined to the name, never
//     inside the venue name itself.
//  5. > 70 chars: shorten a prepended chain token to its first word; if still
//     > 70, drop trailing venue segments at a segment boundary, always
//     keeping the city.
//  6. collisions (against the taken set): append the lowercase state, then
//     place_id last 6, then -2/-3 (the base is re-truncated first if a suffix
//     would push it over 70).
//  7. (assignSlugs, keepCurrent) a row whose current slug already equals its
//     output keeps it.

export const MAX_LEN = 70;

export const CHAIN_OVERRIDES = Object.freeze({
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
});

const STRIP_TOKENS = new Set(["formerly", "llc"]);
const STATE_CODES = new Set(
  "al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy".split(" ")
);
const ARTICLES = new Set(["the", "a", "an"]);

export const slugify = (s) =>
  String(s ?? "")
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
export const seqAt = (segs, seq, i) => seq.every((w, j) => segs[i + j] === w);
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

/**
 * Compose the collision-free-agnostic base slug for one venue.
 * @param {{name: string, city: string, state: string}} row
 * @param {string|null|undefined} chainName resolved chains.name, or null/undefined for an independent
 * @returns {{tagged: {s: string, tag: string}[], citySegs: string[], notes: object, chainName: string|null, base: string}}
 */
export function composeSlug(row, chainName = null) {
  const notes = { prepended: false, collapsed: [], strippedTokens: [], chainShortened: false, truncated: false };
  chainName = chainName || null;
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
  const st = String(row.state ?? "").toLowerCase();
  if (tagged.length > 2 && tagged[0].s === st && STATE_CODES.has(st)) tagged.shift();

  collapseAtJoins(tagged, notes.collapsed);

  const before = text(tagged);
  if (before.length > MAX_LEN) {
    notes.truncated = true;
    notes.untruncated = before;
    fit(tagged, citySegs, MAX_LEN, notes);
  }
  return { tagged, citySegs, notes, chainName, base: text(tagged) };
}

/** The base slug (before collision handling) for one venue. */
export const baseSlug = (row, chainName = null) => composeSlug(row, chainName).base;

// Base re-truncated if `-suffix` would push it over MAX_LEN.
function withSuffix(comp, suffix) {
  const tagged = comp.tagged.map((t) => ({ ...t }));
  const allowed = MAX_LEN - (suffix.length + 1);
  if (text(tagged).length > allowed) fit(tagged, comp.citySegs, allowed, {});
  return `${text(tagged)}-${suffix}`;
}

/**
 * Resolve a base slug against a set of already-taken slugs. Does NOT mutate
 * `taken`; the caller adds the returned slug.
 * Order: base, state suffix, place_id last-6 suffix, then -2/-3/...
 * @param {{state: string, place_id?: string|null}} row
 * @param {ReturnType<typeof composeSlug>} comp
 * @param {{has(s: string): boolean}} taken
 * @returns {{slug: string, resolution: null|"state suffix"|"place_id suffix"|"numeric suffix"}}
 */
export function resolveCollision(row, comp, taken) {
  if (!taken.has(comp.base)) return { slug: comp.base, resolution: null };
  const tries = [
    ["state suffix", withSuffix(comp, String(row.state ?? "").toLowerCase())],
    ...(row.place_id ? [["place_id suffix", withSuffix(comp, row.place_id.slice(-6).toLowerCase())]] : []),
  ];
  let resolved = tries.find(([, s]) => !taken.has(s));
  if (!resolved) {
    let n = 2;
    while (taken.has(withSuffix(comp, String(n)))) n += 1;
    resolved = ["numeric suffix", withSuffix(comp, String(n))];
  }
  return { slug: resolved[1], resolution: resolved[0] };
}

/**
 * Final slug for a single venue against a set of existing slugs.
 * @returns {{slug: string, base: string, resolution: string|null}}
 */
export function slugFor(row, chainName, existingSlugs = new Set()) {
  const comp = composeSlug(row, chainName);
  const { slug, resolution } = resolveCollision(row, comp, existingSlugs);
  return { slug, base: comp.base, resolution };
}

/**
 * Assign final slugs to a batch, in order. Pure: `existingSlugs` is copied.
 * Each row's slug is added to the taken set before the next row is resolved,
 * so rows in the batch collide with each other as well as with existingSlugs.
 *
 * keepCurrent: a row whose `slug` already equals its base keeps it, and those
 * slugs are reserved first (slug-fix semantics). Remaining rows are resolved
 * in `compare` order (default: input order).
 *
 * @param {object[]} rows  needs name, city, state; optional place_id, slug
 * @param {{chainNameOf?: (row: object) => (string|null|undefined),
 *          existingSlugs?: Iterable<string>, keepCurrent?: boolean,
 *          compare?: (a: object, b: object) => number}} [opts]
 * @returns {{slug: string, base: string, resolution: string|null, holder: number|null, comp: object}[]}
 *   aligned with `rows`; holder = index of the row that held `base` when a collision
 *   was resolved (null when the base was held by an existingSlugs entry)
 */
export function assignSlugs(rows, { chainNameOf = () => null, existingSlugs = [], keepCurrent = false, compare = null } = {}) {
  const taken = new Set(existingSlugs);
  const comps = rows.map((r) => composeSlug(r, chainNameOf(r)));
  const out = new Array(rows.length);
  const heldBy = new Map(); // slug -> index of the row that holds it
  if (keepCurrent) {
    rows.forEach((r, i) => {
      if (comps[i].base === r.slug) {
        out[i] = { slug: r.slug, base: comps[i].base, resolution: null, holder: null, comp: comps[i] };
        taken.add(r.slug);
        heldBy.set(r.slug, i);
      }
    });
  }
  let pending = rows.map((_, i) => i).filter((i) => !out[i]);
  if (compare) pending = pending.sort((a, b) => compare(rows[a], rows[b]));
  for (const i of pending) {
    const { slug, resolution } = resolveCollision(rows[i], comps[i], taken);
    const holder = resolution ? (heldBy.has(comps[i].base) ? heldBy.get(comps[i].base) : null) : null;
    out[i] = { slug, base: comps[i].base, resolution, holder, comp: comps[i] };
    taken.add(slug);
    heldBy.set(slug, i);
  }
  return out;
}
