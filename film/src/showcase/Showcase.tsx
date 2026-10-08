// Showcase cut. Platform and module names are props: the defaults are neutral, and an
// internal cut is rendered locally with --props=src/showcase/internal-props.json (git-ignored).
import { createContext, useContext, useEffect, useState } from "react";
import { AbsoluteFill, Audio, Img, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { GlassCard } from "../scenes/GlassCard";
import { EASE_CAM, EASE_IN, T } from "../tokens";
import L0 from "../../public/cap2/layout.json";
import DEEP from "../../public/cap2/deep.json";

const L = L0 as unknown as Record<string, { x: number; y: number; w: number; h: number }> & {
  countBefore: string;
  countAfter: string;
  prov: { text: string; source: string; asof: string; title: string };
};

export const BEAT = 20;
export const bf = (n: number) => Math.round(n * BEAT);
export const DURATION = bf(176); // 117.3 s

// ---------------------------------------------------------------- timeline (single source of truth)
export const CH = {
  open: [bf(0), bf(12)],
  intro: [bf(12), bf(20)], // launch reveal
  hub: [bf(20), bf(29)],
  screen: [bf(29), bf(47)],
  look: [bf(47), bf(68)],
  nums: [bf(68), bf(80)], // by the numbers
  conc: [bf(80), bf(92)],
  tear: [bf(92), bf(117)], // go inside a name: every section of the tear sheet
  movers: [bf(117), bf(129)],
  watch: [bf(129), bf(141)],
  modes: [bf(141), bf(150)],
  montage: [bf(150), bf(158)],
  close: [bf(158), bf(167)],
  lockup: [bf(167), bf(176)],
} as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (f: number, a: number, b: number, from = 0, to = 1, e = EASE_CAM) => interpolate(f, [a, b], [from, to], { ...clamp, easing: e });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------- the app window
const WIN_W = 1240;
const WIN_H = 775; // 1600 x 1000 captures at 0.775
const PAGE_W = 1600;
const PAGE_H = 1000;
const BASE = WIN_W / PAGE_W;

type WinKey = { f: number; x: number; y: number; s: number; ry: number; rx: number };
// Window pose through the film: one continuous object, never cut.
const WIN: WinKey[] = [
  { f: CH.screen[0] - 2, x: 960, y: 540, s: 0.16, ry: 0, rx: 0 }, // born from the hub tile
  { f: CH.screen[0] + 34, x: 1230, y: 540, s: 1, ry: -9, rx: 3 },
  { f: CH.look[0], x: 1240, y: 545, s: 1, ry: -6, rx: 2 },
  { f: CH.look[1] - 10, x: 1245, y: 545, s: 1, ry: -6, rx: 2 },
  { f: CH.nums[1] - 20, x: 1255, y: 545, s: 0.9, ry: -10, rx: 3 },
  { f: CH.conc[0], x: 1255, y: 545, s: 1.0, ry: -10, rx: 3 },
  { f: CH.tear[0], x: 1250, y: 540, s: 1, ry: -5, rx: 2 },
  { f: CH.tear[0] + 70, x: 1290, y: 540, s: 1.05, ry: -3, rx: 1 },
  { f: CH.tear[1] - 20, x: 1290, y: 540, s: 1.05, ry: -3, rx: 1 },
  { f: CH.movers[0], x: 1240, y: 545, s: 1, ry: -9, rx: 3 },
  { f: CH.watch[0], x: 1250, y: 540, s: 1, ry: -6, rx: 2 },
  { f: CH.watch[1] - 10, x: 1260, y: 540, s: 1, ry: -6, rx: 2 },
  { f: CH.modes[0] + 10, x: 960, y: 600, s: 1.04, ry: 0, rx: 0 },
  { f: CH.modes[1] - 6, x: 960, y: 600, s: 1.06, ry: 0, rx: 0 },
  { f: CH.montage[0] + 8, x: 960, y: 560, s: 1.18, ry: 0, rx: 0 },
  { f: CH.montage[1] - 4, x: 960, y: 560, s: 1.22, ry: 0, rx: 0 },
  { f: CH.close[0] + 36, x: 960, y: 540, s: 0.16, ry: 0, rx: 0 }, // folds back into the tile
];
function pose(f: number) {
  let a = WIN[0];
  let b = WIN[WIN.length - 1];
  for (let i = 0; i < WIN.length - 1; i++)
    if (f >= WIN[i].f && f <= WIN[i + 1].f) {
      a = WIN[i];
      b = WIN[i + 1];
      break;
    }
  const t = a.f === b.f ? 1 : ease(f, a.f, b.f);
  if (f < WIN[0].f) return WIN[0];
  if (f > WIN[WIN.length - 1].f) return WIN[WIN.length - 1];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t), ry: lerp(a.ry, b.ry, t), rx: lerp(a.rx, b.rx, t) };
}

// Page shown inside the window, with its own camera (page-space centre + zoom).
type Shot = { from: number; src: string; h?: number; cam: { f: number; cx: number; cy: number; z: number }[] };

// Deep dive: the camera visits each section of the real NVDA tear sheet in reading order.
const SECTION_NOTE: Record<string, string> = {
  "Price and volume": "Scrub a year of price and volume",
  Snapshot: "Valuation, volatility and earnings at a glance",
  Fundamentals: "Eight quarters of fundamentals",
  "Street view": "Ratings and price targets",
  Technicals: "Trend and the 52-week range",
  "ETF ownership": "Every fund that holds it",
  Peers: "Peers, with 60-day correlation",
  Headlines: "The latest headlines",
};
const DEEP_STOPS = (DEEP.sections as { name: string; x: number; y: number; w: number; h: number }[]).filter((s) => SECTION_NOTE[s.name]);
const STOP = 44; // frames per section
const DEEP_CAM = [
  { f: 0, cx: 800, cy: 330, z: 1.0 },
  // arrive, then hold 18 frames so each section can be read before the next glide
  ...DEEP_STOPS.flatMap((s, i) => {
    const k = { cx: s.x + s.w / 2, cy: s.y + Math.min(s.h, 420) / 2, z: Math.min(1.75, 1480 / (s.w + 140)) };
    return [{ f: 20 + i * STOP, ...k }, { f: 20 + i * STOP + 18, ...k }];
  }),
  ...DEEP_STOPS.slice(-1).map((s) => ({ f: 20 + DEEP_STOPS.length * STOP, cx: s.x + s.w / 2, cy: s.y + Math.min(s.h, 420) / 2, z: 1.6 })),
];
const SHOTS: Shot[] = [
  { from: CH.screen[0], src: "cap2/scr-default.png", cam: [{ f: 0, cx: 800, cy: 500, z: 1 }, { f: 70, cx: 800, cy: 500, z: 1 }, { f: 130, cx: 760, cy: 330, z: 1.35 }] },
  { from: CH.screen[0] + 150, src: "cap2/scr-chips.png", cam: [{ f: 0, cx: 760, cy: 330, z: 1.35 }, { f: 120, cx: 800, cy: 430, z: 1.1 }, { f: 210, cx: 800, cy: 480, z: 1.0 }] },
  { from: CH.look[0], src: "cap2/cmdk.png", cam: [{ f: 0, cx: 800, cy: 420, z: 1.05 }, { f: 70, cx: 800, cy: 330, z: 1.3 }] },
  { from: CH.look[0] + 80, src: "cap2/look.png", cam: [{ f: 0, cx: 800, cy: 420, z: 1.05 }, { f: 60, cx: 860, cy: 430, z: 1.15 }, { f: 200, cx: 860, cy: 560, z: 1.08 }] },
  { from: CH.look[0] + 270, src: "cap2/overlap.png", cam: [{ f: 0, cx: 800, cy: 420, z: 1.05 }, { f: 150, cx: 840, cy: 470, z: 1.15 }] },
  { from: CH.conc[0], src: "cap2/portfolio.png", cam: [{ f: 0, cx: 900, cy: 420, z: 1.05 }, { f: 240, cx: 980, cy: 470, z: 1.22 }] },
  { from: CH.tear[0], src: "cap2/scr-default.png", cam: [{ f: 0, cx: 800, cy: 500, z: 1 }, { f: 50, cx: 700, cy: 420, z: 1.25 }] },
  { from: CH.tear[0] + 64, src: "cap2/deep-nvda.png", h: DEEP.pageH, cam: DEEP_CAM },
  { from: CH.movers[0], src: "cap2/movers.png", cam: [{ f: 0, cx: 840, cy: 420, z: 1.15 }, { f: 240, cx: 860, cy: 640, z: 1.08 }] },
  { from: CH.watch[0], src: "cap2/watch.png", cam: [{ f: 0, cx: 840, cy: 420, z: 1.1 }, { f: 240, cx: 840, cy: 520, z: 1.05 }] },
  { from: CH.modes[0], src: "cap2/scr-default.png", cam: [{ f: 0, cx: 800, cy: 500, z: 1 }] },
  // montage: two beats each, cut on the beat
  { from: CH.montage[0], src: "cap2/m-etf.png", cam: [{ f: 0, cx: 760, cy: 360, z: 1.05 }, { f: 40, cx: 760, cy: 330, z: 1.15 }] },
  { from: CH.montage[0] + 40, src: "cap2/m-hedge.png", cam: [{ f: 0, cx: 820, cy: 520, z: 1.15 }, { f: 40, cx: 820, cy: 500, z: 1.22 }] },
  { from: CH.montage[0] + 80, src: "cap2/m-ex.png", cam: [{ f: 0, cx: 900, cy: 260, z: 1.5 }, { f: 40, cx: 920, cy: 270, z: 1.62 }] },
  { from: CH.montage[0] + 120, src: "cap2/m-compare.png", cam: [{ f: 0, cx: 820, cy: 420, z: 1.05 }, { f: 40, cx: 820, cy: 400, z: 1.12 }] },
];
const FADE = 14;

function camAt(s: Shot, local: number) {
  const k = s.cam;
  let a = k[0];
  let b = k[k.length - 1];
  for (let i = 0; i < k.length - 1; i++)
    if (local >= k[i].f && local <= k[i + 1].f) {
      a = k[i];
      b = k[i + 1];
      break;
    }
  const t = a.f === b.f ? 1 : ease(local, a.f, b.f);
  if (local <= k[0].f) return k[0];
  if (local >= k[k.length - 1].f) return k[k.length - 1];
  return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), z: lerp(a.z, b.z, t) };
}

/** Map a page-space point to window-space pixels for the shot active at frame f. */
function toWin(s: Shot, f: number, x: number, y: number) {
  const c = camAt(s, f - s.from);
  const k = BASE * c.z;
  return { x: WIN_W / 2 + (x - c.cx) * k, y: WIN_H / 2 + (y - c.cy) * k, k };
}

const PageLayer: React.FC<{ s: Shot; f: number; opacity: number; blur: number }> = ({ s, f, opacity, blur }) => {
  const c = camAt(s, f - s.from);
  const k = BASE * c.z;
  const ph = s.h ?? PAGE_H;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: PAGE_W,
        height: ph,
        transformOrigin: "0 0",
        transform: `translate(${WIN_W / 2 - c.cx * k}px, ${WIN_H / 2 - c.cy * k}px) scale(${k})`,
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    >
      <Img src={staticFile(s.src)} style={{ width: PAGE_W, height: ph }} />
    </div>
  );
};

/** A real element cutout that lifts out of the page toward the viewer, holds, and settles back. */
const Lift: React.FC<{ s: Shot; f: number; img: string; box: { x: number; y: number; w: number; h: number }; at: number; hold: number }> = ({ s, f, img, box, at, hold }) => {
  const up = ease(f, at, at + 21, 0, 1, EASE_IN);
  const down = ease(f, at + 21 + hold, at + 21 + hold + 18);
  const p = up * (1 - down);
  if (p <= 0) return null;
  const tl = toWin(s, f, box.x, box.y);
  return (
    <div
      style={{
        position: "absolute",
        left: tl.x,
        top: tl.y,
        width: box.w * tl.k,
        height: box.h * tl.k,
        transformOrigin: "50% 50%",
        transform: `translate3d(0, ${-26 * p}px, ${60 * p}px) scale(${1 + 0.06 * p})`,
        boxShadow: `0 ${30 * p}px ${70 * p}px -20px rgba(0,0,0,${0.75 * p}), 0 0 0 ${1.5 * p}px rgba(201,164,92,${0.7 * p})`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <Img src={staticFile(img)} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

const Cursor: React.FC<{ x: number; y: number; press?: number; opacity: number }> = ({ x, y, press = 0, opacity }) => (
  <div style={{ position: "absolute", left: x, top: y, opacity, transform: `scale(${1 - 0.12 * press})`, transformOrigin: "0 0", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}>
    <svg width="26" height="32" viewBox="0 0 26 32">
      <path d="M2 2 L2 26 L8.5 20 L13 30 L17 28.2 L12.6 18.6 L21.5 18.6 Z" fill={T.ink} stroke="#07111F" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
    {press > 0 && <div style={{ position: "absolute", left: -14, top: -14, width: 32, height: 32, borderRadius: "50%", border: `2px solid ${T.gold2}`, opacity: 1 - press, transform: `scale(${0.6 + press})` }} />}
  </div>
);

const AppWindow: React.FC = () => {
  const f = useCurrentFrame();
  if (f < CH.screen[0] - 2 || f > CH.close[0] + 40) return null;
  const P = pose(f);
  const born = ease(f, CH.screen[0] - 2, CH.screen[0] + 10);
  const dying = ease(f, CH.close[0] + 24, CH.close[0] + 40);
  // active shots (cross-dissolve with a breath of blur = no hard cuts)
  const layers = SHOTS.map((s, i) => {
    const next = SHOTS[i + 1];
    const fd = s.from >= CH.montage[0] ? 4 : FADE;
    const fdn = next && next.from >= CH.montage[0] ? 4 : FADE;
    const inA = ease(f, s.from, s.from + fd, 0, 1, EASE_IN);
    const out = next ? ease(f, next.from, next.from + fdn, 0, 1, EASE_IN) : 0;
    const op = i === 0 ? 1 - out : inA * (1 - out);
    const blur = Math.max(0, (1 - inA) * 6);
    return { s, op, blur };
  }).filter((l) => l.op > 0.001 && f >= l.s.from - 1);

  const sh = (i: number) => SHOTS[i];
  const screenF = f - CH.screen[0];
  // NL query typed into the real input on scr-default
  const query = "Profitable semis within 15% of 52-week highs";
  const typed = query.slice(0, Math.max(0, Math.floor((screenF - 96) / 1.25)));
  const nl = toWin(sh(0), f, L["nl-input"].x, L["nl-input"].y);
  const prov = toWin(sh(0), f, L.provCell.x + 860, L.provCell.y);
  const provOn = ease(f, CH.screen[0] + 40, CH.screen[0] + 52) * (1 - ease(f, CH.screen[0] + 84, CH.screen[0] + 94));
  // match count rolls on scr-chips
  const roll = ease(f, CH.screen[0] + 170, CH.screen[0] + 215, 0, 1, EASE_IN);
  const n0 = parseInt(L.countBefore.replace(/,/g, ""), 10);
  const n1 = parseInt(L.countAfter.replace(/,/g, ""), 10);
  const shown = Math.round(lerp(n0, n1, roll)).toLocaleString("en-US");
  const cnt = toWin(sh(1), f, L.count.x, L.count.y);
  // client/desk split wipe
  const modesF = f - CH.modes[0];
  const wipe = ease(modesF, 30, 120);

  const tearShot = SHOTS.find((x) => x.from === CH.tear[0])!;
  const rowNv = toWin(tearShot, f, L.provCell.x + 40, L.provCell.y);
  // cursor path in window space
  const cur = (() => {
    const pts = [
      { f: CH.screen[0] + 20, x: 900, y: 600 },
      { f: CH.screen[0] + 40, x: prov.x + 30, y: prov.y + 14 },
      { f: CH.screen[0] + 88, x: prov.x + 30, y: prov.y + 14 },
      { f: CH.screen[0] + 96, x: nl.x + 60, y: nl.y + 18 },
      { f: CH.screen[0] + 146, x: nl.x + 60, y: nl.y + 18 },
      { f: CH.tear[0] + 4, x: 900, y: 600 },
      { f: CH.tear[0] + 40, x: rowNv.x + 60, y: rowNv.y + 8 },
      { f: CH.tear[0] + 62, x: rowNv.x + 60, y: rowNv.y + 8 },
      { f: CH.watch[0] + 60, x: 980, y: 140 },
      { f: CH.watch[0] + 120, x: 1060, y: 120 },
    ];
    let a = pts[0];
    let b = pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++)
      if (f >= pts[i].f && f <= pts[i + 1].f) {
        a = pts[i];
        b = pts[i + 1];
        break;
      }
    const t = a.f === b.f ? 1 : ease(f, a.f, b.f);
    const vis = (f > CH.screen[0] + 14 && f < CH.screen[0] + 160) || (f > CH.tear[0] + 4 && f < CH.tear[0] + 66) || (f > CH.watch[0] + 50 && f < CH.watch[0] + 180) ? 1 : 0;
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), vis };
  })();
  const pressF = f - (CH.screen[0] + 146);
  const pressT = f - (CH.tear[0] + 52);
  const press = pressF >= 0 && pressF < 10 ? pressF / 10 : pressT >= 0 && pressT < 10 ? pressT / 10 : 0;

  return (
    <AbsoluteFill style={{ perspective: 2200 }}>
      <div
        style={{
          position: "absolute",
          left: P.x - WIN_W / 2,
          top: P.y - WIN_H / 2,
          width: WIN_W,
          height: WIN_H,
          transform: `scale(${P.s}) rotateY(${P.ry}deg) rotateX(${P.rx}deg)`,
          transformStyle: "preserve-3d",
          opacity: born * (1 - dying) * (1 - ease(f, CH.nums[0] - 6, CH.nums[0] + 8) + ease(f, CH.nums[1] - 4, CH.nums[1] + 14)),
        }}
      >
        {/* reflection on the floor */}
        <div style={{ position: "absolute", left: 40, right: 40, top: WIN_H + 18, height: 160, background: "radial-gradient(50% 60% at 50% 0%, rgba(201,164,92,0.10), transparent)", filter: "blur(10px)" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            overflow: "hidden",
            background: T.bg0,
            boxShadow: "0 70px 160px -40px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,164,92,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {layers.map((l) => (
            <PageLayer key={l.s.from} s={l.s} f={f} opacity={l.op} blur={l.blur} />
          ))}

          {/* typed NL query (real input on the real page) */}
          {f >= CH.screen[0] + 96 && f < CH.screen[0] + 160 && (
            <div style={{ position: "absolute", left: nl.x + 10 * nl.k, top: nl.y, height: 40 * nl.k, display: "flex", alignItems: "center", fontFamily: T.font, fontSize: 14 * nl.k, color: T.ink, background: T.bg1, paddingRight: 6 }}>
              {typed}
              <span style={{ width: 1.5, height: 18 * nl.k, background: Math.floor(f / 8) % 2 ? T.ink : "transparent", marginLeft: 1 }} />
            </div>
          )}

          {/* provenance tooltip: real data-source / as-of / formula of that cell */}
          {provOn > 0 && (
            <div style={{ position: "absolute", left: prov.x + 40, top: prov.y + 30, opacity: provOn, transform: `translateY(${(1 - provOn) * 8}px)`, background: T.bg2, border: `1px solid ${T.gold}`, borderRadius: 10, padding: "12px 16px", fontFamily: T.font, color: T.ink, fontSize: 17, lineHeight: 1.5, boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7)", maxWidth: 520 }}>
              {L.prov.title.split("\n").map((ln) => {
                const [k, ...v] = ln.split(": ");
                return (
                  <div key={k}>
                    <span style={{ color: T.ink2 }}>{k}</span> {v.join(": ")}
                  </div>
                );
              })}
            </div>
          )}

          {/* chips lift out, then the match count rolls */}
          <Lift s={sh(1)} f={f} img="cap2/chips.png" box={L.chips} at={CH.screen[0] + 160} hold={50} />
          {f >= CH.screen[0] + 165 && f < CH.look[0] && (
            <div style={{ position: "absolute", left: cnt.x - 8, top: cnt.y - 6 * cnt.k, padding: "2px 10px", background: T.bg0, borderRadius: 6, fontFamily: T.font, fontSize: 15 * cnt.k, color: T.ink2 }}>
              <b style={{ color: T.gold, fontSize: 17 * cnt.k }}>{shown}</b> matches
            </div>
          )}

          <Lift s={sh(2)} f={f} img="cap2/cmdk-box.png" box={L["cmdk-box"]} at={CH.look[0] + 16} hold={40} />
          <Lift s={sh(3)} f={f} img="cap2/hero.png" box={L.hero} at={CH.look[0] + 120} hold={90} />
          <Lift s={sh(4)} f={f} img="cap2/overlap-card.png" box={L["overlap-card"]} at={CH.look[0] + 300} hold={70} />
          <Lift s={sh(5)} f={f} img="cap2/flag.png" box={L.flag} at={CH.conc[0] + 60} hold={110} />
          {[0, 1, 2].map((i) => (
            <Lift key={i} s={sh(9)} f={f} img={`cap2/wcard-${i}.png`} box={L[`wcard-${i}`]} at={CH.watch[0] + 20 + 26 * i} hold={150 - 26 * i} />
          ))}

          {/* designed integration: share a list with bankers (not built in the prototype) */}
          {(() => {
            const a = ease(f, CH.watch[0] + 120, CH.watch[0] + 141, 0, 1, EASE_IN) * (1 - ease(f, CH.watch[1] - 10, CH.watch[1]));
            if (a <= 0) return null;
            return (
              <div style={{ position: "absolute", right: 34, top: 96, opacity: a, transform: `translateY(${(1 - a) * 10}px)`, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: T.gold, color: "#07111F", fontFamily: T.font, fontWeight: 600, fontSize: 18, boxShadow: "0 16px 40px -12px rgba(201,164,92,0.6)" }}>
                Share with bankers
              </div>
            );
          })()}

          {/* Client / Desk: split wipe between the two real renderings */}
          {f >= CH.modes[0] && f < CH.modes[1] + 4 && (
            <>
              <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - wipe * 100}% 0 0)` }}>
                <PageLayer s={{ from: CH.modes[0], src: "cap2/scr-client.png", cam: [{ f: 0, cx: 800, cy: 500, z: 1 }] }} f={f} opacity={ease(modesF, 0, 14)} blur={0} />
              </div>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wipe * 100}%`, width: 2, background: T.gold, opacity: wipe > 0 && wipe < 1 ? 1 : 0, boxShadow: `0 0 18px ${T.gold}` }} />
              <div style={{ position: "absolute", left: 24, bottom: 20, fontFamily: T.font, fontWeight: 600, fontSize: 22, color: T.gold2, opacity: wipe > 0.05 ? 1 : 0 }}>Client</div>
              <div style={{ position: "absolute", right: 24, bottom: 20, fontFamily: T.font, fontWeight: 600, fontSize: 22, color: T.gold2, opacity: wipe < 0.95 ? 1 : 0 }}>Desk</div>
            </>
          )}

          {(() => {
            const local = f - (CH.tear[0] + 64) - 20;
            if (local < -10 || f > CH.tear[1]) return null;
            const i = Math.max(0, Math.min(DEEP_STOPS.length - 1, Math.floor((local + 6) / STOP)));
            const st = DEEP_STOPS[i];
            const phase = local - i * STOP;
            const a = interpolate(phase, [-6, 4, STOP - 14, STOP - 4], [0, 1, 1, 0], clamp) * (1 - ease(f, CH.tear[1] - 10, CH.tear[1]));
            return (
              <div style={{ position: "absolute", left: 28, bottom: 26, display: "flex", alignItems: "baseline", gap: 14, padding: "12px 20px", borderRadius: 12, background: "rgba(7,17,31,0.88)", border: `1px solid ${T.gold}`, fontFamily: T.font, opacity: a, transform: `translateY(${(1 - a) * 10}px)`, boxShadow: "0 20px 50px -12px rgba(0,0,0,0.7)" }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: T.gold2 }}>{st.name}</span>
                <span style={{ fontSize: 24, color: T.ink }}>{SECTION_NOTE[st.name]}</span>
              </div>
            );
          })()}
          <Cursor x={cur.x} y={cur.y} press={press} opacity={cur.vis} />
          {/* glass highlight on the window face */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.05), transparent 35%)", pointerEvents: "none" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- editorial type, left column
const COPY: { at: number; to: number; label: string; head: string[]; body: string }[] = [
  { at: CH.screen[0] + 30, to: CH.screen[1] - 6, label: "Screen", head: ["Ask in plain words."], body: "Every filter stays visible and editable. Every number shows its source." },
  { at: CH.look[0] + 10, to: CH.look[1] - 6, label: "Look-through", head: ["See every company", "inside every fund."], body: "Who holds a name, how much, and how much two funds overlap." },
  { at: CH.conc[0] + 10, to: CH.conc[1] - 6, label: "Concentration", head: ["Find the exposure", "hiding in a portfolio."], body: "Direct holdings plus everything owned through funds, flagged above a threshold." },
  { at: CH.tear[0] + 10, to: CH.tear[1] - 6, label: "Go inside any name", head: ["Every detail,", "one page."], body: "Click a name: chart, fundamentals, the street, technicals, ownership, peers, news." },
  { at: CH.movers[0] + 10, to: CH.movers[1] - 6, label: "Movers", head: ["The tape,", "liquid names only."], body: "Movers, unusual volume, realized vol. Leveraged products kept apart." },
  { at: CH.watch[0] + 10, to: CH.watch[1] - 6, label: "Watchlists", head: ["Rules pick.", "People approve."], body: "Every list explains itself, ready to share with bankers." },
  { at: CH.modes[0] + 130, to: CH.modes[1] + 2, label: "Client and Desk", head: [], body: "" },
];

const Copy: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily: T.font, pointerEvents: "none" }}>
      {COPY.filter((c) => c.head.length).map((c) => {
        const inA = ease(f, c.at, c.at + 21, 0, 1, EASE_IN);
        const out = ease(f, c.to - 12, c.to);
        const a = inA * (1 - out);
        if (a <= 0) return null;
        return (
          <div key={c.label} style={{ position: "absolute", left: 110, top: 330, width: 500, opacity: a }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: T.gold2, marginBottom: 18, transform: `translateY(${(1 - inA) * 10}px)` }}>{c.label}</div>
            {c.head.map((h, i) => {
              const li = ease(f, c.at + 4 + i * 5, c.at + 25 + i * 5, 0, 1, EASE_IN);
              return (
                <div key={h} style={{ overflow: "hidden" }}>
                  <div style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.12, color: T.ink, letterSpacing: "-0.02em", transform: `translateY(${(1 - li) * 70}px)` }}>{h}</div>
                </div>
              );
            })}
            <div style={{ height: 2, width: 64 * ease(f, c.at + 14, c.at + 40), background: T.gold, margin: "26px 0 22px" }} />
            <div style={{ fontSize: 32, lineHeight: 1.4, color: T.ink2, opacity: ease(f, c.at + 16, c.at + 37) }}>{c.body}</div>
          </div>
        );
      })}
      {/* montage: one label per cut */}
      {f >= CH.montage[0] && f < CH.montage[1] && (() => {
        const i = Math.min(3, Math.floor((f - CH.montage[0]) / 40));
        const names = ["ETF tear sheets", "Hedge finder", "Exposure without the name", "Compare up to eight"];
        const a = ease(f, CH.montage[0], CH.montage[0] + 10);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: 46, textAlign: "center", opacity: a * (1 - ease(f, CH.montage[1] - 8, CH.montage[1])) }}>
            <span style={{ fontSize: 30, color: T.ink2 }}>And more. </span>
            <span style={{ fontSize: 56, fontWeight: 600, color: T.ink }}>{names[i]}</span>
          </div>
        );
      })()}
      {/* modes chapter: centred line under the window */}
      {(() => {
        const a = ease(f, CH.modes[0] + 20, CH.modes[0] + 41, 0, 1, EASE_IN) * (1 - ease(f, CH.modes[1] - 10, CH.modes[1]));
        if (a <= 0) return null;
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", opacity: a }}>
            <span style={{ fontSize: 56, fontWeight: 600, color: T.ink }}>One tool, two depths.</span>
            <span style={{ fontSize: 34, color: T.ink2, marginLeft: 18 }}>Plain for clients. Dense for the desk.</span>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- labels (neutral by default)
export type Labels = {
  platform: string; // hub core, e.g. the screening platform's name
  forPlatform: string; // line under the launch wordmark
  missingPiece: string; // hub headline
  tagline: string; // lockup line
  disclosureTail: string;
  modules: [string, string, string]; // bonds, structured products, portfolios
};
export const PUBLIC_LABELS: Labels = {
  platform: "Screening platform",
  forPlatform: "for the screening platform",
  missingPiece: "The missing piece of the platform.",
  tagline: "See what you own.",
  disclosureTail: "Integrations shown are planned. Prototype for internal review.",
  modules: ["Bonds", "Structured products", "Portfolios"],
};
const LabelCtx = createContext<Labels>(PUBLIC_LABELS);
const useLabels = () => useContext(LabelCtx);

// ---------------------------------------------------------------- platform hub
// three modules on an arc above the core; the new module seats below it
const LINKS = [
  { link: "Same shell, sign-on and entitlements", a: -150 },
  { link: "Cross-asset screens", a: -30 },
  { link: "Client holdings in, look-through out", a: -90 },
];
const R = 470;

const Hub: React.FC = () => {
  const f = useCurrentFrame();
  const lb = useLabels();
  const MODULES = LINKS.map((l, i) => ({ ...l, name: lb.modules[i] }));
  const inOpen = f >= CH.hub[0] && f < CH.screen[0] + 12;
  const inClose = f >= CH.close[0] && f < CH.lockup[0] + 12;
  if (!inOpen && !inClose) return null;
  const base = inOpen ? CH.hub[0] : CH.close[0];
  const g = f - base;
  const fadeOut = inOpen ? ease(f, CH.screen[0] - 6, CH.screen[0] + 10) : ease(f, CH.lockup[0] - 8, CH.lockup[0] + 10);
  const core = ease(g, 0, 21, 0, 1, EASE_IN);
  const slot = inOpen ? ease(g, 90, 112, 0, 1, EASE_IN) : 1; // Equities & ETFs tile seats on the beat
  const seam = inOpen ? interpolate(g, [112, 116, 140], [0, 1, 0], clamp) : 0;
  const links = inClose ? ease(g, 40, 100) : 0;
  const cx = 960;
  const cy = inOpen ? 570 : 600; // leave room above the arc for the headline
  return (
    <AbsoluteFill style={{ fontFamily: T.font, opacity: 1 - fadeOut }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {MODULES.map((m, i) => {
          const ang = (m.a * Math.PI) / 180;
          const x = cx + Math.cos(ang) * R;
          const y = cy + Math.sin(ang) * R * 0.62;
          const d = ease(g, 10 + i * 6, 40 + i * 6);
          return <line key={m.name} x1={cx} y1={cy} x2={lerp(cx, x, d)} y2={lerp(cy, y, d)} stroke={inClose ? T.gold : T.line} strokeWidth={inClose ? 2 : 1.5} strokeDasharray={inClose ? `${links * 600} 600` : undefined} />;
        })}
      </svg>
      {/* core: the platform */}
      <div style={{ position: "absolute", left: cx - 210, top: cy - 70, width: 420, height: 140, borderRadius: 18, border: `1px solid ${T.line}`, background: `linear-gradient(180deg, ${T.bg2}, ${T.bg1})`, opacity: core, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)" }}>
        <div style={{ fontSize: 24, color: T.ink2 }}>Safra</div>
        <div style={{ fontSize: 40, fontWeight: 600, color: T.ink }}>{lb.platform}</div>
      </div>
      {MODULES.map((m, i) => {
        const ang = (m.a * Math.PI) / 180;
        const x = cx + Math.cos(ang) * R;
        const y = cy + Math.sin(ang) * R * 0.62;
        const a = ease(g, 20 + i * 8, 41 + i * 8, 0, 1, EASE_IN);
        return (
          <div key={m.name} style={{ position: "absolute", left: x - 230, top: y - 50, width: 460, height: 100, borderRadius: 14, background: T.bg1, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: T.ink }}>{m.name}</div>
            {inClose && <div style={{ fontSize: 26, color: T.gold2, opacity: links, marginTop: 2 }}>{m.link}</div>}
          </div>
        );
      })}
      {/* the new module: Equities & ETFs */}
      <div
        style={{
          position: "absolute",
          left: cx - 190,
          top: (inOpen ? cy + 210 : cy + 200) - (1 - slot) * 260,
          width: 380,
          height: 96,
          borderRadius: 16,
          background: `linear-gradient(160deg, rgba(201,164,92,0.18), rgba(201,164,92,0.02)), ${T.bg1}`,
          border: `1.5px solid ${T.gold}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: slot,
          boxShadow: `0 0 0 ${seam * 6}px rgba(230,204,143,${0.35 * seam}), 0 30px 80px -30px rgba(201,164,92,0.5)`,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, color: T.gold2 }}>Equities &amp; ETFs</div>
      </div>
      {/* hub copy */}
      {inOpen && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 86, textAlign: "center", opacity: ease(g, 100, 121, 0, 1, EASE_IN) * (1 - ease(f, CH.screen[0] - 10, CH.screen[0])) }}>
          <div style={{ fontSize: 60, fontWeight: 600, color: T.ink, letterSpacing: "-0.02em" }}>{lb.missingPiece}</div>
        </div>
      )}
      {inClose && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 86, textAlign: "center", opacity: ease(g, 60, 81, 0, 1, EASE_IN) }}>
          <div style={{ fontSize: 60, fontWeight: 600, color: T.ink, letterSpacing: "-0.02em" }}>Built into the platform bankers already use.</div>
          <div style={{ fontSize: 30, color: T.ink2, marginTop: 10 }}>Connections shown are the designed integration.</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- launch reveal and numbers
const Intro: React.FC = () => {
  const f = useCurrentFrame() - CH.intro[0];
  const lb = useLabels();
  if (f < 0 || f > CH.intro[1] - CH.intro[0] + 8) return null;
  const end = CH.intro[1] - CH.intro[0];
  const out = ease(f, end - 8, end + 8);
  const pre = ease(f, 0, 21, 0, 1, EASE_IN) * (1 - ease(f, 24, 34));
  const word = ease(f, 30, 58, 0, 1, EASE_IN);
  const sheen = ease(f, 52, 92, -0.3, 1.3, EASE_IN);
  const sub = ease(f, 66, 87, 0, 1, EASE_IN);
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: T.font, alignItems: "center", justifyContent: "center", opacity: 1 - out }}>
      <div style={{ position: "absolute", top: 470, fontSize: 44, color: T.ink2, opacity: pre }}>Introducing</div>
      <div style={{ position: "relative", textAlign: "center", transform: `scale(${1.06 - 0.06 * word})` }}>
        <div
          style={{
            fontSize: 168,
            fontWeight: 700,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            clipPath: `inset(${(1 - word) * 100}% 0 0 0)`,
            backgroundImage: `linear-gradient(105deg, ${T.ink} ${sheen * 100 - 12}%, ${T.gold2} ${sheen * 100}%, ${T.ink} ${sheen * 100 + 12}%)`,
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          Equities &amp; ETFs
        </div>
        <div style={{ marginTop: 26, fontSize: 48, fontWeight: 500, color: T.gold2, opacity: sub, transform: `translateY(${(1 - sub) * 12}px)` }}>{lb.forPlatform}</div>
      </div>
    </AbsoluteFill>
  );
};

const Roll: React.FC<{ value: string; t: number; size: number }> = ({ value, t, size }) => (
  <div style={{ display: "flex", justifyContent: "center", fontSize: size, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: T.ink }}>
    {value.split("").map((ch, i) => {
      if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
      const d = Number(ch);
      // each digit spins one full turn plus its value, landing left to right
      const local = Math.min(1, Math.max(0, t * 1.4 - i * 0.08));
      const pos = local * (10 + d);
      return (
        <span key={i} style={{ display: "inline-block", height: size, overflow: "hidden", width: "0.62em" }}>
          <span style={{ display: "block", transform: `translateY(${-(pos % 10) * size}px)` }}>
            {Array.from({ length: 11 }, (_, k) => (
              <span key={k} style={{ display: "block", height: size }}>{k % 10}</span>
            ))}
          </span>
        </span>
      );
    })}
  </div>
);

const Numbers: React.FC = () => {
  const f = useCurrentFrame() - CH.nums[0];
  const len = CH.nums[1] - CH.nums[0];
  if (f < -8 || f > len + 8) return null;
  const meta = (L as unknown as { meta: Record<string, number> }).meta;
  const stats = [
    { v: meta.stocks, label: "US-listed stocks, screened in place" },
    { v: meta.funds, label: "ETFs and funds, leveraged products kept apart" },
    { v: meta.issuers, label: "companies traced inside the funds that hold them" },
  ];
  const bg = ease(f, -8, 6) * (1 - ease(f, len - 8, len + 8));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 60% at 50% 50%, #0F2238, ${T.bg0})`, opacity: bg, fontFamily: T.font }}>
      {stats.map((st, i) => {
        const at = i * 66; // last figure holds ~2.5 s
        const t = ease(f, at, at + 30, 0, 1, EASE_IN);
        const out = i < 2 ? ease(f, at + 58, at + 68) : 0;
        const a = ease(f, at, at + 10) * (1 - out);
        if (a <= 0) return null;
        return (
          <AbsoluteFill key={i} style={{ alignItems: "center", justifyContent: "center", opacity: a, transform: `translateY(${-out * 60}px)` }}>
            <Roll value={st.v.toLocaleString("en-US")} t={t} size={250} />
            <div style={{ marginTop: 28, fontSize: 48, color: T.ink2, opacity: ease(f, at + 18, at + 39) }}>{st.label}</div>
            {i === 2 && <div style={{ marginTop: 40, fontSize: 34, color: T.gold2, opacity: ease(f, at + 40, at + 61) }}>Refreshed every hour of the trading session.</div>}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- open, backdrop, lockup
const OpenSupers: React.FC = () => {
  const f = useCurrentFrame();
  const s = (from: number, to: number, text: string) => {
    const a = ease(f, from, from + 21, 0, 1, EASE_IN) * (1 - ease(f, to - 12, to));
    return a > 0 ? (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 120, textAlign: "center", fontFamily: T.font, fontWeight: 600, fontSize: 60, color: T.ink, opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>{text}</div>
    ) : null;
  };
  return (
    <AbsoluteFill>
      {s(bf(1), bf(5.5), "You think you own one fund.")}
      {s(bf(7), bf(11.6), "You own hundreds of companies.")}
    </AbsoluteFill>
  );
};

const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const a = ease(f, CH.hub[0] - 10, CH.hub[0] + 20);
  return (
    <AbsoluteFill style={{ opacity: a, background: `radial-gradient(70% 70% at 62% 45%, #0F2238, ${T.bg0} 70%)` }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(230,204,143,0.07) 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(60% 60% at 60% 50%, black, transparent)", transform: `translateX(${-f * 0.05}px)` }} />
    </AbsoluteFill>
  );
};

const LockupEnd: React.FC = () => {
  const f = useCurrentFrame() - CH.lockup[0];
  const lb = useLabels();
  if (f < -10) return null;
  const rule = ease(f, 6, 42, 0, 1, EASE_IN);
  const mark = ease(f, 24, 45, 0, 1, EASE_IN);
  const sub = ease(f, 40, 61, 0, 1, EASE_IN);
  const disc = ease(f, 70, 91, 0, 1, EASE_IN);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(80% 70% at 50% 40%, ${T.bg1}, ${T.bg0})`, fontFamily: T.font, opacity: ease(f, -10, 6) }}>
      <div style={{ position: "absolute", left: 960 - 420 * rule, top: 600, width: 840 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${T.gold} 18%, ${T.gold2} 50%, ${T.gold} 82%, transparent)` }} />
      <div style={{ position: "absolute", top: 380, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 34, opacity: mark, transform: `translateY(${(1 - mark) * 10}px)` }}>
        <div style={{ width: 96, height: 96, borderRadius: 18, border: `3px solid ${T.gold}`, position: "relative" }}>
          <div style={{ position: "absolute", inset: 20, borderRadius: 6, background: "linear-gradient(135deg, rgba(201,164,92,0.6), rgba(201,164,92,0.06))" }} />
        </div>
        <div>
          <div style={{ fontSize: 112, fontWeight: 700, color: T.ink, letterSpacing: "-0.03em", lineHeight: 1 }}>Safra</div>
          <div style={{ fontSize: 48, fontWeight: 500, color: T.ink2, marginTop: 10, opacity: sub }}>Equities &amp; ETF Screener</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 640, left: 0, right: 0, textAlign: "center", fontSize: 40, fontWeight: 500, color: T.gold2, opacity: sub }}>
        {lb.tagline}
      </div>
      <div style={{ position: "absolute", bottom: 54, left: 160, right: 160, textAlign: "center", fontSize: 26, lineHeight: 1.45, color: T.ink2, opacity: disc }}>
        Investing involves risk, including loss of principal. Not a recommendation. Tickers shown are illustrative.
        <br />
        Data shown is a delayed snapshot (TradingView, Yahoo Finance, SSGA holdings). {lb.disclosureTail}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- sound
const SFX: { from: number; src: string; volume: number; dur?: number }[] = [
  { from: bf(6) - 4, src: "sfx/glass-plate-slide.mp3", volume: 0.45 },
  { from: bf(6) + 18, src: "sfx/shimmer-sparkle-sweep.mp3", volume: 0.3, dur: 80 },
  { from: CH.intro[0] + 26, src: "sfx/impact-deep-whoosh.mp3", volume: 0.4, dur: 60 }, // wordmark reveal
  { from: CH.intro[0] + 52, src: "sfx/sparkle-touch.mp3", volume: 0.25, dur: 40 }, // sheen
  ...[0, 1, 2].map((i) => ({ from: CH.nums[0] + i * 66 + 28, src: "sfx/bass-hit-short.mp3", volume: 0.42 - 0.04 * i })), // numbers land
  ...[1, 2, 3].map((i) => ({ from: CH.montage[0] + i * 40 - 2, src: "sfx/air-woosh-quick.mp3", volume: 0.16, dur: 20 })), // montage cuts
  { from: CH.hub[0] + 90, src: "sfx/air-woosh-quick.mp3", volume: 0.3 },
  { from: CH.hub[0] + 112, src: "sfx/bass-hit-short.mp3", volume: 0.42 }, // tile seats
  { from: CH.screen[0] - 4, src: "sfx/air-woosh-deep.mp3", volume: 0.3, dur: 50 }, // window born from tile
  ...Array.from({ length: 8 }, (_, i) => ({ from: CH.screen[0] + 98 + i * 6, src: "sfx/typewriter-hit-soft.mp3", volume: 0.3 - 0.02 * i, dur: 10 })),
  { from: CH.screen[0] + 160, src: "sfx/sparkle-touch.mp3", volume: 0.25, dur: 40 }, // chips lift
  { from: CH.look[0], src: "sfx/air-woosh-quick.mp3", volume: 0.24 },
  { from: CH.look[0] + 120, src: "sfx/impact-deep-whoosh.mp3", volume: 0.3, dur: 50 }, // hero card lifts
  { from: CH.look[0] + 300, src: "sfx/air-woosh-quick.mp3", volume: 0.2 },
  { from: CH.conc[0] + 60, src: "sfx/bass-hit-short.mp3", volume: 0.3 }, // concentration flag
  { from: CH.tear[0] + 52, src: "sfx/air-woosh-quick.mp3", volume: 0.26 }, // click into NVDA
  ...Array.from({ length: 8 }, (_, i) => ({ from: CH.tear[0] + 64 + 20 + (i + 1) * 44 - 6, src: "sfx/air-woosh-quick.mp3", volume: 0.1, dur: 20 })), // section glides
  { from: CH.movers[0], src: "sfx/air-woosh-quick.mp3", volume: 0.22 },
  ...[0, 1, 2].map((i) => ({ from: CH.watch[0] + 20 + 26 * i, src: "sfx/bass-hit-short.mp3", volume: 0.26 - 0.03 * i })),
  { from: CH.modes[0] + 30, src: "sfx/air-woosh-deep.mp3", volume: 0.24, dur: 60 }, // split wipe
  { from: CH.close[0] + 20, src: "sfx/air-woosh-deep.mp3", volume: 0.28, dur: 50 }, // window folds into tile
  { from: CH.close[0] + 40, src: "sfx/shimmer-sparkle-sweep.mp3", volume: 0.22, dur: 70 }, // links draw
  { from: CH.lockup[0] - 50, src: "sfx/light-transition-magic.mp3", volume: 0.3, dur: 120 },
  { from: CH.lockup[0] + 24, src: "sfx/bass-hit-short.mp3", volume: 0.5 }, // lockup (peak)
  { from: CH.lockup[0] + 34, src: "sfx/sparkle-touch.mp3", volume: 0.3 },
];

const FONT_CSS = [400, 500, 600, 700]
  .map((w) => `@font-face{font-family:"Hanken Grotesk";font-weight:${w};src:url(${staticFile(`fonts/hanken-${w}.woff2`)}) format("woff2");}`)
  .join("");

export const Showcase: React.FC<{ bgm: boolean; labels?: Partial<Labels> }> = ({ bgm, labels }) => {
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px "Hanken Grotesk"`))).then(() => continueRender(h));
  }, [h]);
  return (
    <LabelCtx.Provider value={{ ...PUBLIC_LABELS, ...labels }}>
    <AbsoluteFill style={{ background: "#000" }}>
      <style>{FONT_CSS}</style>
      <Sequence from={0} durationInFrames={CH.open[1] + 6}>
        <AbsoluteFill style={{ opacity: 1 }}>
          <GlassCard />
        </AbsoluteFill>
      </Sequence>
      <OpenSupers />
      <Backdrop />
      <Intro />
      <Hub />
      <AppWindow />
      <Copy />
      <Numbers />
      <LockupEnd />
      {bgm && <Audio src={staticFile("audio/score-showcase.wav")} volume={(f) => interpolate(f, [0, 4, DURATION - 30, DURATION], [0, 0.9, 0.9, 0.8], { extrapolateRight: "clamp" })} />}
      {SFX.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur ?? bf(8)}>
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
    </LabelCtx.Provider>
  );
};
