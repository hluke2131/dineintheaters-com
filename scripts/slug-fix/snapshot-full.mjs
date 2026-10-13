// READ-ONLY. Full-column snapshot of locations (every column, all 948 rows,
// published and unpublished) plus chains, via the service role. Used as the
// before-image for the slug rewrite: per-field diff after the update and the
// source for rollback-slugs.mjs. Makes no writes.
// Usage: node snapshot-full.mjs <out-filename-in-output-dir>
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "output");
mkdirSync(outDir, { recursive: true });
const name = process.argv[2];
if (!name) {
  console.error("usage: snapshot-full.mjs <out-filename>");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(join(here, "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function all(table) {
  const { count, error: ce } = await sb.from(table).select("*", { count: "exact", head: true });
  if (ce) throw new Error(`${table} count: ${ce.message}`);
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from(table).select("*").order("id").range(from, from + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 500) break;
  }
  if (rows.length !== count) throw new Error(`${table}: fetched ${rows.length}, table has ${count}`);
  return rows;
}

const locations = await all("locations");
const chains = await all("chains");
writeFileSync(
  join(outDir, name),
  JSON.stringify({ taken_at: new Date().toISOString(), locations, chains })
);
console.log(
  JSON.stringify({
    file: `scripts/slug-fix/output/${name}`,
    locations: locations.length,
    published: locations.filter((r) => r.is_published).length,
    unpublished: locations.filter((r) => !r.is_published).length,
    chains: chains.length,
    columns: Object.keys(locations[0]).length,
  })
);
