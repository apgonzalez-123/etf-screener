# "See through" launch film

A 60-second, 16:9 film for the Equities & ETF Screener. Rendered files: [film-v1 release](https://github.com/apgonzalez-123/etf-screener/releases/tag/film-v1). Every UI shot is a real capture of the app in `../web` against one frozen data snapshot, so every figure on screen is real and consistent across shots.

```bash
npm ci
npm run capture        # needs the app running: cd ../web && npm run dev
npm run score          # writes public/audio/score.wav (original, synthesized)
npm run render         # out/see-through-60s.mp4
npm run render:nomusic # same cut, sound effects only
npm run studio         # Remotion Studio for frame-by-frame review
```

## Structure (90 BPM, 20 frames per beat; all cuts on the beat grid)

| Time | Picture | Super |
|---|---|---|
| 0–4 s | Black. One unlabeled gold-edged fund card, still. | You think you own one fund. |
| 4–10 s | The card turns to glass; SPY's 504 real holdings rise inside it as light, sized by weight. | You own hundreds of companies. |
| 10–20 s | Real app: type NVDA → "Held by 7 ETFs" card under a spotlight → ranked holders → portfolio exposure split direct vs. funds. | Now you can see every one of them, in every fund you hold. |
| 20–30 s | Real chart scrub (48 captured crosshair positions), movers board, realized-vol columns lighting on the beat. | Markets, screened. / The names moving the tape. / The volatility behind them. |
| 30–42 s | Rules-built watchlist cards drop in and seat, one every two beats. | Every name picked by a rule you can read. Reviewed by people who know your portfolio. |
| 42–52 s | Glass card in front of defocused captures of the product, sliding at three depths. | Built inside a private bank. For the way you invest. |
| 52–60 s | Navy field, gold rule draws, lockup, disclosure. | See what you own. |

## Where this departs from the brief, and why

- **Supers instead of voiceover.** No licensed or consented voice was available, and a synthetic voice would need both. The VO lines are set as on-screen supers (≥ 56 px effective height).
- **No generative video.** No video-generation service was available. The 4–10 s and 42–52 s atmosphere beats are built in Remotion from the brand tokens and real captures instead of city footage.
- **No "AI approved" moment.** The AI layer is off in this build, so showing an AI-curated, banker-approved card would be a fake UI. The 30–42 s beat shows the real rules-generated watchlists instead.
- **Music.** `scripts/score.py` synthesizes an original 90 BPM piano + sub pulse + strings cue, so no licence is needed. Replace it with a licensed or commissioned track before release; the no-music render is there for that.
- **One cut only.** The 30 s, 15 s, 6 s, 1:1, 9:16, long-form and PT-BR versions are not made yet.

## Credits

Sound effects from the video-shotcraft library (Mixkit licence; see `public/sfx/ATTRIBUTION.md`). Built with Remotion; check [Remotion's licence](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) for company use.

Before any external use, the film needs compliance review of communications with the public, plus brand and rights sign-off.

## v2: the showcase cut (1:57)

`src/showcase/` is a longer, launch-style cut. Every UI shot plays inside one continuous app window, and key elements lift off the page as real high-res cutouts. In order:

1. Launch reveal of Equities & ETFs and its place in the wider platform.
2. Plain-English screening, with a provenance tooltip and filter chips.
3. ⌘K look-through and overlap.
4. "By the numbers", with real snapshot counts.
5. Portfolio concentration.
6. A walk through every section of a tear sheet.
7. Movers, watchlists and the Client/Desk modes.
8. A montage of further tools.

```bash
npm run capture:showcase        # needs the app on :5173
npm run score:showcase
npm run render:showcase         # out/showcase-v2.mp4
npm run render:showcase:nomusic
```

Platform and module names are props. The defaults are neutral (`PUBLIC_LABELS` in `Showcase.tsx`). An internal cut with real platform names renders from a local, git-ignored props file:

```bash
npx remotion render src/showcase/index.ts Showcase out/showcase-internal.mp4 --props=src/showcase/internal-props.json
```

The hub's connections to other platform modules are the designed integration, not built features, and the film says so on screen.
