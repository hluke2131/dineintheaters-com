// Batch 3 sub-batch 2 go-live (service role; WRITES TO THE LIVE DB, needs an explicit mode argument and separate go-live approval;
// reads staged JSON directly in Node, not through model context).
//   node --env-file=.env.local scripts/phase-c-discovery/insert-batch3-sub2-golive.mjs insert         -> inserts staged rows with chain_id null
//   node --env-file=.env.local scripts/phase-c-discovery/insert-batch3-sub2-golive.mjs link           -> explicit chain linking per the proposal
//   LIVE_SNAPSHOT=<rows with place_id,slug> node scripts/phase-c-discovery/insert-batch3-sub2-golive.mjs insert --dry
//        -> runs every pre-write check (guards, proposal coverage, place_id/slug collisions against the snapshot) and exits without
//           touching the DB (no DB client is created in --dry mode)
//
// Pre-write checks (all modes, including --dry): photos guard, chain-note guard, no duplicate place_id/slug in the staged file,
// and every staged row has an independent or link_existing row in the proposal (a missing row or any other action, e.g.
// create_new_chain, stops the script with a list). After a real write the rows are re-read and checked per field
// (slug, photos null, is_published, chain_id); any mismatch prints a per-field diff and exits non-zero.
// STAGED_JSON / PROPOSAL_JSON env vars override the input paths (used for offline tests).
import { readFileSync } from "node:fs";
import { assertChainRowsMapped, assertPhotosNull } from "../lib/slug-v3.mjs";

const OUT = "scripts/phase-c-discovery/output";
const stg = JSON.parse(readFileSync(process.env.STAGED_JSON ?? `${OUT}/batch3-sub2-staged-qualifies.json`, "utf8")).locations;
const prop = JSON.parse(readFileSync(process.env.PROPOSAL_JSON ?? `${OUT}/batch3-sub2-chain-resolution-proposal.json`, "utf8"));
const COLS = ["slug","name","chain_id","sub_brand","address","city","state","zip","lat","lng","place_id","fsq_id","phone","website_url","ticketing_url","hours","delivery_style","alcohol_served","age_restricted_auditoriums","reserved_recliners","menu_price_range","amenities","accessibility_notes","parking_notes","safety_notes","description","status","last_verified_date","photos","is_sponsored","is_published"];

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const mode = args.find((a) => a === "insert" || a === "link");
const unknownArgs = args.filter((a) => a !== "--dry" && a !== "insert" && a !== "link");
if (!mode || unknownArgs.length) {
  console.error("usage: insert-batch3-sub2-golive.mjs <insert|link> [--dry]" + (unknownArgs.length ? "   (unknown argument: " + unknownArgs.join(" ") + ")" : ""));
  process.exit(1);
}
const fail = (msg) => {
  console.error("GO-LIVE ABORTED (nothing written): " + msg);
  process.exit(1);
};

// ---- pre-write checks
if (!stg.length) fail("staged file has no rows");
try {
  assertPhotosNull(stg); // photos is always null
} catch (e) {
  fail(e.message);
}
const decision = new Map(prop.rows.map((r) => [r.place_id, r]));
const undecided = stg.filter((s) => !["independent", "link_existing"].includes(decision.get(s.place_id)?.action));
if (undecided.length) {
  fail("staged rows without an independent/link_existing proposal row:\n" + undecided.map((s) => "  " + s.place_id + "  " + s.name + "  [" + (decision.get(s.place_id)?.action ?? "NO PROPOSAL ROW") + "]").join("\n"));
}
const noChain = stg.filter((s) => decision.get(s.place_id).action === "link_existing" && !(decision.get(s.place_id).chain_id && decision.get(s.place_id).chain_name));
if (noChain.length) fail("link_existing rows missing chain_id or chain_name in the proposal: " + noChain.map((s) => s.name).join("; "));
try {
  assertChainRowsMapped(stg, Object.fromEntries(stg.map((s) => [s.place_id, decision.get(s.place_id).action === "link_existing" ? decision.get(s.place_id).chain_name : null])));
} catch (e) {
  fail(e.message);
}
const dupPid = stg.length - new Set(stg.map((s) => s.place_id)).size;
const dupSlug = stg.length - new Set(stg.map((s) => s.slug)).size;
if (dupPid || dupSlug) fail("staged file has duplicate place_ids (" + dupPid + ") or slugs (" + dupSlug + ")");
const unslugged = stg.filter((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.slug ?? ""));
if (unslugged.length) fail("staged rows with a missing or malformed slug: " + unslugged.map((s) => s.name).join("; "));

const links = prop.rows.filter((r) => r.action === "link_existing" && stg.some((s) => s.place_id === r.place_id));
const expectedChain = (placeId) => (mode === "link" ? links.find((l) => l.place_id === placeId)?.chain_id ?? null : null);

const clashes = (rows, existing) => {
  const pids = new Set(existing.map((r) => r.place_id));
  const slugs = new Set(existing.map((r) => r.slug));
  return rows.filter((r) => pids.has(r.place_id) || slugs.has(r.slug));
};

// ---- dry mode: collision check against a snapshot file, no DB client
if (dry) {
  console.log("--dry: staged " + stg.length + " rows; photos guard, chain-note guard and proposal coverage passed (" + links.length + " link_existing, " + (stg.length - links.length) + " independent).");
  if (mode === "insert") {
    if (!process.env.LIVE_SNAPSHOT) fail("--dry insert needs LIVE_SNAPSHOT=<json array of live rows with place_id and slug> for the collision check");
    const live = JSON.parse(readFileSync(process.env.LIVE_SNAPSHOT, "utf8").replace(/^﻿/, ""));
    if (!Array.isArray(live) || !live.length) fail("LIVE_SNAPSHOT is empty or not an array");
    const bad = clashes(stg, live);
    if (bad.length) fail("collision with the live snapshot (place_id or slug already exists):\n" + bad.map((s) => "  " + s.place_id + "  " + s.slug).join("\n"));
    console.log("--dry: no place_id/slug collisions against the " + live.length + "-row snapshot. Would insert " + stg.length + " rows. Exiting without writing.");
  } else {
    if (process.env.LIVE_SNAPSHOT) {
      const live = JSON.parse(readFileSync(process.env.LIVE_SNAPSHOT, "utf8").replace(/^﻿/, ""));
      const present = new Set(live.map((r) => r.place_id));
      const absent = links.filter((l) => !present.has(l.place_id));
      if (absent.length) fail("link targets not present in the snapshot (insert them first): " + absent.map((l) => l.name).join("; "));
      console.log("--dry: all " + links.length + " link targets exist in the snapshot.");
    }
    console.log("--dry: would link " + links.length + " rows. Exiting without writing.");
  }
  process.exit(0);
}

// ---- real run: needs the DB
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// re-read the live rows and compare per field; print a per-field diff and exit non-zero on any mismatch
async function verify() {
  const live = new Map();
  for (const part of chunks(stg, 40)) {
    const { data, error } = await sb.from("locations").select("place_id,slug,photos,is_published,chain_id").in("place_id", part.map((s) => s.place_id));
    if (error) throw error;
    for (const r of data) live.set(r.place_id, r);
  }
  const diffs = [];
  for (const s of stg) {
    const l = live.get(s.place_id);
    if (!l) { diffs.push(s.place_id + "  " + s.name + "  ROW MISSING"); continue; }
    const want = { slug: s.slug, photos: null, is_published: true, chain_id: expectedChain(s.place_id) };
    for (const [k, v] of Object.entries(want)) if (JSON.stringify(l[k]) !== JSON.stringify(v)) diffs.push(s.place_id + "  " + s.name + "  " + k + ": expected " + JSON.stringify(v) + ", live " + JSON.stringify(l[k]));
  }
  if (diffs.length) {
    console.error("POST-WRITE VERIFICATION FAILED (" + diffs.length + " difference(s)):\n  " + diffs.join("\n  "));
    process.exit(2);
  }
  console.log("verified " + stg.length + " rows against the live table: slug, photos null, is_published true, chain_id as expected.");
}

if (mode === "insert") {
  const rows = stg.map((r) => { const o = Object.fromEntries(COLS.map((c) => [c, r[c] ?? null])); o.chain_id = null; o.photos = null; o.is_published = true; o.is_sponsored = false; return o; });
  const clash = [];
  for (const part of chunks(rows, 40)) {
    const { data, error } = await sb.from("locations").select("place_id,slug").or("place_id.in.(" + part.map((r) => r.place_id).join(",") + "),slug.in.(" + part.map((r) => r.slug).join(",") + ")");
    if (error) throw error;
    clash.push(...data);
  }
  if (clash.length) throw new Error("collision: " + JSON.stringify(clash));
  const { data, error } = await sb.from("locations").insert(rows).select("id,name,state");
  if (error) throw error;
  console.log("inserted " + data.length + " rows");
  await verify();
} else {
  let n = 0;
  for (const l of links) {
    const { data, error } = await sb.from("locations").update({ chain_id: l.chain_id }).eq("place_id", l.place_id).is("chain_id", null).select("id,name");
    if (error) throw error;
    if (data.length !== 1) throw new Error("link did not affect exactly one row: " + l.name + " (" + n + " rows linked before this one)");
    n++;
  }
  console.log("linked " + n + " rows");
  await verify();
}
