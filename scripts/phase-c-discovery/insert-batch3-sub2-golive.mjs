// Batch 3 sub-batch 2 go-live (service role; WRITES TO THE LIVE DB, needs an explicit mode argument and separate go-live approval; reads staged JSON directly in Node, not through model context).
//   node --env-file=.env.local scripts/phase-c-discovery/insert-batch3-sub2-golive.mjs insert  -> inserts staged rows with chain_id null
//   node --env-file=.env.local scripts/phase-c-discovery/insert-batch3-sub2-golive.mjs link    -> explicit chain linking per the proposal (by domain)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const OUT = "scripts/phase-c-discovery/output";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stg = JSON.parse(readFileSync(`${OUT}/batch3-sub2-staged-qualifies.json`, "utf8")).locations;
const prop = JSON.parse(readFileSync(`${OUT}/batch3-sub2-chain-resolution-proposal.json`, "utf8"));
const COLS = ["slug","name","chain_id","sub_brand","address","city","state","zip","lat","lng","place_id","fsq_id","phone","website_url","ticketing_url","hours","delivery_style","alcohol_served","age_restricted_auditoriums","reserved_recliners","menu_price_range","amenities","accessibility_notes","parking_notes","safety_notes","description","status","last_verified_date","photos","is_sponsored","is_published"];
const mode = process.argv[2];
if (mode === "insert") {
  const rows = stg.map((r) => { const o = Object.fromEntries(COLS.map((c) => [c, r[c] ?? null])); o.chain_id = null; o.photos = null; o.is_published = true; o.is_sponsored = false; return o; });
  const { data: clash } = await sb.from("locations").select("place_id,slug").or(`place_id.in.(${rows.map((r) => r.place_id).join(",")}),slug.in.(${rows.map((r) => r.slug).join(",")})`);
  if (clash.length) throw new Error("collision: " + JSON.stringify(clash));
  const { data, error } = await sb.from("locations").insert(rows).select("id,name,state");
  if (error) throw error;
  console.log(`inserted ${data.length} rows`);
} else if (mode === "link") {
  const links = prop.rows.filter((r) => r.action === "link_existing" && stg.some((s) => s.place_id === r.place_id));
  let n = 0;
  for (const l of links) {
    const { data, error } = await sb.from("locations").update({ chain_id: l.chain_id }).eq("place_id", l.place_id).is("chain_id", null).select("id,name");
    if (error) throw error;
    if (data.length !== 1) throw new Error("link did not affect exactly one row: " + l.name);
    n++;
  }
  console.log(`linked ${n} rows`);
} else { console.error("mode: insert | link"); process.exit(1); }
