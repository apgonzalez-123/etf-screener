// Single source of truth for timing. 90 BPM at 30 fps = 20 frames per beat,
// so every boundary is beatF(n) and lands on the score's grid.
export const FPS = 30;
export const BEAT = 20;
export const beatF = (n: number) => Math.round(n * BEAT);

export const SHOTS = {
  card: { from: beatF(0), to: beatF(6) },        // 0–4 s   opaque fund card, still
  glass: { from: beatF(6), to: beatF(15) },      // 4–10 s  card turns to glass, holdings rise
  search: { from: beatF(15), to: beatF(19) },    // 10–12.7 s  type NVDA in the real app
  hero: { from: beatF(19), to: beatF(24) },      // "Held by 7 ETFs" card, spotlight push
  holders: { from: beatF(24), to: beatF(27) },   // ranked holders table
  exposure: { from: beatF(27), to: beatF(30) },  // portfolio: direct vs funds split
  scrub: { from: beatF(30), to: beatF(35) },     // 20–23.3 s chart scrub
  movers: { from: beatF(35), to: beatF(40) },    // movers board
  vol: { from: beatF(40), to: beatF(45) },       // RV column lights up
  watch: { from: beatF(45), to: beatF(63) },     // 30–42 s rules-built watchlists drop in
  atmos: { from: beatF(63), to: beatF(78) },     // 42–52 s glass and light
  lockup: { from: beatF(78), to: beatF(90) },    // 52–60 s gold rule, lockup, disclosure
} as const;

export const DURATION = beatF(90); // 1800 f = 60 s

export const SUPERS: { from: number; to: number; lines: string[] }[] = [
  { from: beatF(1), to: beatF(5.5), lines: ["You think you own one fund."] },
  { from: beatF(8.5), to: beatF(14.5), lines: ["You own hundreds of companies."] },
  { from: beatF(16), to: beatF(29.5), lines: ["Now you can see every one of them,", "in every fund you hold."] },
  { from: beatF(30.5), to: beatF(34.6), lines: ["Markets, screened."] },
  { from: beatF(35.5), to: beatF(39.6), lines: ["The names moving the tape."] },
  { from: beatF(40.5), to: beatF(44.6), lines: ["The volatility behind them."] },
  { from: beatF(53), to: beatF(62.5), lines: ["Every name picked by a rule you can read.", "Reviewed by people who know your portfolio."] },
  { from: beatF(65), to: beatF(77), lines: ["Built inside a private bank.", "For the way you invest."] },
];
