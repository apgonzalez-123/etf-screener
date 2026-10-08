// Section 9 tokens, identical to web/src/styles.css
export const T = {
  bg0: "#07111F",
  bg1: "#0C1B2E",
  bg2: "#13263F",
  line: "#1F3352",
  ink: "#F2F4F8",
  ink2: "#9AA8BD",
  gold: "#C9A45C",
  gold2: "#E6CC8F",
  up: "#3DBE8B",
  down: "#E5675B",
  font: "Hanken Grotesk, system-ui, sans-serif",
};

// Professional-trust motion voice: ~21 f entrances, no overshoot.
import { Easing } from "remotion";
export const EASE_IN = Easing.bezier(0, 0, 0.2, 1);
export const EASE_CAM = Easing.bezier(0.33, 0, 0.15, 1);
export const ENTER = 21;

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
