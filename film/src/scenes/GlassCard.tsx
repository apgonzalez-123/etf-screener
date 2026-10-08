import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import spy from "../spy.json";
import { SHOTS } from "../timeline";
import { EASE_CAM, EASE_IN, T, mulberry32 } from "../tokens";

const W = 760;
const H = 460;

type Light = { t: string; w: number; x: number; y0: number; y1: number; delay: number; r: number };

// Deterministic layout of SPY's real holdings: one light per company, sized by weight.
const LIGHTS: Light[] = (() => {
  const rnd = mulberry32(504);
  const rows = spy.holdings as [string, number][];
  return rows.map(([t, w], i) => {
    const big = i < 14;
    return {
      t,
      w,
      x: big ? 70 + ((i * 47) % 620) : 20 + rnd() * (W - 40),
      y0: H + 20 + rnd() * 80,
      y1: big ? 60 + ((i * 89) % 230) : 30 + rnd() * (H - 60),
      delay: big ? i * 2.5 : 10 + rnd() * 70,
      r: Math.max(1.3, Math.sqrt(w) * 30),
    };
  });
})();

/**
 * Shots 1–2 (0–10 s). Black field, one unlabeled gold-edged fund card, perfectly still.
 * On the beat it turns to glass and its 504 holdings rise inside like light.
 * `mode="atmos"` reuses the finished glass card as the front layer of the atmosphere beat.
 */
export const GlassCard: React.FC<{ mode?: "open" | "atmos" }> = ({ mode = "open" }) => {
  const f = useCurrentFrame();
  const turn = SHOTS.glass.from;
  const glassT = mode === "atmos" ? 1 : interpolate(f, [turn, turn + 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });
  const lightT = mode === "atmos" ? 999 : f - (turn + 18);
  // camera: still for the opening 4 s, then a slow push as the card turns
  const scale = mode === "atmos" ? 0.62 : interpolate(f, [0, turn, SHOTS.glass.to], [1, 1, 1.12], { extrapolateRight: "clamp", easing: EASE_CAM });
  const rotY = mode === "atmos" ? -14 : interpolate(f, [turn, SHOTS.glass.to], [0, -6], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_CAM });
  // one sheen across the card at the moment it turns (aesthetic rule Q4: once, clipped to the radius)
  const sheen = interpolate(f, [turn + 4, turn + 40], [-0.4, 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });
  const intro = mode === "atmos" ? 1 : interpolate(f, [0, 24], [0, 1], { extrapolateRight: "clamp", easing: EASE_IN });
  const countIn = interpolate(f, [turn + 110, turn + 131], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });

  return (
    <AbsoluteFill style={{ background: mode === "atmos" ? "transparent" : "#000", alignItems: "center", justifyContent: "center", perspective: 1600 }}>
      <div
        style={{
          width: W,
          height: H,
          position: "relative",
          borderRadius: 22,
          overflow: "hidden",
          opacity: intro,
          transform: `scale(${scale}) rotateY(${rotY}deg)`,
          border: `1.5px solid ${T.gold}`,
          boxShadow: `0 40px 120px -40px rgba(201,164,92,${0.15 + 0.25 * glassT}), inset 0 1px 0 rgba(255,255,255,0.06)`,
          background: `linear-gradient(160deg, rgba(201,164,92,${0.1 * glassT}), rgba(201,164,92,0) 45%), rgba(12,27,46,${1 - 0.86 * glassT})`,
          backdropFilter: "blur(2px)",
        }}
      >
        {/* opaque face: brushed navy, no label */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 1 - glassT,
            background: `repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 2px, rgba(0,0,0,0.02) 2px 4px), linear-gradient(180deg, ${T.bg2}, ${T.bg1})`,
          }}
        />
        {/* holdings rising as light */}
        {LIGHTS.map((l, i) => {
          const p = interpolate(lightT - l.delay, [0, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });
          if (p <= 0) return null;
          const y = l.y0 + (l.y1 - l.y0) * p;
          const big = i < 14;
          return (
            <div key={l.t + i} style={{ position: "absolute", left: l.x, top: y, transform: "translate(-50%,-50%)", opacity: p }}>
              <div
                style={{
                  width: l.r * 2,
                  height: l.r * 2,
                  borderRadius: "50%",
                  background: big ? T.gold2 : T.gold,
                  opacity: big ? 0.9 : 0.55,
                  boxShadow: big ? `0 0 ${l.r * 2.5}px rgba(230,204,143,0.55)` : undefined,
                }}
              />
              {big && (
                <div style={{ position: "absolute", left: l.r * 2 + 8, top: -4, fontFamily: T.font, fontWeight: 600, fontSize: 22, color: T.gold2, whiteSpace: "nowrap" }}>
                  {l.t}
                </div>
              )}
            </div>
          );
        })}
        {/* the single sheen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(105deg, transparent ${sheen * 100 - 18}%, rgba(255,255,255,0.12) ${sheen * 100}%, transparent ${sheen * 100 + 18}%)`,
            opacity: mode === "atmos" ? 0 : 1,
          }}
        />
        {mode === "open" && (
          <div style={{ position: "absolute", left: 28, bottom: 22, opacity: countIn, fontFamily: T.font, color: T.ink2, fontSize: 34, fontWeight: 500 }}>
            <span style={{ color: T.ink, fontWeight: 700 }}>{spy.count}</span> companies inside SPY
            <div style={{ fontSize: 22, marginTop: 4 }}>holdings as of {new Date(spy.as_of + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
