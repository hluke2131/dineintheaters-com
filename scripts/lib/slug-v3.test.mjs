// Sanity tests for scripts/lib/slug-v3.mjs. No dependencies, no I/O.
// Usage: node scripts/lib/slug-v3.test.mjs   (exit 1 on any failure)
import assert from "node:assert/strict";
import { assertChainRowsMapped, assignSlugs, baseSlug, findUnmappedChainRows, MAX_LEN, slugFor, slugify } from "./slug-v3.mjs";

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const v = (name, city, state, place_id = "ChIJabcdefghij123456") => ({ name, city, state, place_id });

test("slugify: accents folded, & removed without hyphen, apostrophes dropped", () => {
  assert.equal(slugify("Café Ciné & Bar"), "cafe-cine-bar");
  assert.equal(slugify("Bob's Theater"), "bobs-theater");
  assert.equal(slugify("B&B Theatres"), "bb-theatres");
  assert.equal(slugify("Rock’n’Roll"), "rocknroll");
});

test("independent: no indie-/state prefix, city appended", () => {
  assert.equal(baseSlug(v("Nexus Cinema Dining", "Mobile", "AL")), "nexus-cinema-dining-mobile");
});

test("city skipped when already in the name", () => {
  assert.equal(baseSlug(v("Alamo Drafthouse Katy", "Katy", "TX"), "Alamo Drafthouse"), "alamo-drafthouse-katy");
});

test("chain token prepended unless the name has the chain's first word", () => {
  assert.equal(baseSlug(v("Movie Tavern Brookfield", "Brookfield", "WI"), "Marcus Theatres"), "marcus-theatres-movie-tavern-brookfield");
  assert.equal(baseSlug(v("Marcus Ridge Cinema", "Ridge", "WI"), "Marcus Theatres"), "marcus-ridge-cinema");
});

test("chain overrides and no-prefix operators", () => {
  assert.equal(baseSlug(v("Grand 14", "Dallas", "TX"), "Goodrich Quality Theaters (GQT)"), "gqt-grand-14-dallas");
  assert.equal(baseSlug(v("Grand 14", "Dallas", "TX"), "Independent Cinemas"), "grand-14-dallas");
  assert.equal(baseSlug(v("Grand 14", "Dallas", "TX"), "Far Away Entertainment"), "grand-14-dallas");
});

test("standalone formerly/llc stripped", () => {
  assert.equal(baseSlug(v("Star Cinema LLC (formerly Odeon)", "Reno", "NV")), "star-cinema-odeon-reno");
});

test("join-created adjacent repeat collapsed, name-internal repeat kept", () => {
  assert.equal(baseSlug(v("Cinema Grove", "Grove City", "OH")), "cinema-grove-city");
  assert.equal(baseSlug(v("Bora Bora Cinema", "Dallas", "TX")), "bora-bora-cinema-dallas");
});

test("collision fallback order: state, then place_id last-6, then numeric", () => {
  const row = v("Rialto Cinema", "Austin", "TX", "ChIJxxxxxxxxxxABC123");
  const base = "rialto-cinema-austin";
  assert.equal(slugFor(row, null, new Set()).slug, base);
  assert.equal(slugFor(row, null, new Set([base])).slug, `${base}-tx`);
  assert.equal(slugFor(row, null, new Set([base, `${base}-tx`])).slug, `${base}-abc123`);
  assert.equal(slugFor(row, null, new Set([base, `${base}-tx`, `${base}-abc123`])).slug, `${base}-2`);
  assert.equal(slugFor(row, null, new Set([base, `${base}-tx`, `${base}-abc123`, `${base}-2`])).slug, `${base}-3`);
  assert.equal(slugFor(row, null, new Set([base])).resolution, "state suffix");
});

test("assignSlugs: batch rows collide with each other and with existingSlugs", () => {
  const rows = [v("Rialto Cinema", "Austin", "TX", "ChIJaaaaaaaaaaaaaa1111"), v("Rialto Cinema", "Austin", "TX", "ChIJbbbbbbbbbbbbbb2222")];
  const out = assignSlugs(rows, { existingSlugs: ["other-slug"] });
  assert.deepEqual(out.map((o) => o.slug), ["rialto-cinema-austin", "rialto-cinema-austin-tx"]);
  const out2 = assignSlugs(rows, { existingSlugs: ["rialto-cinema-austin"] });
  assert.deepEqual(out2.map((o) => o.slug), ["rialto-cinema-austin-tx", "rialto-cinema-austin-bb2222"]);
});

test(`${MAX_LEN}-char cap: chain token shortened or venue words dropped, city kept, suffix re-truncated`, () => {
  const long = v("The Extremely Long Named Premium Luxury Recliner Dine In Cinema Grill and Brewhouse Experience", "Springfield", "MO");
  const s = baseSlug(long, "Some Very Long Chain Operator Name");
  assert.ok(s.length <= MAX_LEN, `${s.length}: ${s}`);
  assert.ok(s.endsWith("springfield"), s);
  const withSuffix = slugFor(long, "Some Very Long Chain Operator Name", new Set([s])).slug;
  assert.ok(withSuffix.length <= MAX_LEN, `${withSuffix.length}: ${withSuffix}`);
  assert.ok(withSuffix.endsWith("-mo"), withSuffix);
});

test("chain guard: flagged rows need a map entry (null = reviewed independent); unflagged rows never do", () => {
  const rows = [
    { place_id: "p1", name: "A", chain_note: null },
    { place_id: "p2", name: "B", chain_note: "Independent local operator." },
    { place_id: "p3", name: "C", recognized_chain_note: "McMenamins theater-pub" },
    { place_id: "p4", name: "D", possible_chain_flag: true, recognized_chain_note: null },
    { place_id: "p5", name: "E", chain_note: "   " },
  ];
  assert.deepEqual(findUnmappedChainRows(rows, {}).map((r) => r.place_id), ["p2", "p3", "p4"]);
  assert.deepEqual(findUnmappedChainRows(rows, { p2: null, p3: "McMenamins" }).map((r) => r.place_id), ["p4"]);
  assert.throws(() => assertChainRowsMapped(rows, { p3: "McMenamins" }), /p2.*B[\s\S]*p4.*D/);
  assert.doesNotThrow(() => assertChainRowsMapped(rows, { p2: null, p3: "McMenamins", p4: null }));
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL ${name}\n     ${e.message.split("\n").join("\n     ")}`);
  }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
