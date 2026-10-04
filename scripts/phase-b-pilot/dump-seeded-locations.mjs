// Already-seeded / dedupe source for discovery batches (read-only). Writes place_id, name, address, city, state
// for EVERY row in public.locations, INCLUDING is_published = false rows, so a theater unpublished for failing the
// meal standard can never be re-discovered and re-seeded. Uses the service role (the anon key is limited by RLS to
// published rows and must never be used for this). Fails loudly if the fetched row count differs from the table's
// exact count. apply-exclusions-batchN.mjs reads the JSON this writes (name it live-locations-batchN.json).
// Usage: node --env-file=.env.local scripts/phase-b-pilot/dump-seeded-locations.mjs <out.json>
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const out = process.argv[2];
if (!out || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error("usage: dump-seeded-locations.mjs <out.json> (needs SUPABASE_SERVICE_ROLE_KEY)"); process.exit(1); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { count, error: ce } = await sb.from("locations").select("*", { count: "exact", head: true });
if (ce) throw ce;
const rows = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from("locations").select("place_id, name, address, city, state, is_published").order("id").range(from, from + 499);
  if (error) throw error;
  rows.push(...data);
  if (data.length < 500) break;
}
if (rows.length !== count) { console.error(`ROW COUNT MISMATCH: fetched ${rows.length}, table has ${count}. Not writing.`); process.exit(2); }
writeFileSync(out, JSON.stringify(rows.map(({ is_published, ...r }) => r)));
const unpub = rows.filter((r) => !r.is_published).length;
console.log(`wrote ${rows.length} rows to ${out} (${rows.length - unpub} published, ${unpub} unpublished - all included)`);
