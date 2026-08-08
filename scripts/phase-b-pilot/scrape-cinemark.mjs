// Phase B pilot: Cinemark locator scrape. Sitemap gives 63 leaf pages under
// /restaurants/{state-city}/{restaurant-name}; each page ships a
// `__INITIAL__DATA__` blob with address, phone, and googlePlaceId. Politeness
// delay between requests; single-threaded on purpose.
//
// Usage: node scrape-cinemark.mjs <url-list.txt> <out-locator-list.json> [place-id-out.json]

import { readFileSync, writeFileSync } from "node:fs";

const [, , urlListPath, outPath, placeIdOutPath] = process.argv;
if (!urlListPath || !outPath) {
  console.error("Usage: node scrape-cinemark.mjs <url-list.txt> <out-locator-list.json> [place-id-out.json]");
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const DELAY_MS = 1200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractInitialData(html) {
  const marker = "__INITIAL__DATA__ = ";
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const start = idx + marker.length;
  let depth = 0,
    inStr = false,
    esc = false,
    end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  return JSON.parse(html.slice(start, end));
}

// Sitemap paths use HTML entities (&amp;) inside slugs like "scene-restaurant-&-lounge".
// The live URL is the decoded form.
function decodeEntities(url) {
  return url.replace(/&amp;/g, "&");
}

const urls = readFileSync(urlListPath, "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map(decodeEntities);

console.log(`Scraping ${urls.length} Cinemark restaurant pages...`);

const locations = [];
const placeIds = [];
const failures = [];

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
    if (!res.ok) {
      failures.push({ url, status: res.status });
      console.log(`  [${i + 1}/${urls.length}] HTTP ${res.status}: ${url}`);
      await sleep(DELAY_MS);
      continue;
    }
    const html = await res.text();
    const data = extractInitialData(html);
    if (!data?.document) {
      failures.push({ url, reason: "no __INITIAL__DATA__" });
      console.log(`  [${i + 1}/${urls.length}] no __INITIAL__DATA__: ${url}`);
      await sleep(DELAY_MS);
      continue;
    }
    const doc = data.document;
    const addr = doc.address ?? {};
    const parents = doc.dm_directoryParents ?? [];
    const cityFromParent = parents.length >= 3 ? parents[2].name : addr.city;

    locations.push({
      metro_area: cityFromParent,
      name: doc.name,
      address: addr.line1,
      city: addr.city,
      state: addr.region,
      zip: addr.postalCode,
      // mainPhone comes as "+12563278340"; the other locator lists carry raw digits w/o + or country code
      phone: (doc.mainPhone ?? "").replace(/^\+1/, "").replace(/\D/g, ""),
    });

    placeIds.push({
      name: doc.name,
      city: addr.city,
      state: addr.region,
      googlePlaceId: doc.googlePlaceId ?? null,
    });

    console.log(`  [${i + 1}/${urls.length}] ${doc.name} — ${addr.city}, ${addr.region}`);
  } catch (err) {
    failures.push({ url, error: String(err) });
    console.log(`  [${i + 1}/${urls.length}] error: ${err.message}`);
  }
  if (i < urls.length - 1) await sleep(DELAY_MS);
}

writeFileSync(outPath, JSON.stringify(locations, null, 2));
console.log(`\nWrote ${locations.length} locations to ${outPath}`);

if (placeIdOutPath) {
  writeFileSync(placeIdOutPath, JSON.stringify(placeIds, null, 2));
  console.log(`Wrote ${placeIds.length} place-id records to ${placeIdOutPath}`);
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${JSON.stringify(f)}`);
}
