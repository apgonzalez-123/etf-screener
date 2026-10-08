"""Builds the static data snapshot the web app reads.

    python -m pipeline.snapshot [--out web/public/data] [--quick]

Writes:
  meta.json            sources, as-of times, coverage, registry warnings
  stocks.json          gated-or-relaxable US stock universe with computed columns
  funds.json           US-listed funds (AUM >= $20M) with mapped labels and leverage flags
  bars/<TICKER>.json   ~1y daily OHLCV
  detail/<TICKER>.json quarterly history + headlines
  holdings/index.json  issuer -> [(etf, weight, drift-adjusted weight, lines)]
  holdings/<ETF>.json  look-through lines
"""
from __future__ import annotations

import argparse
import json
import math
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import calc, classify, sources
from .models import FundRow, HoldingLine, Meta, StockRow

ROOT = Path(__file__).resolve().parent.parent
STOCK_BAR_ADV = 5e6   # fetch bars for stocks with >= $5M ADV (default gate is $10M)
FUND_BAR_ADV = 2e6
NEWS_STOCKS = 250
NEWS_FUNDS = 60


def rnd(x: Any, n: int = 4) -> Any:
    if isinstance(x, float):
        if math.isnan(x) or math.isinf(x):
            return None
        return round(x, n)
    return x


def ticker(sym: str) -> str:
    return sym.split(":", 1)[1]


def issuer_key(description: str) -> str:
    d = re.sub(r"\b(Class|Cl|Series)\s+[A-Z]\b.*$", "", description or "", flags=re.I)
    d = re.sub(r"[^A-Za-z0-9 ]", "", d).upper()
    d = re.sub(r"\b(INC|CORP|CORPORATION|CO|LTD|PLC|NV|SA|AG|HOLDINGS|GROUP|THE|NEW|COMPANY)\b", "", d)
    return re.sub(r"\s+", " ", d).strip()


def dump(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), default=str))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "web" / "public" / "data"))
    ap.add_argument("--quick", action="store_true", help="limit network fan-out for local iteration")
    args = ap.parse_args()
    out = Path(args.out)
    warnings: List[str] = []

    # 1. Screens
    t_scan = sources.now_iso()
    raw_stocks = sources.scan_stocks()
    raw_funds = sources.scan_funds()
    print(f"scanner: {len(raw_stocks)} stocks, {len(raw_funds)} funds")

    for cols, rows, kind in ((list(raw_stocks[0]), raw_stocks, "stock"), (list(raw_funds[0]), raw_funds, "fund")):
        for c in cols:
            if c != "symbol" and all(r.get(c) is None for r in rows[:200]):
                warnings.append(f"{kind} column '{c}' returned null for the top 200 rows")

    # 2. Bars (realized vol, sparklines, charts)
    def adv(r: Dict[str, Any]) -> Optional[float]:
        a, c = r.get("average_volume_30d_calc"), r.get("close")
        return a * c if a is not None and c is not None else None

    bar_syms = [r["symbol"] for r in raw_stocks if (adv(r) or 0) >= STOCK_BAR_ADV]
    bar_syms += [r["symbol"] for r in raw_funds if (adv(r) or 0) >= FUND_BAR_ADV]
    if args.quick:
        bar_syms = bar_syms[:150]
    t_bars = sources.now_iso()
    with ThreadPoolExecutor(10) as ex:
        bars = dict(zip(bar_syms, ex.map(sources.daily_bars, bar_syms)))
    got = sum(1 for b in bars.values() if b)
    print(f"bars: {got}/{len(bar_syms)}")
    if got < 0.9 * len(bar_syms):
        warnings.append(f"daily bars missing for {len(bar_syms) - got} of {len(bar_syms)} symbols")
    for sym, b in bars.items():
        if b:
            dump(out / "bars" / f"{ticker(sym)}.json", {"symbol": sym, "source": "Yahoo Finance chart API",
                                                        "as_of": t_bars, "bars": b})

    def computed(sym: str, close: Optional[float]) -> Dict[str, Any]:
        b = bars.get(sym)
        if not b:
            return {"rv20": None, "rv60": None, "spark": None}
        closes = [x[4] for x in b]
        # The snapshot's scanner close is the freshest print; the last bar may lag by minutes.
        return {"rv20": rnd(calc.realized_vol(closes, 20), 2), "rv60": rnd(calc.realized_vol(closes, 60), 2),
                "spark": calc.spark(closes)}

    # 3. Stock rows
    stocks: List[Dict[str, Any]] = []
    for r in raw_stocks:
        c = computed(r["symbol"], r.get("close"))
        a = adv(r)
        row = StockRow(
            symbol=r["symbol"], ticker=ticker(r["symbol"]), name=r.get("description"), exchange=r.get("exchange"),
            subtype=r.get("subtype"), typespecs=r.get("typespecs") or [], country=r.get("country"),
            sector=r.get("sector"), industry=r.get("industry"),
            close=r.get("close"), change=r.get("change"), pre_change=r.get("premarket_change"),
            post_change=r.get("postmarket_change"), volume=r.get("volume"),
            rel_volume=r.get("relative_volume_10d_calc"), adv=a, market_cap=r.get("market_cap_basic"),
            float_shares=r.get("float_shares_outstanding"), beta=r.get("beta_1_year"),
            atr_pct=(r["ATR"] / r["close"] * 100) if r.get("ATR") and r.get("close") else None,
            tv_vol_m=r.get("Volatility.M"), rv20=c["rv20"], rv60=c["rv60"],
            pe=r.get("price_earnings_ttm"), ps=r.get("price_sales_current"),
            ev_sales=r.get("enterprise_value_to_revenue_ttm"),
            fwd_pe=(r["close"] / r["earnings_per_share_forecast_next_fy"])
            if r.get("close") and (r.get("earnings_per_share_forecast_next_fy") or 0) > 0 else None,
            gross_margin=r.get("gross_margin"), op_margin=r.get("operating_margin"),
            fcf=r.get("free_cash_flow_ttm"), net_debt=r.get("net_debt"), revenue=r.get("total_revenue_ttm"),
            roe=r.get("return_on_equity"), div_yield=r.get("dividends_yield_current"),
            perf_1w=r.get("Perf.W"), perf_1m=r.get("Perf.1M"), perf_3m=r.get("Perf.3M"),
            perf_ytd=r.get("Perf.YTD"), perf_1y=r.get("Perf.Y"),
            high_52w=r.get("price_52_week_high"), low_52w=r.get("price_52_week_low"),
            from_high=calc.pct_from(r.get("close"), r.get("price_52_week_high")),
            from_low=calc.pct_from(r.get("close"), r.get("price_52_week_low")),
            sma50=r.get("SMA50"), sma200=r.get("SMA200"), rsi=r.get("RSI"),
            next_earnings=r.get("earnings_release_next_date"),
            pt_avg=r.get("price_target_average"), pt_high=r.get("price_target_high"), pt_low=r.get("price_target_low"),
            ratings=[r.get(k) for k in ("recommendation_buy", "recommendation_over", "recommendation_hold",
                                        "recommendation_under", "recommendation_sell")],
            eps_next_fq=r.get("earnings_per_share_forecast_next_fq"),
            rev_next_fq=r.get("revenue_forecast_next_fq"), eps_next_fy=r.get("earnings_per_share_forecast_next_fy"),
            spark=c["spark"],
        )
        stocks.append({k: rnd(v) for k, v in row.model_dump().items()})

    # 4. Fund rows
    funds: List[Dict[str, Any]] = []
    for r in raw_funds:
        c = computed(r["symbol"], r.get("close"))
        flags: List[str] = []
        er = r.get("expense_ratio")
        if er is not None and not (0 <= er <= 5):
            flags.append(f"expense_ratio {er} failed range check 0–5%; withheld")
            er = None
        lev, factor = classify.leverage(r.get("description") or "")
        row = FundRow(
            symbol=r["symbol"], ticker=ticker(r["symbol"]), name=r.get("description"), exchange=r.get("exchange"),
            typespecs=r.get("typespecs") or [], close=r.get("close"), change=r.get("change"),
            volume=r.get("volume"), rel_volume=r.get("relative_volume_10d_calc"), adv=adv(r), aum=r.get("aum"),
            expense_ratio=er, nav=r.get("nav"), premium=r.get("nav_discount_premium"),
            index_tracked=r.get("index_tracked"), asset_class=classify.asset_class(r.get("asset_class")),
            focus=classify.focus(r.get("focus")), div_yield=r.get("dividends_yield"),
            perf_1m=r.get("Perf.1M"), perf_ytd=r.get("Perf.YTD"), perf_1y=r.get("Perf.Y"),
            high_52w=r.get("price_52_week_high"), low_52w=r.get("price_52_week_low"),
            from_high=calc.pct_from(r.get("close"), r.get("price_52_week_high")),
            tv_vol_m=r.get("Volatility.M"), rv20=c["rv20"], rv60=c["rv60"], spark=c["spark"],
            leveraged=lev, leverage_factor=factor, flags=flags,
        )
        funds.append({k: rnd(v) for k, v in row.model_dump().items()})
    print(f"leveraged/inverse funds: {sum(1 for f in funds if f['leveraged'])}")

    # 5. Holdings look-through
    t_hold = sources.now_iso()
    by_ticker = {s["ticker"]: s for s in stocks}
    fund_by_ticker = {f["ticker"]: f for f in funds}
    etf_list = sources.SSGA_FUNDS[:6] if args.quick else sources.SSGA_FUNDS
    with ThreadPoolExecutor(6) as ex:
        parsed = [h for h in ex.map(sources.ssga_holdings, etf_list) if h]
    print(f"holdings: {len(parsed)}/{len(etf_list)} ETFs")
    if len(parsed) < len(etf_list):
        warnings.append(f"holdings files missing for {len(etf_list) - len(parsed)} ETFs")

    index: Dict[str, Dict[str, Any]] = {}
    etf_meta = []
    for h in parsed:
        f = fund_by_ticker.get(h["etf"])
        aum = f["aum"] if f else None
        # drift: price change from the holdings as-of close to the latest close
        asof_ts = datetime.fromisoformat(h["as_of"]).replace(tzinfo=timezone.utc).timestamp() + 86400
        rets: Dict[str, float] = {}
        lines = []
        for ln in h["lines"]:
            s = by_ticker.get(ln["ticker"] or "")
            key = issuer_key(s["name"]) if s and ln["asset_type"] == "equity" else issuer_key(ln["name"])
            line = HoldingLine(**ln, symbol=s["symbol"] if s else None, issuer=key,
                               market_value=ln["weight"] * aum if aum else None).model_dump()
            b = bars.get(s["symbol"]) if s else None
            if b and ln["asset_type"] == "equity":
                prior = [x for x in b if x[0] < asof_ts]
                if prior and prior[-1][4] > 0:
                    rets[ln["name"]] = b[-1][4] / prior[-1][4] - 1
            lines.append(line)
        physical = {ln["name"]: ln["weight"] for ln in lines if not ln["is_derivative"]}
        drifted = calc.drift_adjust(calc.normalize(physical), rets)
        for ln in lines:
            ln["weight_drift"] = rnd(drifted.get(ln["name"]), 6) if not ln["is_derivative"] else None
            ln["weight"] = rnd(ln["weight"], 6)
            ln["market_value"] = rnd(ln["market_value"], 0)
        eq = [ln for ln in lines if ln["asset_type"] == "equity"]
        top10 = sorted(eq, key=lambda x: -x["weight"])[:10]
        sectors: Dict[str, float] = {}
        for ln in eq:
            s = by_ticker.get(ln["ticker"] or "")
            sec = s["sector"] if s and s.get("sector") else "Unmapped"
            sectors[sec] = sectors.get(sec, 0) + ln["weight"]
        meta = {"etf": h["etf"], "as_of": h["as_of"], "source": h["source"], "source_url": h["source_url"],
                "aum": aum, "lines": len(lines), "equity_lines": len(eq),
                "mapped_pct": rnd(sum(ln["weight"] for ln in eq if ln["symbol"]) / max(sum(ln["weight"] for ln in eq), 1e-9), 4),
                "top10_weight": rnd(sum(x["weight"] for x in top10), 4),
                "effective_n": rnd(calc.effective_n([ln["weight"] for ln in eq]), 1),
                "sectors": {k: rnd(v, 4) for k, v in sorted(sectors.items(), key=lambda t: -t[1])},
                "drift_coverage": rnd(len(rets) / max(len(eq), 1), 3)}
        etf_meta.append(meta)
        dump(out / "holdings" / f"{h['etf']}.json", {**meta, "lines": lines})
        for ln in eq:
            ent = index.setdefault(ln["issuer"], {"issuer": ln["issuer"], "name": ln["name"], "symbols": [], "holders": []})
            if ln["symbol"] and ln["symbol"] not in ent["symbols"]:
                ent["symbols"].append(ln["symbol"])
            ent["holders"].append({"etf": h["etf"], "line": ln["ticker"], "weight": ln["weight"],
                                   "weight_drift": ln["weight_drift"], "market_value": ln["market_value"],
                                   "shares": ln["shares"], "as_of": h["as_of"]})
    # roll share classes: holders of the same ETF under one issuer are summed, lines kept
    for ent in index.values():
        merged: Dict[str, Dict[str, Any]] = {}
        for hd in ent["holders"]:
            m = merged.setdefault(hd["etf"], {**hd, "weight": 0.0, "weight_drift": 0.0, "market_value": 0.0,
                                              "shares": 0.0, "lines": []})
            m["weight"] += hd["weight"]
            m["weight_drift"] += hd["weight_drift"] or 0
            m["market_value"] = (m["market_value"] or 0) + (hd["market_value"] or 0) if hd["market_value"] is not None else None
            m["shares"] += hd["shares"] or 0
            m["lines"].append({"line": hd["line"], "weight": hd["weight"]})
        ent["holders"] = sorted(({k: rnd(v, 6) for k, v in m.items()} for m in merged.values()), key=lambda x: -x["weight"])
    dump(out / "holdings" / "index.json", {"as_of_run": t_hold, "etfs": etf_meta, "issuers": index})

    # 6. Tear-sheet detail: quarterly history + headlines
    stock_syms = [s["symbol"] for s in stocks if bars.get(s["symbol"])]
    hist = sources.scan_history(stock_syms)
    news_syms = [s["symbol"] for s in stocks[:NEWS_STOCKS]] + [f["symbol"] for f in funds[:NEWS_FUNDS]]
    if args.quick:
        news_syms = news_syms[:30]
    with ThreadPoolExecutor(8) as ex:
        news = dict(zip(news_syms, ex.map(sources.headlines, news_syms)))
    t_news = sources.now_iso()
    for sym in set(stock_syms) | set(news_syms):
        h = hist.get(sym, {})
        dump(out / "detail" / f"{ticker(sym)}.json", {
            "symbol": sym, "as_of": t_scan, "source": "TradingView scanner",
            "history": {k: [rnd(v) for v in (h.get(k) or [])[:8]] for k in h},
            "news": news.get(sym), "news_as_of": t_news if sym in news else None})

    # 7. Universe files + meta
    for s in stocks:
        s["etf_holders"] = None
        s["top_holder"] = None
    issuer_by_symbol = {}
    for ent in index.values():
        for sym in ent["symbols"]:
            issuer_by_symbol[sym] = ent
    for s in stocks:
        ent = issuer_by_symbol.get(s["symbol"])
        if ent:
            s["etf_holders"] = len(ent["holders"])
            s["top_holder"] = ent["holders"][0]["etf"]

    dump(out / "stocks.json", {"as_of": t_scan, "source": "TradingView scanner", "rows": stocks})
    dump(out / "funds.json", {"as_of": t_scan, "source": "TradingView scanner", "rows": funds})
    meta = Meta(
        generated_at=sources.now_iso(),
        sources={
            "screens": {"name": "TradingView scanner", "as_of": t_scan},
            "bars": {"name": "Yahoo Finance chart API (daily)", "as_of": t_bars},
            "holdings": {"name": "SSGA daily holdings files", "as_of": t_hold,
                         "as_of_dates": sorted({h["as_of"] for h in parsed})},
            "news": {"name": "TradingView headlines", "as_of": t_news},
        },
        counts={"stocks": len(stocks), "funds": len(funds), "bars": got, "holdings_etfs": len(parsed),
                "issuers": len(index)},
        warnings=warnings,
    )
    dump(out / "meta.json", meta.model_dump())
    print("warnings:", *warnings, sep="\n  ") if warnings else print("no warnings")


if __name__ == "__main__":
    main()
