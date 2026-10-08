// Captures for the showcase cut (local only). Run with the app on :5173.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:5173/";
const OUT = new URL("../../public/cap2/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const L = {};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { localStorage.setItem("ses.mode", "desk"); localStorage.setItem("ses.theme", "dark"); });
const p = await ctx.newPage();
const go = async (h, w = 2000) => { await p.goto(BASE + "#" + h); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(w); };
const box = async (k, sel) => { const r = await p.locator(sel).first().boundingBox(); L[k] = r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
const cut = async (k, sel) => { await p.locator(sel).first().screenshot({ path: OUT + k + ".png" }); await box(k, sel); };
const shot = (k) => p.screenshot({ path: OUT + k + ".png" });

// Screener: default, then NL query built into chips
await go("/", 2500);
await shot("scr-default");
await box("nl-input", 'input[aria-label="Describe a screen"]');
await box("count", ".row.small.muted >> nth=0");
// provenance: read the real attributes of the first RV20 cell
const cell = p.locator('.dgrid-row').first().locator('.num[data-source]').nth(5);
L.prov = await cell.evaluate((e) => ({ text: e.textContent, source: e.getAttribute("data-source"), asof: e.getAttribute("data-asof"), title: e.getAttribute("title") }));
await box("provCell", '.dgrid-row >> nth=0');

const before = (await p.locator(".gold").first().textContent()).trim();
await p.fill('input[aria-label="Describe a screen"]', "Profitable semis within 15% of 52-week highs");
await p.click('button:has-text("Build filters")');
await p.waitForTimeout(1200);
await shot("scr-chips");
await cut("chips", '[aria-label="Filters"]');
L.countBefore = before;
L.countAfter = (await p.locator(".gold").first().textContent()).trim();
// Client mode screener
await go("/", 1500);
await p.click('button[aria-pressed]:has-text("Client")'); // the app's own mode toggle
await p.waitForTimeout(1200);
await shot("scr-client");
await p.click('button[aria-pressed]:has-text("Desk")');
await p.waitForTimeout(600);

// Command palette: who holds NVDA
await go("/", 1500);
await p.keyboard.press("Meta+K");
await p.waitForTimeout(400);
await p.keyboard.type("who holds NVDA", { delay: 40 });
await p.waitForTimeout(600);
await shot("cmdk");
await cut("cmdk-box", ".cmdk");
await p.keyboard.press("Escape"); // palette state survives hash navigation; close it
await p.waitForTimeout(300);

// Look-through result + overlap
await go("/look-through?q=NVDA", 2500);
await shot("look");
await cut("hero", '[data-testid="hero-card"]');
await go("/look-through?tab=overlap", 2500);
await shot("overlap");
await cut("overlap-card", ".glass");

// Portfolio
await go("/look-through?tab=portfolio", 3000);
await shot("portfolio");
await cut("flag", '[role="alert"] >> nth=0');
await box("exp-table", ".panel:has(h3:text('Top 25 effective exposures'))");

// Tear sheet top and lower panels
await go("/s/NVDA", 3000);
await shot("tear-top");
await p.locator(".main").evaluate((e) => (e.scrollTop = 620));
await p.waitForTimeout(600);
await shot("tear-mid");
await p.locator(".main").evaluate((e) => (e.scrollTop = 0));

// Movers, watchlists
await go("/movers", 2200);
await shot("movers");
await go("/watchlists", 2200);
await shot("watch");
for (let i = 0; i < 3; i++) await cut(`wcard-${i}`, `.watch-card >> nth=${i}`);

// Montage: more of the tool
await go("/s/XLK", 2800);
await shot("m-etf");
await go("/look-through?q=NVDA", 2500);
await p.locator(".main").evaluate((e) => (e.scrollTop = e.scrollHeight));
await p.waitForTimeout(1500);
await shot("m-hedge");
await go("/look-through?tab=ex", 3000);
await shot("m-ex");
await go("/compare?s=NVDA,AMD,AVGO,MU,TXN,ADI", 2500);
await shot("m-compare");

// real counts for the numbers sequence
const meta = await p.evaluate(async () => (await fetch("data/meta.json")).json());
L.meta = meta.counts;

fs.writeFileSync(OUT + "layout.json", JSON.stringify(L, null, 2));
await b.close();
console.log(JSON.stringify({ countBefore: L.countBefore, countAfter: L.countAfter, prov: L.prov }, null, 1));
