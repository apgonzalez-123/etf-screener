# "See through" launch film

A 60-second, 16:9 film for the Equities & ETF Screener. Every UI shot is a real capture of the app in `../web` against one frozen data snapshot, so every figure on screen is real and consistent across shots.

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
- **Realized vol instead of IV/RV.** There is no options feed, so the column that lights up is realized vol.
- **Music.** `scripts/score.py` synthesizes an original 90 BPM piano + sub pulse + strings cue, so no licence is needed. Replace it with a licensed or commissioned track before release; the no-music render is there for that.
- **One cut only.** The 30 s, 15 s, 6 s, 1:1, 9:16, long-form and PT-BR versions are not made yet.

## Credits

Sound effects from the video-shotcraft library (Mixkit licence; see `public/sfx/ATTRIBUTION.md`). Built with Remotion; check [Remotion's licence](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) for company use.

Before any external use, the film needs compliance review of communications with the public, plus brand and rights sign-off.
