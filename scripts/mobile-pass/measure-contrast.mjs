// Measures real rendered text/background contrast in a headless browser: for
// each target the text is made transparent, the element's box is screenshotted
// to sample the true background (gradients, glow, grain included), and the
// text colour is composited over every sampled pixel. Reports the worst pixel
// and the median. Run against a local production server; see capture.mjs for
// the env vars (PLAYWRIGHT_MODULE, EDGE_PATH, BASE_URL).

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const base = process.env.BASE_URL ?? "http://localhost:3100";
const MARCUS = "marcus-baton-rouge-movie-tavern-citiplace-cinema";
const UNKNOWN = "indie-ma-millbury-blackstone-valley-14-cinema-de-lux";

// `before` is the colour the same text used before the contrast pass, so the
// table can show before/after on identical backgrounds.
const targets = [
  { name: "Hero eyebrow (home)", url: "/", w: 1280, sel: 'p:text-is("The dine-in movie theater directory")', before: "#c9a227" },
  { name: "Hero eyebrow (home)", url: "/", w: 375, sel: 'p:text-is("The dine-in movie theater directory")', before: "#c9a227" },
  { name: "Hero stat count (home)", url: "/", w: 1280, sel: "section span.font-display.text-2xl", before: "#c9a227" },
  { name: "Hero description (cream/90)", url: "/", w: 1280, sel: "section p.text-lg", before: null },
  { name: "Gold eyebrow, white bg (How We Choose)", url: "/", w: 1280, sel: 'p:text-is("How We Choose")', before: "#c9a227" },
  { name: "Gold eyebrow, cream bg (Popular Cities)", url: "/", w: 1280, sel: 'p:text-is("Popular Cities")', before: "#c9a227" },
  { name: "Gold eyebrow, cream bg (Directory)", url: "/dine-in-theaters", w: 1280, sel: 'p:text-is("Directory")', before: "#c9a227" },
  { name: "Body: section lead (ink/70, white)", url: "/", w: 1280, sel: 'p:text-is("We list only theaters where you can order a real meal, at your seat or at the counter. That’s the whole standard.")', before: null },
  { name: "Body: listing description (ink/85, cream)", url: `/dine-in-theaters/${MARCUS}`, w: 1280, sel: "div.border-l-4 > p", first: true, before: null },
  { name: "Muted: breadcrumb (ink/60, cream)", url: `/dine-in-theaters/${MARCUS}`, w: 1280, sel: 'nav[aria-label="Breadcrumb"] a:text-is("Home")', before: null },
  { name: "Muted: 'Not yet confirmed' (was ink/50, white)", url: `/dine-in-theaters/${UNKNOWN}`, w: 1280, sel: 'span:text-is("Not yet confirmed")', first: true, before: "rgba(34,20,24,0.5)" },
  { name: "Muted: detail label dt (was ink/50, white)", url: `/dine-in-theaters/${UNKNOWN}`, w: 1280, sel: 'dt:text-is("Delivery style")', before: "rgba(34,20,24,0.5)" },
  { name: "Muted: 'No reviews yet' (was ink/50, cream)", url: `/dine-in-theaters/${UNKNOWN}`, w: 1280, sel: 'p:text-is("No reviews yet.")', before: "rgba(34,20,24,0.5)" },
  { name: "Muted: card count (ink/60, white)", url: "/dine-in-theaters-in", w: 1280, sel: "a p.text-sm", first: true, before: null },
  { name: "Footer link (cream/80, burgundy-dark)", url: "/", w: 1280, sel: 'footer a:text-is("Browse Theaters")', before: null },
  { name: "Footer heading (gold, burgundy-dark)", url: "/", w: 1280, sel: 'footer h3:text-is("Directory")', before: null },
  { name: "Footer copyright (cream/60)", url: "/", w: 1280, sel: "footer div.border-t p, footer div.border-t > div", first: true, before: null },
];

const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = ([r, g, b, a], bg) => [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)];

const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH, headless: true });
const decoder = await (await browser.newContext()).newPage();
const results = [];

const rgbaOf = (page, css) =>
  page.evaluate((c) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }, css);

for (const t of targets) {
  const ctx = await browser.newContext({ viewport: { width: t.w, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + t.url, { waitUntil: "networkidle" });
  let loc = page.locator(t.sel);
  loc = t.first ? loc.first() : loc.first();
  await loc.scrollIntoViewIfNeeded();
  const cssColor = await loc.evaluate((el) => getComputedStyle(el).color);
  await loc.evaluate((el) => {
    el.style.setProperty("color", "transparent", "important");
    el.querySelectorAll("*").forEach((c) => c.style.setProperty("color", "transparent", "important"));
  });
  const png = await loc.screenshot();
  const [afterRgba, beforeRgba] = await Promise.all([
    rgbaOf(decoder, cssColor),
    t.before ? rgbaOf(decoder, t.before) : Promise.resolve(null),
  ]);
  const pixels = await decoder.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const c = cv.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, data: Array.from(c.getImageData(0, 0, img.width, img.height).data) };
  }, png.toString("base64"));

  // Skip the outermost pixel ring: fractional element edges anti-alias into
  // whatever is next to the box and would read as a false worst case.
  const stats = (fg) => {
    const rs = [];
    for (let y = 1; y < pixels.h - 1; y++) {
      for (let x = 1; x < pixels.w - 1; x++) {
        const i = (y * pixels.w + x) * 4;
        const bg = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
        rs.push(ratio(over(fg, bg), bg));
      }
    }
    rs.sort((a, b) => a - b);
    return { worst: rs[0], median: rs[Math.floor(rs.length / 2)] };
  };
  const after = stats(afterRgba);
  const before = beforeRgba ? stats(beforeRgba) : null;
  results.push({ ...t, after, before });
  await ctx.close();
}
await browser.close();

const f = (n) => n.toFixed(2);
console.log("element".padEnd(52), "w".padStart(5), "before(worst/med)".padStart(19), "after(worst/med)".padStart(19));
for (const r of results) {
  console.log(
    r.name.padEnd(52),
    String(r.w).padStart(5),
    (r.before ? `${f(r.before.worst)} / ${f(r.before.median)}` : "—").padStart(19),
    `${f(r.after.worst)} / ${f(r.after.median)}`.padStart(19)
  );
}
