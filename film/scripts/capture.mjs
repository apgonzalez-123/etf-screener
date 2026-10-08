// Real captures of the running app (npm run dev in ../web) for the film.
// Frozen to the current snapshot so every figure on screen is consistent across shots.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.APP ?? "http://localhost:5173/";
const OUT = new URL("../public/cap/", import.meta.url).pathname;
const layout = {};
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  localStorage.setItem("ses.mode", "desk");
  localStorage.setItem("ses.theme", "dark");
});
const page = await ctx.newPage();

async function go(hash, settle = 1800) {
  await page.goto(BASE + "#" + hash);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
}
async function box(name, sel) {
  const b = await page.locator(sel).first().boundingBox();
  layout[name] = b && { x: Math.round(b.x), y: Math.round(b.y + (await page.evaluate(() => document.querySelector(".main").scrollTop))), w: Math.round(b.width), h: Math.round(b.height) };
}
async function shot(name, sel) {
  await page.locator(sel).first().screenshot({ path: OUT + name + ".png" });
  await box(name, sel);
}

// 1. look-through: empty search, then NVDA result
await go("/look-through?q=NVDA");
await page.screenshot({ path: OUT + "look-nvda.png" });
await shot("hero", '[data-testid="hero-card"]');
await box("input", 'input[aria-label="Ticker"]');
await shot("holders", ".panel:has([data-testid='holders-table'])");
await page.fill('input[aria-label="Ticker"]', "");
await page.locator('[data-testid="hero-card"]').evaluate((el) => (el.style.visibility = "hidden"));
await page.locator(".panel:has([data-testid='holders-table'])").evaluate((el) => (el.style.visibility = "hidden"));
await page.screenshot({ path: OUT + "look-empty.png" });

// 2. portfolio look-through
await go("/look-through?tab=portfolio", 2500);
await page.screenshot({ path: OUT + "portfolio.png" });
await shot("exposures", ".panel:has(h3:text('Top 25 effective exposures'))");
await box("nvda-row", "tbody tr:first-child");

// 3. screener with RV columns
await go("/", 2200);
await page.screenshot({ path: OUT + "screener.png" });
await box("rv20-head", '[role="columnheader"]:has(button:text("RV 20d"))');
await box("grid", ".dgrid");

// 4. movers board
await go("/movers", 2200);
await page.screenshot({ path: OUT + "movers.png" });
await page.locator(".main").evaluate((el) => (el.scrollTop = 400));
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "movers-scrolled.png" });
await page.locator(".main").evaluate((el) => (el.scrollTop = 0));

// 5. tear sheet chart scrub: crosshair stepped across the chart
await go("/s/NVDA", 2500);
await page.screenshot({ path: OUT + "tear-nvda.png" });
const chart = await page.locator(".chart-box").boundingBox();
layout.chart = chart;
fs.mkdirSync(OUT + "scrub", { recursive: true });
const N = 48;
for (let i = 0; i < N; i++) {
  const x = chart.x + 40 + ((chart.width - 140) * i) / (N - 1);
  await page.mouse.move(x, chart.y + chart.height * 0.45);
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${OUT}scrub/${String(i).padStart(2, "0")}.png`, clip: { x: 216, y: 56, width: 1704, height: 560 } });
}
layout.scrubFrames = N;
await page.mouse.move(5, 5);

// 6. watchlist cards as cutouts
await go("/watchlists", 2000);
await page.screenshot({ path: OUT + "watchlists.png" });
const cards = page.locator(".watch-card");
const n = Math.min(4, await cards.count());
for (let i = 0; i < n; i++) await shot(`watch-${i}`, `.watch-card >> nth=${i}`);

// 7. ETF tear sheet (XLK) for the glass transition
await go("/s/XLK", 2500);
await page.screenshot({ path: OUT + "tear-xlk.png" });

fs.writeFileSync(OUT + "layout.json", JSON.stringify(layout, null, 2));
await browser.close();
console.log("captured", Object.keys(layout).length, "boxes");
