// ROLLBACK for the slug v3 rewrite. NOT RUN by the go-live session.
// Restores every location's slug to the value in the pre-write snapshot,
// matching by location_id, and changes ONLY the slug column. Rows whose live
// slug already equals the snapshot are skipped, so it is safe to re-run.
//
// Usage (from the repo root):
//   node scripts/slug-fix/output/rollback-slugs.mjs --dry     # list only
//   node scripts/slug-fix/output/rollback-slugs.mjs --apply   # perform updates
// Optional: --snapshot <path>  (default: locations-snapshot-pre-slug-v3.json
// next to this file). Stops at the first error.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
if (!apply && !args.includes("--dry")) {
  console.error("pass --dry (list) or --apply (perform)");
  process.exit(1);
}
const snapIdx = args.indexOf("--snapshot");
const snapshotPath = snapIdx >= 0 ? resolve(args[snapIdx + 1]) : join(here, "locations-snapshot-pre-slug-v3.json");

const env = {};
for (const line of readFileSync(join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Before-image: the full snapshot when present (it is not committed). The
// committed mapping carries the same old_slug per location_id, so rollback
// still works from a clean checkout.
let snapshot;
if (existsSync(snapshotPath)) {
  snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")).locations;
} else {
  const mappingPath = join(here, "slug-mapping-v3-final.json");
  console.log(`snapshot not found; using old_slug values from ${mappingPath}`);
  snapshot = JSON.parse(readFileSync(mappingPath, "utf8")).map((m) => ({ id: m.location_id, slug: m.old_slug }));
}
const want = new Map(snapshot.map((r) => [r.id, r.slug]));

const live = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from("locations").select("id, slug").order("id").range(from, from + 499);
  if (error) throw error;
  live.push(...data);
  if (data.length < 500) break;
}
if (live.length !== snapshot.length) {
  console.error(`row count differs: live ${live.length}, snapshot ${snapshot.length}. Aborting.`);
  process.exit(2);
}
const todo = live.filter((r) => want.has(r.id) && want.get(r.id) !== r.slug);
const missing = live.filter((r) => !want.has(r.id));
if (missing.length) {
  console.error(`${missing.length} live rows are not in the snapshot. Aborting.`);
  process.exit(2);
}
console.log(`${todo.length} rows differ from the snapshot${apply ? "" : " (dry run, nothing written)"}`);
if (!apply) {
  for (const r of todo.slice(0, 10)) console.log(`  ${r.id}: ${r.slug} -> ${want.get(r.id)}`);
  process.exit(0);
}

let done = 0;
for (const r of todo) {
  const { data, error } = await sb.from("locations").update({ slug: want.get(r.id) }).eq("id", r.id).eq("slug", r.slug).select("id");
  if (error || !data || data.length !== 1) {
    console.error(`STOP at ${r.id} (${r.slug}): ${error ? error.message : "no row updated"}. ${done} restored so far.`);
    writeFileSync(join(here, "rollback-progress.json"), JSON.stringify({ restored: done, stopped_at: r.id }));
    process.exit(1);
  }
  done += 1;
}
console.log(`restored ${done} slugs`);
