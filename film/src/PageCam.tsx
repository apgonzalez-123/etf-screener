// Adapted from video-shotcraft assets/lib/PageCam.tsx (flat 2.5D pan/zoom over a 2x page texture).
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { EASE_CAM, T } from "./tokens";

export type CamKey = { frame: number; cx: number; cy: number; zoom: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function camAt(keys: CamKey[], frame: number) {
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (frame >= keys[i].frame && frame <= keys[i + 1].frame) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const t = a.frame === b.frame ? 1 : interpolate(frame, [a.frame, b.frame], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_CAM });
  return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), zoom: lerp(a.zoom, b.zoom, t) };
}

export const PageCam: React.FC<{ src: string; pageH?: number; keys: CamKey[]; children?: React.ReactNode; opacity?: number; filter?: string }> = ({
  src,
  pageH = 1080,
  keys,
  children,
  opacity = 1,
  filter,
}) => {
  const frame = useCurrentFrame();
  const { cx, cy, zoom } = camAt(keys, frame);
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: T.bg0, opacity }}>
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: pageH,
          // CSS zoom (layout-level) keeps text sharp from the 2x texture; see aesthetic rule Q2.
          zoom,
          transform: `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px)`,
          filter,
        }}
      >
        <Img src={staticFile(src)} style={{ position: "absolute", width: 1920, height: pageH }} />
        {children}
      </div>
    </AbsoluteFill>
  );
};
