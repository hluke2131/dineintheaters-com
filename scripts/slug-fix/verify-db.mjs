// READ-ONLY. Verifies the live table against the pre-write snapshot and the
// v3 mapping after the slug update: only `slug` differs (per column), counts
// unchanged, all slugs unique and equal to the mapping.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
const env = {};
for (const line of readFileSync(join(here, "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function all(table) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from(table).select("*").order("id").range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

const snap = JSON.parse(readFileSync(join(out, "locations-snapshot-pre-slug-v3.json"), "utf8"));
const mapping = JSON.parse(readFileSync(join(out, "slug-mapping-v3-final.json"), "utf8"));
const live = await all("locations");
const chains = await all("chains");

const snapById = new Map(snap.locations.map((r) => [r.id, r]));
const mapById = new Map(mapping.map((m) => [m.location_id, m]));
const fieldDiffCounts = {};
const columns = Object.keys(snap.locations[0]);
let missing = 0;
for (const r of live) {
  const s = snapById.get(r.id);
  if (!s) {
    missing += 1;
    continue;
  }
  for (const c of new Set([...columns, ...Object.keys(r)])) {
    if (JSON.stringify(s[c]) !== JSON.stringify(r[c])) fieldDiffCounts[c] = (fieldDiffCounts[c] ?? 0) + 1;
  }
}
const slugs = live.map((r) => r.slug);
const wrong = live.filter((r) => mapById.get(r.id)?.new_slug !== r.slug);
const result = {
  rows: live.length,
  published: live.filter((r) => r.is_published).length,
  unpublished: live.filter((r) => !r.is_published).length,
  chains: chains.length,
  columns_compared: columns.length,
  rows_not_in_snapshot: missing,
  columns_that_differ_vs_snapshot: fieldDiffCounts,
  expected_slug_changes: mapping.filter((m) => m.changed).length,
  unique_slugs: new Set(slugs).size,
  slugs_not_equal_to_mapping: wrong.length,
  longest_slug: Math.max(...slugs.map((s) => s.length)),
  slugs_starting_indie: slugs.filter((s) => s.startsWith("indie-")).length,
  is_published_diff_vs_snapshot: fieldDiffCounts.is_published ?? 0,
  updated_at_diff_vs_snapshot: fieldDiffCounts.updated_at ?? 0,
};
console.log(JSON.stringify(result, null, 1));
const ok =
  result.rows === 948 &&
  result.published === 457 &&
  result.unpublished === 491 &&
  result.chains === 83 &&
  missing === 0 &&
  Object.keys(fieldDiffCounts).every((c) => c === "slug") &&
  result.unique_slugs === 948 &&
  wrong.length === 0 &&
  fieldDiffCounts.slug === result.expected_slug_changes;
console.log(ok ? "VERIFY OK" : "VERIFY FAILED");
process.exit(ok ? 0 : 4);
