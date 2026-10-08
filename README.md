# Safra Equities & ETF Screener

A working prototype of an Equities & ETF screening module: screen US-listed stocks and ETFs, see the single-name exposure hidden inside ETFs, read a one-page tear sheet for any name, and track the names moving the tape. Every number shows its source and as-of time on hover, and a missing value is shown as "—", never estimated.

**Live site:** https://apgonzalez-123.github.io/etf-screener/ · **Launch film:** [download from the film-v1 release](https://github.com/apgonzalez-123/etf-screener/releases/tag/film-v1)

> Prototype for internal review. Not approved for client use. See [Compliance](#compliance) before sharing it outside the team.

## What's in it

| Module | Built here | Not yet |
|---|---|---|
| §4 Screener engine | Filter chips with AND/OR, typed plain-English queries turned into editable filters (deterministic parser, AI off), 10 presets, universe gates as chips (locked in Client mode), virtualized grid over ~4,000 stocks or ~4,200 funds, multi-sort, column picker, CSV export, shareable screen links, versioned saved screens, compare up to 8 | Nested sub-groups, XLSX export, alerts on enter/leave, order and options hand-off |
| §5 ETF look-through | Who holds a name (holders, weight, drift-adjusted weight, $ held, % of float, exposure per fee), exposure without the name, overlap, portfolio look-through with concentration flags and an overlap matrix, hedge finder by 60-day correlation; share classes rolled up with line detail | Holdings beyond State Street SPDR (31 ETFs); vendor, N-PORT and OpenFIGI ingestion; country and style breakdowns |
| §6 Tear sheets | Stock: scrubbable chart, snapshot strip, 8-quarter fundamentals, street view, technicals, ETF ownership, peers with correlation, headlines. ETF: AUM, fees, NAV premium, holdings, sector look-through, effective N, most similar funds, leverage flag | Options panel (no options feed), EPS beat history, intraday chart ranges |
| §7 Movers board | Top movers, unusual volume, high realized vol, earnings this week, breakouts, leveraged ETFs kept apart | IV rich/cheap (needs options feed), event-study base rates |
| §8 Watchlists | Rules-generated thematic, event, exposure and volatility lists with templated reasons, blocked-phrase lint, AI flag off | AI narratives, review queue, audit store |
| §9 Design | Navy and gold tokens, dark and light themes, Client and Desk modes, ⌘K search, skeleton loaders, sign and arrow on every change, mobile layout | Digit-roll motion on live ticks (no live feed) |

## How the data works

`pipeline/` (typed Python, pydantic) builds a static snapshot that the web app reads. The GitHub Actions workflow reruns it hourly through the US session and redeploys.

| Data | Source | Notes |
|---|---|---|
| Screens, quotes at snapshot time, fundamentals, estimates | TradingView scanner (the backend the TradingView MCP uses) | Every column is checked against `pipeline/registry.py`; CI fails if a registered column stops returning data |
| Daily bars (realized vol, sparklines, charts, correlation) | Yahoo Finance chart API | ~1 year, ~4,700 symbols |
| ETF holdings | State Street SPDR daily holdings files | 31 ETFs; dated per file |
| Headlines | TradingView headlines | Top 250 stocks and 60 funds |

The prompt's traps are handled in code: unknown columns are rejected by the registry; opaque `asset_class`/`focus` codes go through a mapping table and never render raw; realized vol is computed from bars, not TradingView's `Volatility.*`; OTC and sub-$5 names are gated out; leveraged and inverse funds are classified and kept apart; preferreds are excluded because the feed gives them the parent's market cap and EPS; an expense ratio outside 0–5% (IVV reports 10) is withheld and flagged.

## Run it locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pipeline.snapshot          # ~2 min; writes web/public/data
cd web && npm ci && npm run dev                 # http://localhost:5173
```

Tests:

```bash
.venv/bin/python -m pytest -q pipeline/tests    # calc, classifier, live data contract (SKIP_LIVE=1 offline)
cd web && npx vitest run                        # formatting, NL parser, look-through maths
npm run build && npx playwright test            # acceptance tests from the build brief
```

## Launch film

`film/` holds the "See through" launch film: a Remotion project cut from real Playwright captures of this app. See [`film/README.md`](film/README.md).

## Compliance

Nothing here is for client use until each sign-off has a named approver. In particular: market-data display rights for the sources above are not confirmed for client use; SSGA holdings files are © State Street and their terms restrict redistribution; the film needs compliance review as a communication with the public. Charts use TradingView Lightweight Charts™ (Apache-2.0).
