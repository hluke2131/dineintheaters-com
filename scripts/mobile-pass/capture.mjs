// Mobile/responsive pass: full-page screenshots plus layout checks (horizontal
// overflow, clipped/overflowing elements, small tap targets) at 375, 390, 768
// and 1280 wide, against a running local production server.
//
// Playwright is deliberately not a project dependency. Install it somewhere
// outside the repo and point PLAYWRIGHT_MODULE at its index.mjs:
//   PLAYWRIGHT_MODULE=file:///.../node_modules/playwright/index.mjs \
//   EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" \
//   BASE_URL=http://localhost:3100 node scripts/mobile-pass/capture.mjs
//
// Output goes to scripts/mobile-pass/output/ (untracked; never public/).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "output");
mkdirSync(outDir, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const base = process.env.BASE_URL ?? "http://localhost:3100";

const MARCUS = "marcus-baton-rouge-movie-tavern-citiplace-cinema";
const UNKNOWN = "indie-ma-millbury-blackstone-valley-14-cinema-de-lux";

const pages = [
  { name: "home", path: "/" },
  { name: "directory", path: "/dine-in-theaters", openFilters: true },
  { name: "directory-filtered", path: "/dine-in-theaters?alcohol_served=any&delivery_style=in_seat_delivery&menu_price_range=%24%24&reserved_recliners=true", openFilters: true },
  { name: "state-index", path: "/dine-in-theaters-in" },
  { name: "state-hub", path: "/dine-in-theaters-in/tx" },
  { name: "city-hub", path: "/dine-in-theaters-in/tx/austin" },
  { name: "listing-marcus", path: `/dine-in-theaters/${MARCUS}` },
  { name: "listing-unknown", path: `/dine-in-theaters/${UNKNOWN}` },
  { name: "blog", path: "/blog" },
  { name: "about-us", path: "/about-us" },
  { name: "contact", path: "/contact" },
  { name: "add-a-theater", path: "/add-a-theater" },
  { name: "add-a-theater-correction", path: `/add-a-theater?listing=${MARCUS}` },
];

const widths = [
  { w: 375, h: 812 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1280, h: 900 },
];

const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH, headless: true });
const report = [];

for (const vp of widths) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    isMobile: vp.w < 768,
    hasTouch: vp.w < 768,
  });
  for (const page of pages) {
    const tab = await context.newPage();
    await tab.goto(base + page.path, { waitUntil: "networkidle" });

    if (page.openFilters && vp.w < 1024) {
      await tab.locator("details > summary").first().click();
    }

    const result = await tab.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth > vw + 1;

      const describe = (el) => {
        const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 4).join(".") : "";
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
        return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} "${text}"`;
      };
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };

      // Elements that stick out past the right edge of the viewport and are
      // not simply inside a clipping ancestor.
      const clips = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "hidden" || o === "auto" || o === "scroll" || o === "clip") return true;
        }
        return false;
      };
      const overflowing = [];
      for (const el of document.body.querySelectorAll("*")) {
        if (!visible(el) || el.closest("svg")) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && !clips(el)) overflowing.push(describe(el) + ` right=${Math.round(r.right)}`);
      }

      // Own-line tap targets under 44x44 (inline links inside sentences are
      // excluded: WCAG treats them as in-sentence exceptions).
      const small = [];
      for (const el of document.querySelectorAll("a[href], button, summary, input, select, textarea")) {
        if (!visible(el)) continue;
        // A checkbox is tapped through its label, so measure the label row.
        const r = (el.matches("input") && el.closest("label") ? el.closest("label") : el).getBoundingClientRect();
        const display = getComputedStyle(el).display;
        const inSentence = display === "inline" && el.closest("p, li, address, span, dd") && el.closest("p, address, dd");
        if (inSentence) continue;
        if (r.width < 44 || r.height < 44) small.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }

      const bodyFontMin = Math.min(...[...document.body.querySelectorAll("p, li, a, dt, dd, span, button, label")]
        .filter((el) => visible(el) && (el.textContent ?? "").trim().length > 0)
        .map((el) => parseFloat(getComputedStyle(el).fontSize)));

      return { vw, scrollWidth: doc.scrollWidth, overflowX, overflowing: overflowing.slice(0, 8), small, smallestFontPx: bodyFontMin };
    });

    const file = `${page.name}-${vp.w}.png`;
    await tab.screenshot({ path: join(outDir, file), fullPage: true });
    report.push({ page: page.name, width: vp.w, file, ...result });
    await tab.close();
  }
  await context.close();
}

await browser.close();
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));

for (const r of report) {
  const flags = [];
  if (r.overflowX) flags.push(`H-SCROLL (scrollWidth ${r.scrollWidth} > ${r.vw})`);
  if (r.overflowing.length) flags.push(`overflowing: ${r.overflowing.join("; ")}`);
  if (r.small.length) flags.push(`${r.small.length} small targets`);
  console.log(`${String(r.width).padStart(4)} ${r.page.padEnd(26)} ${flags.length ? flags.join(" | ") : "ok"}`);
}
