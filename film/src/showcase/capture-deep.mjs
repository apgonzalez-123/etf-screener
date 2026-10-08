// Full-height NVDA tear sheet + section boxes for the deep-dive pan. Local only.
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = new URL("../../public/cap2/", import.meta.url).pathname;
const b = await chromium.launch();
// a tall viewport so the whole scrolling page renders in one image
const ctx = await b.newContext({ viewport: { width: 1600, height: 3400 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { localStorage.setItem("ses.mode", "desk"); localStorage.setItem("ses.theme", "dark"); });
const p = await ctx.newPage();
await p.goto("http://localhost:5173/#/s/NVDA");
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(3500);
const h = await p.evaluate(() => document.querySelector(".page").getBoundingClientRect().bottom + 24);
await p.screenshot({ path: OUT + "deep-nvda.png", clip: { x: 0, y: 0, width: 1600, height: Math.ceil(h) } });
const sections = await p.evaluate(() => {
  const out = [];
  const chart = document.querySelector(".chart-box")?.closest(".panel");
  const kv = document.querySelector(".kv");
  const add = (name, el) => { if (!el) return; const r = el.getBoundingClientRect(); out.push({ name, x: r.x, y: r.y, w: r.width, h: r.height }); };
  add("Price and volume", chart);
  add("Snapshot", kv);
  for (const h3 of document.querySelectorAll(".panel h3")) add(h3.textContent.trim(), h3.closest(".panel"));
  return out;
});
fs.writeFileSync(OUT + "deep.json", JSON.stringify({ pageH: Math.ceil(h), sections }, null, 1));
console.log(Math.ceil(h), sections.map((s) => s.name + "@" + Math.round(s.y)).join(" | "));
await b.close();
