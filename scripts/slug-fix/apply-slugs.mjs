// APPLY the slug v3 mapping. Service role, one UPDATE per row by location_id,
// changing ONLY the slug column, in batches; stops at the first error.
//
// Pre-flight (all must hold or nothing is written):
//  - live table is identical, column for column, to the pre-write snapshot
//  - mapping is internally consistent with the snapshot (ids, old slugs) and
//    new slugs are unique
// Each UPDATE is also guarded by `slug = old_slug`, so a row that changed
// underneath cannot be overwritten.
//
// Usage: node apply-slugs.mjs [--dry]
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
const dry = process.argv.includes("--dry");
const BATCH = 50;

const env = {};
for (const line of readFileSync(join(here, "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const snapshot = JSON.parse(readFileSync(join(out, "locations-snapshot-pre-slug-v3.json"), "utf8")).locations;
const mapping = JSON.parse(readFileSync(join(out, "slug-mapping-v3-final.json"), "utf8"));

// ---- pre-flight: mapping vs snapshot
const snapById = new Map(snapshot.map((r) => [r.id, r]));
const problems = [];
if (mapping.length !== snapshot.length) problems.push(`mapping has ${mapping.length} rows, snapshot ${snapshot.length}`);
const newSet = new Set();
for (const m of mapping) {
  const s = snapById.get(m.location_id);
  if (!s) problems.push(`unknown location_id ${m.location_id}`);
  else if (s.slug !== m.old_slug) problems.push(`old_slug mismatch for ${m.location_id}`);
  if (newSet.has(m.new_slug)) problems.push(`duplicate new slug ${m.new_slug}`);
  newSet.add(m.new_slug);
  if (m.new_slug.length > 70 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.new_slug)) problems.push(`invalid slug ${m.new_slug}`);
}

// ---- pre-flight: live table == snapshot (every column)
const live = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from("locations").select("*").order("id").range(from, from + 499);
  if (error) throw error;
  live.push(...data);
  if (data.length < 500) break;
}
const stable = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
if (live.length !== snapshot.length) problems.push(`live has ${live.length} rows, snapshot ${snapshot.length}`);
let drift = 0;
for (const r of live) {
  const s = snapById.get(r.id);
  if (!s || stable(s) !== stable(r)) drift += 1;
}
if (drift) problems.push(`${drift} live rows differ from the snapshot`);

if (problems.length) {
  console.error("PRE-FLIGHT FAILED, nothing written:\n  " + problems.slice(0, 20).join("\n  "));
  process.exit(2);
}
const todo = mapping.filter((m) => m.changed);
console.log(`pre-flight ok: live table matches snapshot; ${todo.length} slug updates planned${dry ? " (dry run)" : ""}`);
if (dry) process.exit(0);

// ---- apply
const applied = [];
let batchNo = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  batchNo += 1;
  const batch = todo.slice(i, i + BATCH);
  for (const m of batch) {
    const { data, error } = await sb
      .from("locations")
      .update({ slug: m.new_slug })
      .eq("id", m.location_id)
      .eq("slug", m.old_slug)
      .select("id");
    if (error || !data || data.length !== 1) {
      const msg = error ? error.message : `expected 1 row updated, got ${data ? data.length : 0}`;
      writeFileSync(join(out, "apply-v3-progress.json"), JSON.stringify({ status: "STOPPED", applied: applied.length, failed_at: m, error: msg, applied_ids: applied }, null, 1));
      console.error(`STOPPED in batch ${batchNo} at ${m.location_id} (${m.old_slug} -> ${m.new_slug}): ${msg}\n${applied.length} rows updated before the stop. Progress in output/apply-v3-progress.json`);
      process.exit(1);
    }
    applied.push(m.location_id);
  }
  console.log(`batch ${batchNo}: ${applied.length}/${todo.length} updated`);
}
writeFileSync(join(out, "apply-v3-progress.json"), JSON.stringify({ status: "COMPLETE", applied: applied.length, applied_ids: applied }, null, 1));
console.log(`done: ${applied.length} slugs updated`);
