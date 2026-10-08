"""Network sources. Each function returns raw-but-typed data plus nothing invented.

- TradingView scanner: the same backend the TradingView MCP's run_screener and
  get_symbol_data use. Screens, quotes-at-snapshot, fundamentals, estimates.
- Yahoo chart API: daily OHLCV for realized vol, sparklines and tear-sheet charts.
- TradingView headlines: last headlines per symbol.
- SSGA daily holdings files: ETF look-through (TradingView has no holdings).
"""
from __future__ import annotations

import io
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .registry import FUND_COLUMNS, HISTORY_COLUMNS, STOCK_COLUMNS, validate

UA = {"User-Agent": "Mozilla/5.0 (Macintosh) etf-screener-snapshot/1.0"}
SCANNER = "https://scanner.tradingview.com/america/scan"


def _http(url: str, data: Optional[bytes] = None, headers: Optional[dict] = None, retries: int = 3) -> bytes:
    h = dict(UA)
    if headers:
        h.update(headers)
    last: Exception = RuntimeError("unreachable")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def scan(columns: List[str], registry: Dict[str, tuple], filters: List[dict], sort_by: str,
         limit: int = 10000, tickers: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    validate(columns, registry)
    body: Dict[str, Any] = {"columns": columns, "range": [0, limit],
                            "sort": {"sortBy": sort_by, "sortOrder": "desc"}}
    if tickers:
        body = {"columns": columns, "symbols": {"tickers": tickers}}
    else:
        body["filter"] = filters
    raw = json.loads(_http(SCANNER, json.dumps(body).encode(), {"Content-Type": "application/json"}))
    out = []
    for row in raw.get("data", []):
        rec = {"symbol": row["s"]}
        rec.update(dict(zip(columns, row["d"])))
        out.append(rec)
    return out


def scan_stocks() -> List[Dict[str, Any]]:
    cols = list(STOCK_COLUMNS)
    return scan(cols, STOCK_COLUMNS, [
        {"left": "type", "operation": "equal", "right": "stock"},
        # Preferreds inherit the parent's market cap and EPS in the feed, which makes their
        # multiples meaningless (GOOGM shows a 2.5x P/E). Out of scope for this module.
        {"left": "subtype", "operation": "not_in_range", "right": ["preferred"]},
        {"left": "exchange", "operation": "in_range", "right": ["NYSE", "NASDAQ", "AMEX", "CBOE"]},
        {"left": "close", "operation": "greater", "right": 1},
        {"left": "market_cap_basic", "operation": "greater", "right": 1e8},
    ], "market_cap_basic")


def scan_history(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
    cols = list(HISTORY_COLUMNS)
    out: Dict[str, Dict[str, Any]] = {}
    for i in range(0, len(tickers), 400):
        for rec in scan(cols, HISTORY_COLUMNS, [], "", tickers=tickers[i:i + 400]):
            out[rec.pop("symbol")] = rec
    return out


def scan_funds() -> List[Dict[str, Any]]:
    cols = list(FUND_COLUMNS)
    return scan(cols, FUND_COLUMNS, [
        {"left": "type", "operation": "equal", "right": "fund"},
        {"left": "exchange", "operation": "in_range", "right": ["NYSE", "NASDAQ", "AMEX", "CBOE"]},
        {"left": "aum", "operation": "greater", "right": 2e7},
    ], "aum")


def yahoo_symbol(tv_symbol: str) -> str:
    return tv_symbol.split(":", 1)[1].replace(".", "-")


def daily_bars(tv_symbol: str) -> Optional[List[List[float]]]:
    """[[t, o, h, l, c, v], ...] for ~1 year of daily bars, or None."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol(tv_symbol)}?range=1y&interval=1d"
    try:
        res = json.loads(_http(url, retries=2))["chart"]["result"][0]
    except Exception:
        return None
    ts = res.get("timestamp") or []
    q = res["indicators"]["quote"][0]
    bars = []
    for i, t in enumerate(ts):
        o, h, l, c, v = (q[k][i] for k in ("open", "high", "low", "close", "volume"))
        if None in (o, h, l, c):
            continue
        bars.append([t, round(o, 4), round(h, 4), round(l, 4), round(c, 4), v or 0])
    return bars or None


def headlines(tv_symbol: str, n: int = 10) -> List[Dict[str, Any]]:
    url = f"https://news-headlines.tradingview.com/v2/headlines?client=web&lang=en&symbol={tv_symbol}"
    try:
        items = json.loads(_http(url, retries=2)).get("items", [])
    except Exception:
        return []
    return [{"title": it["title"], "source": it.get("source") or it.get("provider"),
             "published": it.get("published"), "url": f"https://www.tradingview.com{it['storyPath']}" if it.get("storyPath") else None}
            for it in items[:n]]


SSGA_URL = "https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-{t}.xlsx"
SSGA_FUNDS = ["spy", "dia", "sptm", "spym", "spyg", "spyv", "mdy", "spmd", "spsm", "xlk", "xlf", "xle", "xlv",
              "xli", "xly", "xlp", "xlu", "xlb", "xlre", "xlc", "sdy", "kre", "kbe", "xbi", "xme", "xop", "xar",
              "xsd", "xhb", "xtl", "xsw"]

CASH = re.compile(r"\b(US DOLLAR|MONEY MARKET|CASH|TREASURY BILL)\b", re.I)
FUTURE = re.compile(r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}\b|\bFUT\b|\bSWAP\b", re.I)


def ssga_holdings(ticker: str) -> Optional[Dict[str, Any]]:
    import openpyxl  # local import: only the holdings step needs it

    try:
        blob = _http(SSGA_URL.format(t=ticker.lower()))
    except Exception:
        return None
    ws = openpyxl.load_workbook(io.BytesIO(blob), read_only=True, data_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    as_of = None
    header_idx = None
    for i, r in enumerate(rows[:12]):
        if r and r[0] == "Holdings:" and r[1]:
            as_of = datetime.strptime(str(r[1]).replace("As of ", "").strip(), "%d-%b-%Y").date().isoformat()
        if r and r[0] == "Name" and r[1] == "Ticker":
            header_idx = i
    if header_idx is None or as_of is None:
        return None
    lines = []
    for r in rows[header_idx + 1:]:
        if not r or r[0] is None or r[4] is None:
            break
        name, tick, ident, sedol, weight, sector, shares, ccy = r[:8]
        is_cash = bool(CASH.search(str(name)))
        is_deriv = bool(FUTURE.search(str(name)))
        lines.append({
            "name": str(name).strip(),
            "ticker": None if tick in (None, "-") else str(tick).strip(),
            "cusip": None if ident in (None, "-") else str(ident),
            "sedol": None if sedol in (None, "-") else str(sedol),
            "weight": float(weight) / 100,
            "shares": float(shares) if shares not in (None, "-") else None,
            "currency": ccy,
            "asset_type": "cash" if is_cash else ("derivative" if is_deriv else "equity"),
            "is_derivative": is_deriv,
        })
    return {"etf": ticker.upper(), "as_of": as_of, "source": "SSGA daily holdings file",
            "source_url": SSGA_URL.format(t=ticker.lower()), "lines": lines}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
