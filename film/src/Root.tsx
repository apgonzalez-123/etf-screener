import { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Composition, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { GlassCard } from "./scenes/GlassCard";
import { Atmos, Lockup } from "./scenes/Closing";
import { Exposure, Hero, Holders, Movers, Scrub, Search, Vol, Watch } from "./scenes/UI";
import { DURATION, FPS, SHOTS, SUPERS, beatF } from "./timeline";
import { EASE_IN, ENTER, T } from "./tokens";

const FONT_CSS = [400, 500, 600, 700]
  .map((w) => `@font-face{font-family:"Hanken Grotesk";font-weight:${w};src:url(${staticFile(`fonts/hanken-${w}.woff2`)}) format("woff2");}`)
  .join("");

function useFonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px "Hanken Grotesk"`))).then(() => continueRender(handle));
  }, [handle]);
}

// SFX pin table: every entry is relative to the shot it belongs to.
export const SFX: { from: number; src: string; volume: number; dur?: number; note: string }[] = [
  { from: SHOTS.glass.from - 4, src: "sfx/glass-plate-slide.mp3", volume: 0.45, note: "card turns to glass" },
  { from: SHOTS.glass.from + 18, src: "sfx/shimmer-sparkle-sweep.mp3", volume: 0.3, note: "holdings rise as light" },
  { from: SHOTS.search.from - 6, src: "sfx/air-woosh-quick.mp3", volume: 0.35, note: "cut into the real app" },
  // one soft key per typed letter, matching Search's (f - 14) / 7 cadence
  ...[0, 1, 2, 3].map((i) => ({ from: SHOTS.search.from + 14 + 7 * i, src: "sfx/typewriter-hit-soft.mp3", volume: 0.42 - 0.04 * i, dur: 12, note: `key ${"NVDA"[i]}` })),
  { from: SHOTS.hero.from, src: "sfx/impact-deep-whoosh.mp3", volume: 0.32, dur: 50, note: "hero card revealed" },
  { from: SHOTS.holders.from, src: "sfx/air-woosh-quick.mp3", volume: 0.22, note: "pan to holders" },
  { from: SHOTS.exposure.from - 4, src: "sfx/air-woosh-quick.mp3", volume: 0.26, note: "cut to portfolio" },
  { from: SHOTS.scrub.from - 6, src: "sfx/air-woosh-deep.mp3", volume: 0.3, dur: 50, note: "into markets" },
  { from: SHOTS.movers.from - 4, src: "sfx/air-woosh-quick.mp3", volume: 0.22, note: "movers" },
  { from: SHOTS.vol.from + 20, src: "sfx/sparkle-touch.mp3", volume: 0.28, dur: 40, note: "RV column lights" },
  ...[0, 1, 2, 3].map((i) => ({ from: SHOTS.watch.from + 20 * (1 + 2 * i), src: "sfx/bass-hit-short.mp3", volume: 0.3 - 0.03 * i, note: `watchlist card ${i + 1} seats` })),
  { from: SHOTS.atmos.from - 4, src: "sfx/air-woosh-deep.mp3", volume: 0.26, dur: 60, note: "into atmosphere" },
  { from: SHOTS.lockup.from - 50, src: "sfx/light-transition-magic.mp3", volume: 0.3, dur: 120, note: "rise into lockup" },
  { from: SHOTS.lockup.from + 30, src: "sfx/bass-hit-short.mp3", volume: 0.5, note: "lockup lands (peak)" },
  { from: SHOTS.lockup.from + 40, src: "sfx/sparkle-touch.mp3", volume: 0.3, note: "afterglow" },
];

const Super: React.FC<{ lines: string[]; len: number; onUI: boolean }> = ({ lines, len, onUI }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, ENTER, len - 12, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN });
  const y = interpolate(f, [0, ENTER], [14, 0], { extrapolateRight: "clamp", easing: EASE_IN });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      {onUI && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 360, background: "linear-gradient(0deg, rgba(3,8,15,0.92), rgba(3,8,15,0))", opacity: a }} />}
      <div style={{ position: "relative", padding: "0 140px 96px", opacity: a, transform: `translateY(${y}px)`, fontFamily: T.font, fontWeight: 600, fontSize: 60, lineHeight: 1.2, color: T.ink, letterSpacing: "-0.01em" }}>
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const UI_RANGE = [SHOTS.search.from, SHOTS.watch.to];

const Film: React.FC<{ bgm: boolean }> = ({ bgm }) => {
  useFonts();
  const scene = (s: { from: number; to: number }, el: React.ReactNode) => (
    <Sequence from={s.from} durationInFrames={s.to - s.from}>
      {el}
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <style>{FONT_CSS}</style>
      <Sequence from={0} durationInFrames={SHOTS.glass.to}>
        <GlassCard />
      </Sequence>
      {scene(SHOTS.search, <Search />)}
      {scene(SHOTS.hero, <Hero />)}
      {scene(SHOTS.holders, <Holders />)}
      {scene(SHOTS.exposure, <Exposure />)}
      {scene(SHOTS.scrub, <Scrub />)}
      {scene(SHOTS.movers, <Movers />)}
      {scene(SHOTS.vol, <Vol />)}
      {scene(SHOTS.watch, <Watch />)}
      {scene(SHOTS.atmos, <Atmos />)}
      {scene(SHOTS.lockup, <Lockup />)}
      {SUPERS.map((s) => (
        <Sequence key={s.from} from={s.from} durationInFrames={s.to - s.from}>
          <Super lines={s.lines} len={s.to - s.from} onUI={s.from >= UI_RANGE[0] && s.from < UI_RANGE[1]} />
        </Sequence>
      ))}
      {bgm && <Audio src={staticFile("audio/score.wav")} volume={(f) => interpolate(f, [0, 4, DURATION - 30, DURATION], [0, 0.9, 0.9, 0.8], { extrapolateRight: "clamp" })} />}
      {SFX.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur ?? beatF(8)}>
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <Composition id="SeeThrough" component={Film} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
);
