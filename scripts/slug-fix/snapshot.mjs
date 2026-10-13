// READ-ONLY. Snapshots locations, chains and submissions (service role) to
// scripts/slug-fix/output/ so the slug dry run works from a fixed copy.
// Makes no writes of any kind.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "output");
mkdirSync(outDir, { recursive: true });

// Minimal .env.local reader (no dotenv dependency). Values are never logged.
const env = {};
for (const line of readFileSync(join(here, "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchAll(table, columns, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const locations = await fetchAll(
  "locations",
  "id, slug, name, chain_id, sub_brand, address, city, state, zip, place_id, status, is_published, created_at",
  "id"
);
const chains = await fetchAll("chains", "id, name, known_sub_brands", "id");
const submissions = await fetchAll("submissions", "id, location_id, submitted_fields, status", "id");

// Optional first argument names the output file, so a re-snapshot never
// overwrites the one an earlier dry run was computed from.
const stamp = new Date().toISOString().slice(0, 10);
const file = join(outDir, process.argv[2] ?? `locations-snapshot-${stamp}.json`);
writeFileSync(file, JSON.stringify({ taken_at: new Date().toISOString(), locations, chains, submissions }));
console.log(
  JSON.stringify({ file, locations: locations.length, chains: chains.length, submissions: submissions.length })
);
