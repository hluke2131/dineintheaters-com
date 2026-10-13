// READ-ONLY. Verifies the site against the v3 mapping with real HTTP requests.
//   node verify-site.mjs local http://localhost:3100
//   node verify-site.mjs prod  https://dine-in-theaters.vercel.app
// `local` runs the full pre-merge suite against a local production build;
// `prod` runs the post-deploy suite. Exit code 5 when any check fails.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "output");
const [mode, baseArg] = process.argv.slice(2);
if (!["local", "prod"].includes(mode) || !baseArg) {
  console.error("usage: verify-site.mjs <local|prod> <base-url>");
  process.exit(1);
}
const base = baseArg.replace(/\/$/, "");
const CANON = "https://dineintheaters.com";
const mapping = JSON.parse(readFileSync(join(out, "slug-mapping-v3-final.json"), "utf8"));
const snapshot = JSON.parse(readFileSync(join(out, "locations-snapshot-pre-slug-v3.json"), "utf8")).locations;
const snapById = new Map(snapshot.map((r) => [r.id, r]));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function get(path, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(base + path, { redirect: "manual", ...opts });
      const body = opts.method === "HEAD" ? "" : await res.text();
      return { status: res.status, headers: res.headers, body };
    } catch (e) {
      if (attempt === 2) return { status: 0, headers: new Headers(), body: String(e) };
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
async function pool(items, worker, size = 8) {
  const outRes = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        outRes[i] = await worker(items[i], i);
      }
    })
  );
  return outRes;
}
const canonicalOf = (html) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
const targetPath = (loc) => (loc ? loc.replace(/^https?:\/\/[^/]+/, "") : null);

const published = mapping.filter((m) => m.is_published);
const unpublished = mapping.filter((m) => !m.is_published);
const redirects = mapping.filter((m) => m.changed && m.is_published);
const nameOf = (m) => snapById.get(m.location_id).name;

if (mode === "local") {
  // 1. every published new slug: 200 + canonical uses the new slug
  const r1 = await pool(published, async (m) => {
    const r = await get(`/dine-in-theaters/${m.new_slug}`);
    return { m, status: r.status, canon: canonicalOf(r.body) };
  });
  const bad1 = r1.filter((x) => x.status !== 200 || x.canon !== `${CANON}/dine-in-theaters/${x.m.new_slug}`);
  check(`all ${published.length} published new slugs return 200 with a canonical on the new slug`, bad1.length === 0, bad1.slice(0, 3).map((x) => `${x.m.new_slug}: ${x.status} ${x.canon}`).join("; "));

  // 2. 30 sampled old slugs: 308 to the right place, then 200
  const step = Math.floor(redirects.length / 30);
  const sample = Array.from({ length: 30 }, (_, i) => redirects[i * step]);
  const r2 = await pool(sample, async (m) => {
    const hop = await get(`/dine-in-theaters/${m.old_slug}`);
    const loc = targetPath(hop.headers.get("location"));
    const landed = loc ? await get(loc) : { status: 0 };
    return { m, hop: hop.status, loc, landed: landed.status };
  });
  const bad2 = r2.filter((x) => x.hop !== 308 || x.loc !== `/dine-in-theaters/${x.m.new_slug}` || x.landed !== 200);
  check("30 sampled old slugs: 308 to the expected new slug, then 200", bad2.length === 0, bad2.slice(0, 3).map((x) => `${x.m.old_slug}: ${x.hop} ${x.loc} ${x.landed}`).join("; "));

  // 3. every unpublished old AND new slug is 404
  const probes = unpublished.flatMap((m) => [m.old_slug, m.new_slug]);
  const r3 = await pool(probes, async (slug) => ({ slug, status: (await get(`/dine-in-theaters/${slug}`)).status }));
  const bad3 = r3.filter((x) => x.status !== 404);
  check(`all ${probes.length} unpublished old and new slugs return 404`, bad3.length === 0, bad3.slice(0, 3).map((x) => `${x.slug}: ${x.status}`).join("; "));

  // 4. hubs + card links
  const newSet = new Set(mapping.map((m) => m.new_slug));
  const oldChanged = new Set(mapping.filter((m) => m.changed).map((m) => m.old_slug));
  const idx = await get("/dine-in-theaters-in");
  const stateHrefs = [...new Set([...idx.body.matchAll(/href="\/dine-in-theaters-in\/([a-z]{2})"/g)].map((x) => x[1]))];
  check("state index lists 42 states", stateHrefs.length === 42, `${stateHrefs.length}`);
  let totalCards = 0;
  let linkedCities = 0;
  const badLinks = [];
  let tx = null;
  for (const st of stateHrefs) {
    const page = await get(`/dine-in-theaters-in/${st}`);
    const header = Number(page.body.match(/max-w-2xl text-lg text-ink\/70">(\d+)/)?.[1] ?? NaN);
    const slugs = [...page.body.matchAll(/href="\/dine-in-theaters\/([^"\/]+)"/g)].map((x) => x[1]);
    totalCards += slugs.length;
    linkedCities += new Set([...page.body.matchAll(new RegExp(`href="/dine-in-theaters-in/${st}/([^"]+)"`, "g"))].map((x) => x[1])).size;
    for (const s of slugs) if (!newSet.has(s) || oldChanged.has(s)) badLinks.push(`${st}:${s}`);
    if (st === "tx") tx = { header, cards: slugs.length };
  }
  check("state hubs list all 457 published listings", totalCards === 457, `${totalCards}`);
  check("22 linked city hubs", linkedCities === 22, `${linkedCities}`);
  check("TX hub 91 (header and cards)", tx && tx.header === 91 && tx.cards === 91, JSON.stringify(tx));
  check("every card link uses a new slug (no old slug linked)", badLinks.length === 0, badLinks.slice(0, 3).join("; "));
  // unlinked cities: distinct published city groups below 3 listings, from the DB snapshot
  const groups = new Map();
  const sl = (x) => x.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const r of snapshot.filter((r) => r.is_published && r.status === "active")) {
    const k = `${r.state}|${sl(r.city)}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  const unlinked = [...groups.values()].filter((n) => n < 3).length;
  check("324 unlinked cities (cities under 3 listings, live data)", unlinked === 324, `${unlinked}`);
  const count = async (q) => Number((await get(`/dine-in-theaters${q}`)).body.match(/text-2xl text-burgundy-dark">([\d,]+)/)?.[1]?.replace(/,/g, "") ?? NaN);
  check("Any alcohol 365", (await count("?alcohol_served=any")) === 365);
  check("Full bar 327", (await count("?alcohol_served=full_bar")) === 327);
  check("directory total 457", (await count("")) === 457);

  // 5. /add-a-theater?listing={old published slug}
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
  const pickOld = redirects.filter((m) => !/[<>]/.test(nameOf(m))).slice(0, 400);
  const sampleOld = [0, 40, 100, 200, 300].map((i) => pickOld[i]).filter(Boolean);
  const mm = redirects.find((m) => m.old_slug === "marcus-baton-rouge-movie-tavern-citiplace-cinema");
  if (mm) sampleOld.push(mm);
  const r5 = await pool(sampleOld, async (m) => {
    const r = await get(`/add-a-theater?listing=${encodeURIComponent(m.old_slug)}`);
    return { m, ok: r.status === 200 && r.body.includes("Correction for") && r.body.includes(esc(nameOf(m))) };
  });
  check(`/add-a-theater?listing={old published slug} shows the right listing (${sampleOld.length} tried)`, r5.every((x) => x.ok), r5.filter((x) => !x.ok).map((x) => x.m.old_slug).join("; "));
  const unp = unpublished[0];
  const gen = await get(`/add-a-theater?listing=${encodeURIComponent(unp.old_slug)}`);
  const gen2 = await get(`/add-a-theater?listing=${encodeURIComponent(unp.new_slug)}`);
  check("unpublished old and new slug on ?listing= show the generic page", gen.status === 200 && !gen.body.includes("Correction for") && gen2.status === 200 && !gen2.body.includes("Correction for"));
}

if (mode === "prod") {
  // all published old -> new redirects
  const r1 = await pool(
    redirects,
    async (m) => {
      const hop = await get(`/dine-in-theaters/${m.old_slug}`);
      const loc = targetPath(hop.headers.get("location"));
      const landed = loc ? await get(loc, { method: "HEAD" }) : { status: 0 };
      return { m, hop: hop.status, loc, landed: landed.status };
    },
    6
  );
  const bad = r1.filter((x) => x.hop !== 308 || x.loc !== `/dine-in-theaters/${x.m.new_slug}` || x.landed !== 200);
  check(`all ${redirects.length} old slugs return 308 to the expected new slug and the target returns 200`, bad.length === 0, bad.slice(0, 3).map((x) => `${x.m.old_slug}: ${x.hop} ${x.loc} ${x.landed}`).join("; "));

  // 20 unpublished (old and new) slugs
  const sampleUnp = Array.from({ length: 10 }, (_, i) => unpublished[i * Math.floor(unpublished.length / 10)]);
  const probes = sampleUnp.flatMap((m) => [m.old_slug, m.new_slug]);
  const r2 = await pool(probes, async (s) => ({ s, st: (await get(`/dine-in-theaters/${s}`)).status }), 6);
  check(`${probes.length} unpublished old/new slugs return 404`, r2.every((x) => x.st === 404), r2.filter((x) => x.st !== 404).map((x) => `${x.s}:${x.st}`).join("; "));

  const home = await get("/");
  const stat = home.body.match(/text-gold-bright">([\d,]+)<\/span>.*?<span class="font-medium text-cream">(\d+)<\/span>/);
  check("homepage stat 457 theaters / 42 states", stat && stat[1] === "457" && stat[2] === "42", stat ? `${stat[1]} / ${stat[2]}` : "no match");

  const listing = redirects[0].new_slug;
  const headerChecks = [
    ["/", 200],
    [`/dine-in-theaters/${listing}`, 200],
    ["/dine-in-theaters-in/tx", 200],
    [`/dine-in-theaters/${unpublished[0].new_slug}`, 404],
  ];
  const hd = await pool(headerChecks, async ([p, want]) => {
    const r = await get(p, { method: "HEAD" });
    return { p, want, st: r.status, xr: r.headers.get("x-robots-tag") };
  }, 4);
  check("X-Robots-Tag: noindex, nofollow on /, a listing, a hub and a 404", hd.every((x) => x.st === x.want && x.xr === "noindex, nofollow"), JSON.stringify(hd));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 5 : 0);
