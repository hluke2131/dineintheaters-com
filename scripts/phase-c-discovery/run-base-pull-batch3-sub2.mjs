// Batch 3 Sub-batch 2 base pull: CT, UT, NV, IA, AR, KS. Copy of run-base-pull-batch3-sub1.mjs (originals untouched).
// Differences from the original:
//  - Sub-batch 2 city lists (output/_batch3-sub2-cities.json) and state map.
//  - ADDED vs sub-batch 1: read-only balance guard (GET /profile) before any submission; halts below $3.
//  - 504 / error recovery window is 40 minutes (160 polls x 15s), up from 20. Earlier late runs
//    finished 7-20 minutes after the gateway timeout and outlasted the old window.
//  - NEVER resubmit on any non-OK response or thrown error. The task keeps running and bills server-side.
//  - Refuses to start while ANY task is running, or while the ledger (output/_batch3-sub2-task-ledger.json) holds a
//    submitted-but-unrecovered entry, or while a finished task started in the last 90 minutes has not been
//    claimed in the ledger (a possibly late, unrecovered earlier run).
//  - Records the winning task id and usage in the ledger, and flags duplicate billing: the same task id appearing
//    more than once in the finished list (a re-executed request can bill duplicate records).
//
// Usage: node --env-file=.env.local scripts/phase-c-discovery/run-base-pull-batch3-sub2.mjs <state-code> <out-raw.json>

import { writeFileSync, readFileSync, existsSync } from "node:fs";

const [, , stateArg, outPath] = process.argv;
const apiKey = process.env.OUTSCRAPER_API_KEY;

if (!stateArg || !outPath || !apiKey) {
  console.error("Usage: OUTSCRAPER_API_KEY=... node run-base-pull-batch3-sub2.mjs <state-code> <out-raw.json>");
  process.exit(1);
}

const CITIES = JSON.parse(readFileSync(new URL("./output/_batch3-sub2-cities.json", import.meta.url), "utf8"));

const STATE_NAMES = { ct: "CT", ut: "UT", nv: "NV", ia: "IA", ar: "AR", ks: "KS" };

const stateCode = stateArg.toLowerCase();
const cities = CITIES[stateCode];
if (!cities) {
  console.error(`Unknown state "${stateArg}", expected one of: ${Object.keys(CITIES).join(", ")}`);
  process.exit(1);
}
const stateAbbr = STATE_NAMES[stateCode];
const queries = cities.map((city) => `movie theater, ${city}, ${stateAbbr}, USA`);

const params = new URLSearchParams();
for (const q of queries) params.append("query", q);
params.append("limit", "600");
params.append("dropDuplicates", "true");
params.append("async", "false");
params.append("region", "US");

const H = { "X-API-KEY": apiKey };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LEDGER = new URL("./output/_batch3-sub2-task-ledger.json", import.meta.url);
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { entries: [] };
const saveLedger = () => writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));

// ---- Balance guard (added in sub-batch 2): read-only /profile call; refuse to spend below the hard floor.
const MIN_BALANCE_USD = 3;
const profile = await (await fetch("https://api.app.outscraper.com/profile", { headers: H })).json();
const balance = Number(profile.balance ?? profile.account_balance);
if (!Number.isFinite(balance)) {
  console.error("Could not read the Outscraper balance from /profile; refusing to submit.");
  process.exit(1);
}
if (balance < MIN_BALANCE_USD) {
  console.error(`HALT: Outscraper balance $${balance.toFixed(2)} is below the $${MIN_BALANCE_USD} floor. Not submitting.`);
  process.exit(1);
}
console.log(`Outscraper balance $${balance.toFixed(2)} (hard floor $${MIN_BALANCE_USD}).`);

// ---- Pre-flight guards: never start a second request while one is running or recoverable.
const running = await (await fetch("https://api.app.outscraper.com/requests?type=running&limit=5", { headers: H })).json();
if ((running.items ?? []).length > 0) {
  console.error(`Refusing to submit: ${running.items.length} Outscraper task(s) already running: ${running.items.map((t) => t.id).join(", ")}`);
  process.exit(1);
}
const unrecovered = ledger.entries.filter((e) => e.status !== "recovered" && e.status !== "ok");
if (unrecovered.length > 0) {
  console.error(`Refusing to submit: ledger has unrecovered submission(s): ${unrecovered.map((e) => e.state).join(", ")}. Recover by task id from the Outscraper task list; do NOT resubmit.`);
  process.exit(1);
}
const claimed = new Set(ledger.entries.map((e) => e.task_id).filter(Boolean));
const nowSec = Math.floor(Date.now() / 1000);
const finBefore = await (await fetch("https://api.app.outscraper.com/requests?type=finished&limit=10", { headers: H })).json();
// First run only: the finished tasks that exist right now belong to earlier, already-consumed work (reported
// separately in Step 0). Record them as a baseline so they are not mistaken for a late result of ours.
if (!ledger.baseline_ids) { ledger.baseline_ids = (finBefore.items ?? []).map((t) => t.id); saveLedger(); }
const recentUnclaimed = (finBefore.items ?? []).filter((t) => t.start_date >= nowSec - 90 * 60 && !claimed.has(t.id) && !ledger.baseline_ids.includes(t.id));
if (recentUnclaimed.length > 0) {
  console.error(`Refusing to submit: finished task(s) started in the last 90 min are not claimed: ${recentUnclaimed.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

console.log(`Querying Outscraper for ${queries.length} ${stateAbbr} cities/towns...`);
const submittedAt = Math.floor(Date.now() / 1000) - 5;
const entry = { state: stateAbbr, submitted_at: submittedAt, status: "submitted", task_id: null, usage: null, balance_before_usd: balance };
ledger.entries.push(entry);
saveLedger();

let data;
let res;
try {
  res = await fetch(`https://api.outscraper.com/google-maps-search?${params.toString()}`, { headers: H });
} catch (err) {
  res = null;
  console.error(`Request errored (${err.message}); recovering from finished-task list.`);
}

if (res?.ok) {
  data = await res.json();
  entry.status = "ok";
  entry.task_id = data.id ?? null;
} else {
  if (res) console.error(`Outscraper request returned ${res.status}; task may still have run. Recovering from finished-task list for up to 40 min (NOT re-submitting).`);
  for (let i = 0; i < 160 && !data; i++) {
    await sleep(15000);
    const fin = await (await fetch("https://api.app.outscraper.com/requests?type=finished&limit=10", { headers: H })).json();
    const hit = (fin.items ?? []).find((t) => t.start_date >= submittedAt && !claimed.has(t.id));
    if (hit) {
      console.log(`Found finished task ${hit.id} (usage ${hit.usage}, started ${hit.start_date}); fetching results.`);
      data = await (await fetch(`https://api.outscraper.com/requests/${hit.id}`, { headers: H })).json();
      if (data.status !== "Success") {
        console.error(`Task ${hit.id} status ${data.status}`);
        entry.task_id = hit.id; entry.status = "failed-status-" + data.status; saveLedger();
        process.exit(1);
      }
      entry.status = "recovered"; entry.task_id = hit.id; entry.usage = hit.usage;
    }
  }
  if (!data) {
    saveLedger();
    console.error("No finished task found after 40 min. Do NOT re-submit; inspect the Outscraper task list manually.");
    process.exit(1);
  }
}

writeFileSync(outPath, JSON.stringify(data, null, 2));

// Duplicate-billing check: the same task id appearing more than once in the finished list.
const finAfter = await (await fetch("https://api.app.outscraper.com/requests?type=finished&limit=10", { headers: H })).json();
const sameId = (finAfter.items ?? []).filter((t) => t.id === entry.task_id);
entry.finished_list_rows_for_task = sameId.length;
entry.usage_rows = sameId.map((t) => t.usage);
if (sameId.length > 1) console.error(`WARNING: task ${entry.task_id} appears ${sameId.length}x in the finished list (usage ${entry.usage_rows.join("+")}): possible duplicate billing.`);
saveLedger();

const batches = Array.isArray(data.data?.[0]) ? data.data : [data.data ?? []];
const places = batches.flat().filter(Boolean);
console.log(`Status: ${data.status}. Got ${places.length} deduplicated places across ${queries.length} queries. Task ${entry.task_id}. Wrote to ${outPath}`);
