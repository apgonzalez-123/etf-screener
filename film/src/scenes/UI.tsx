import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import layout from "../../public/cap/layout.json";
import { PageCam } from "../PageCam";
import { BEAT, SHOTS } from "../timeline";
import { EASE_CAM, EASE_IN, T } from "../tokens";

const L = layout as unknown as Record<string, { x: number; y: number; w: number; h: number }>;
const dur = (s: { from: number; to: number }) => s.to - s.from;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Shot 3: the real look-through page; "NVDA" typed into the real input at human speed. */
export const Search: React.FC = () => {
  const f = useCurrentFrame();
  const inp = L.input;
  const text = "NVDA";
  const typed = text.slice(0, Math.max(0, Math.min(4, Math.floor((f - 14) / 7) + 1)));
  const caret = Math.floor(f / 8) % 2 === 0;
  const press = interpolate(f, [dur(SHOTS.search) - 12, dur(SHOTS.search) - 6, dur(SHOTS.search)], [1, 0.96, 1], clamp);
  return (
    <PageCam
      src="cap/look-empty.png"
      keys={[
        { frame: 0, cx: inp.x + 330, cy: inp.y + 40, zoom: 2.0 },
        { frame: dur(SHOTS.search), cx: inp.x + 420, cy: inp.y + 60, zoom: 1.8 },
      ]}
    >
      <div style={{ position: "absolute", left: inp.x + 11, top: inp.y, height: inp.h, display: "flex", alignItems: "center", fontFamily: T.font, fontSize: 16, color: T.ink }}>
        {typed}
        <span style={{ width: 1.5, height: 20, marginLeft: 1, background: caret && typed.length < 4 ? T.ink : "transparent" }} />
      </div>
      {/* the button press on the last beat */}
      <div style={{ position: "absolute", left: inp.x + 210, top: inp.y, width: 109, height: 40, borderRadius: 6, transform: `scale(${press})`, boxShadow: press < 1 ? `0 0 0 2px ${T.gold2}` : undefined }} />
    </PageCam>
  );
};

/** Shot 4: the hero card. Spotlight on the one element, slow push, hold to read. */
export const Hero: React.FC = () => {
  const f = useCurrentFrame();
  const h = L.hero;
  const d = dur(SHOTS.hero);
  const dim = interpolate(f, [8, 8 + 30], [0, 0.62], { ...clamp, easing: EASE_IN });
  const fadeIn = interpolate(f, [0, 8], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <PageCam
        src="cap/look-nvda.png"
        keys={[
          { frame: 0, cx: 640, cy: 320, zoom: 1.6 },
          { frame: 40, cx: h.x + h.w / 2, cy: h.y + h.h / 2, zoom: 1.28 },
          { frame: d, cx: h.x + h.w / 2 - 30, cy: h.y + h.h / 2, zoom: 1.34 },
        ]}
      >
        {/* spotlight: darken everything but the card */}
        <div style={{ position: "absolute", inset: 0, background: `rgba(3,8,15,${dim})`, clipPath: `polygon(0 0, 1920px 0, 1920px 1080px, 0 1080px, 0 ${h.y}px, ${h.x}px ${h.y}px, ${h.x}px ${h.y + h.h}px, ${h.x + h.w}px ${h.y + h.h}px, ${h.x + h.w}px ${h.y}px, 0 ${h.y}px)` }} />
      </PageCam>
    </AbsoluteFill>
  );
};

/** Shot 5: pan to the ranked holders table (still the real page). */
export const Holders: React.FC = () => {
  const h = L.hero;
  const t = L.holders;
  return (
    <PageCam
      src="cap/look-nvda.png"
      keys={[
        { frame: 0, cx: h.x + h.w / 2 - 30, cy: h.y + h.h / 2, zoom: 1.34 },
        { frame: 36, cx: t.x + t.w / 2, cy: t.y + 190, zoom: 1.22 },
        { frame: dur(SHOTS.holders), cx: t.x + t.w / 2, cy: t.y + 200, zoom: 1.24 },
      ]}
    />
  );
};

/** Shot 6: portfolio look-through, NVDA row: direct vs. through funds. */
export const Exposure: React.FC = () => {
  const f = useCurrentFrame();
  const r = L["nvda-row"];
  const glow = interpolate(f, [BEAT, BEAT + 21], [0, 1], { ...clamp, easing: EASE_IN });
  return (
    <PageCam
      src="cap/portfolio.png"
      keys={[
        { frame: 0, cx: r.x + r.w / 2 - 40, cy: r.y - 20, zoom: 1.18 },
        { frame: dur(SHOTS.exposure), cx: r.x + r.w / 2, cy: r.y - 10, zoom: 1.3 },
      ]}
    >
      <div style={{ position: "absolute", left: r.x - 6, top: r.y - 3, width: r.w + 12, height: r.h + 6, borderRadius: 6, boxShadow: `0 0 0 1.5px rgba(201,164,92,${glow})` }} />
    </PageCam>
  );
};

/** Shot 7: real crosshair scrub across the NVDA chart; header price follows (48 captured frames). */
export const Scrub: React.FC = () => {
  const f = useCurrentFrame();
  const n = (layout as unknown as { scrubFrames: number }).scrubFrames;
  const i = Math.round(interpolate(f, [10, dur(SHOTS.scrub) - 14], [0, n - 1], { ...clamp, easing: EASE_CAM }));
  const z = interpolate(f, [0, dur(SHOTS.scrub)], [1.14, 1.22], clamp);
  return (
    <AbsoluteFill style={{ background: T.bg0, alignItems: "center", justifyContent: "center" }}>
      <Img src={staticFile(`cap/scrub/${String(i).padStart(2, "0")}.png`)} style={{ width: 1704 * z, height: 560 * z, marginTop: -40 }} />
    </AbsoluteFill>
  );
};

/** Shot 8: movers board, slow descending pan. */
export const Movers: React.FC = () => (
  <PageCam
    src="cap/movers.png"
    keys={[
      { frame: 0, cx: 1000, cy: 420, zoom: 1.3 },
      { frame: dur(SHOTS.movers), cx: 1010, cy: 640, zoom: 1.22 },
    ]}
  />
);

/** Shot 9: screener grid; the realized-vol columns light up on the beat. */
export const Vol: React.FC = () => {
  const f = useCurrentFrame();
  const head = L["rv20-head"];
  const g = L.grid;
  const on = interpolate(f, [BEAT, BEAT + 21], [0, 1], { ...clamp, easing: EASE_IN });
  return (
    <PageCam
      src="cap/screener.png"
      keys={[
        { frame: 0, cx: 900, cy: 600, zoom: 1.25 },
        { frame: dur(SHOTS.vol), cx: head.x + 80, cy: 640, zoom: 1.5 },
      ]}
    >
      <div
        style={{
          position: "absolute",
          left: head.x,
          top: head.y,
          width: head.w * 2,
          height: g.y + g.h - head.y,
          borderRadius: 6,
          background: `linear-gradient(180deg, rgba(201,164,92,${0.16 * on}), rgba(201,164,92,${0.05 * on}))`,
          boxShadow: `inset 0 0 0 1.5px rgba(201,164,92,${0.8 * on})`,
        }}
      />
    </PageCam>
  );
};

/** Shots 10 (30–42 s): rules-built watchlist cards drop from above, flatten, and seat into the list. */
export const Watch: React.FC = () => {
  const f = useCurrentFrame();
  const cards = [0, 1, 2, 3].map((i) => L[`watch-${i}`]).filter(Boolean);
  const top0 = cards[0].y;
  const bg = interpolate(f, [0, 20], [0, 1], clamp);
  const push = interpolate(f, [0, dur(SHOTS.watch)], [1.0, 1.04], clamp);
  const S = 1.22; // cards read at ~1.2x their on-screen size (aesthetic rule Q11)
  return (
    <AbsoluteFill style={{ background: T.bg0, opacity: bg }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, perspective: 1400 }}>
        {cards.map((c, i) => {
          const land = BEAT * (1 + 2 * i); // one card per two beats
          const p = interpolate(f, [land - 16, land], [0, 1], { ...clamp, easing: EASE_IN });
          const seam = interpolate(f, [land, land + 4, land + 22], [0, 1, 0], clamp);
          const y = 40 + (c.y - top0) * S;
          return (
            <div key={i} style={{ position: "absolute", left: 960 - (c.w * S) / 2, top: y - (1 - p) * 120, width: c.w * S, height: c.h * S, opacity: p, transform: `rotateX(${(1 - p) * 28}deg)`, transformOrigin: "50% 100%" }}>
              <Img src={staticFile(`cap/watch-${i}.png`)} style={{ width: "100%", height: "100%", borderRadius: 10 }} />
              <div style={{ position: "absolute", left: 12, right: 12, bottom: -1, height: 2, borderRadius: 2, background: T.gold, opacity: seam }} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
