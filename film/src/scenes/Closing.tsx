import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SHOTS } from "../timeline";
import { EASE_CAM, EASE_IN, T } from "../tokens";
import { GlassCard } from "./GlassCard";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Shot 11 (42–52 s). No generative video in this build, so the atmosphere is built from
 * the product itself: real captures as deep, defocused layers behind the glass card,
 * sliding at three speeds under a slow push.
 */
export const Atmos: React.FC = () => {
  const f = useCurrentFrame();
  const d = SHOTS.atmos.to - SHOTS.atmos.from;
  const t = interpolate(f, [0, d], [0, 1], { ...clamp, easing: EASE_CAM });
  const fade = interpolate(f, [0, 24, d - 20, d], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: T.bg0, opacity: fade, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${-60 * t}px) scale(1.35)`, filter: "blur(14px) saturate(0.7)", opacity: 0.35 }}>
        <Img src={staticFile("cap/tear-xlk.png")} style={{ width: 1920, height: 1080 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${120 - 220 * t}px) translateY(80px) rotate(-4deg) scale(1.05)`, filter: "blur(5px)", opacity: 0.4 }}>
        <Img src={staticFile("cap/screener.png")} style={{ width: 1920, height: 1080 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(60% 60% at 50% 45%, rgba(7,17,31,0.1), rgba(7,17,31,0.85))" }} />
      <AbsoluteFill style={{ transform: `translateX(${260 - 120 * t}px) translateY(-60px) scale(${1 + 0.08 * t})` }}>
        <GlassCard mode="atmos" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Shot 12 (52–60 s). Navy field, a gold rule draws across, lockup, disclosure. Holds ≥ 1 s (rule R1). */
export const Lockup: React.FC = () => {
  const f = useCurrentFrame();
  const rule = interpolate(f, [6, 6 + 36], [0, 1], { ...clamp, easing: EASE_IN });
  const mark = interpolate(f, [30, 30 + 21], [0, 1], { ...clamp, easing: EASE_IN });
  const word = interpolate(f, [40, 40 + 21], [0, 1], { ...clamp, easing: EASE_IN });
  const sub = interpolate(f, [52, 52 + 21], [0, 1], { ...clamp, easing: EASE_IN });
  const disc = interpolate(f, [90, 90 + 21], [0, 1], { ...clamp, easing: EASE_IN });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(80% 70% at 50% 40%, ${T.bg1}, ${T.bg0})`, fontFamily: T.font }}>
      <div style={{ position: "absolute", left: 960 - 420 * rule, top: 600, width: 840 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${T.gold} 18%, ${T.gold2} 50%, ${T.gold} 82%, transparent)` }} />
      <div style={{ position: "absolute", top: 380, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 34 }}>
        <div style={{ width: 96, height: 96, borderRadius: 18, border: `3px solid ${T.gold}`, position: "relative", opacity: mark, transform: `translateY(${(1 - mark) * 10}px)` }}>
          <div style={{ position: "absolute", inset: 20, borderRadius: 6, background: "linear-gradient(135deg, rgba(201,164,92,0.6), rgba(201,164,92,0.06))" }} />
        </div>
        <div style={{ opacity: word, transform: `translateY(${(1 - word) * 10}px)` }}>
          <div style={{ fontSize: 112, fontWeight: 700, color: T.ink, letterSpacing: "-0.03em", lineHeight: 1 }}>Safra</div>
          <div style={{ fontSize: 48, fontWeight: 500, color: T.ink2, marginTop: 10, opacity: sub / Math.max(word, 0.001) }}>Equities &amp; ETF Screener</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 640, left: 0, right: 0, textAlign: "center", fontSize: 40, fontWeight: 500, color: T.gold2, opacity: sub }}>
        See what you own.
      </div>
      <div style={{ position: "absolute", bottom: 54, left: 160, right: 160, textAlign: "center", fontSize: 26, lineHeight: 1.45, color: T.ink2, opacity: disc }}>
        Investing involves risk, including loss of principal. Not a recommendation. Tickers shown are illustrative.
        <br />
        Data shown is a delayed snapshot (TradingView, Yahoo Finance, SSGA holdings). Prototype for internal review.
      </div>
    </AbsoluteFill>
  );
};

export { EASE_IN };
