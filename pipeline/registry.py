"""Column registry.

The scanner returns null for unknown column names, silently. Every column the
app requests must be listed here; `validate()` rejects anything else, and the
smoke test (tests/test_live_contract.py) fails if a registered column stops
returning data for its reference symbol.
"""
from __future__ import annotations

from typing import Dict, List

# column -> (label, unit, reference symbol that must return non-null)
STOCK_COLUMNS: Dict[str, tuple] = {
    "name": ("Ticker", "text", "NASDAQ:NVDA"),
    "description": ("Name", "text", "NASDAQ:NVDA"),
    "exchange": ("Exchange", "text", "NASDAQ:NVDA"),
    "type": ("Type", "text", "NASDAQ:NVDA"),
    "subtype": ("Subtype", "text", "NASDAQ:NVDA"),
    "typespecs": ("Type specs", "list", "NASDAQ:NVDA"),
    "is_primary": ("Primary listing", "bool", "NASDAQ:NVDA"),
    "country": ("Country", "text", "NASDAQ:NVDA"),
    "close": ("Price", "usd", "NASDAQ:NVDA"),
    "change": ("Change %", "pct", "NASDAQ:NVDA"),
    "premarket_change": ("Pre-market %", "pct", None),
    "postmarket_change": ("Post-market %", "pct", None),
    "volume": ("Volume", "shares", "NASDAQ:NVDA"),
    "relative_volume_10d_calc": ("Rel. volume", "x", "NASDAQ:NVDA"),
    "average_volume_30d_calc": ("Avg volume 30d", "shares", "NASDAQ:NVDA"),
    "market_cap_basic": ("Market cap", "usd", "NASDAQ:NVDA"),
    "float_shares_outstanding": ("Float", "shares", "NASDAQ:NVDA"),
    "Volatility.D": ("TV volatility D", "pct", "NASDAQ:NVDA"),
    "Volatility.M": ("TV volatility M", "pct", "NASDAQ:NVDA"),
    "beta_1_year": ("Beta 1y", "x", "NASDAQ:NVDA"),
    "ATR": ("ATR 14", "usd", "NASDAQ:NVDA"),
    "sector": ("Sector", "text", "NASDAQ:NVDA"),
    "industry": ("Industry", "text", "NASDAQ:NVDA"),
    "earnings_release_next_date": ("Next earnings", "unix", None),
    "price_earnings_ttm": ("P/E TTM", "x", "NASDAQ:NVDA"),
    "price_sales_current": ("P/S", "x", "NASDAQ:NVDA"),
    "enterprise_value_to_revenue_ttm": ("EV/Sales", "x", "NASDAQ:NVDA"),
    "earnings_per_share_forecast_next_fy": ("EPS est. next FY", "usd", "NASDAQ:NVDA"),
    "gross_margin": ("Gross margin", "pct", "NASDAQ:NVDA"),
    "operating_margin": ("Operating margin", "pct", "NASDAQ:NVDA"),
    "free_cash_flow_ttm": ("FCF TTM", "usd", "NASDAQ:NVDA"),
    "net_debt": ("Net debt", "usd", "NASDAQ:NVDA"),
    "total_revenue_ttm": ("Revenue TTM", "usd", "NASDAQ:NVDA"),
    "return_on_equity": ("ROE", "pct", "NASDAQ:NVDA"),
    "dividends_yield_current": ("Dividend yield", "pct", "NASDAQ:NVDA"),
    "Perf.W": ("1W %", "pct", "NASDAQ:NVDA"),
    "Perf.1M": ("1M %", "pct", "NASDAQ:NVDA"),
    "Perf.3M": ("3M %", "pct", "NASDAQ:NVDA"),
    "Perf.YTD": ("YTD %", "pct", "NASDAQ:NVDA"),
    "Perf.Y": ("1Y %", "pct", "NASDAQ:NVDA"),
    "price_52_week_high": ("52w high", "usd", "NASDAQ:NVDA"),
    "price_52_week_low": ("52w low", "usd", "NASDAQ:NVDA"),
    "SMA50": ("SMA 50", "usd", "NASDAQ:NVDA"),
    "SMA200": ("SMA 200", "usd", "NASDAQ:NVDA"),
    "RSI": ("RSI 14", "x", "NASDAQ:NVDA"),
    "price_target_average": ("PT avg", "usd", "NASDAQ:NVDA"),
    "price_target_high": ("PT high", "usd", "NASDAQ:NVDA"),
    "price_target_low": ("PT low", "usd", "NASDAQ:NVDA"),
    "recommendation_buy": ("Buy ratings", "count", "NASDAQ:NVDA"),
    "recommendation_over": ("Outperform ratings", "count", "NASDAQ:NVDA"),
    "recommendation_hold": ("Hold ratings", "count", "NASDAQ:NVDA"),
    "recommendation_under": ("Underperform ratings", "count", "NASDAQ:NVDA"),
    "recommendation_sell": ("Sell ratings", "count", "NASDAQ:NVDA"),
    "earnings_per_share_forecast_next_fq": ("EPS est. next FQ", "usd", "NASDAQ:NVDA"),
    "revenue_forecast_next_fq": ("Revenue est. next FQ", "usd", "NASDAQ:NVDA"),
}

# Quarterly history arrays (most recent first) — tear-sheet detail only.
HISTORY_COLUMNS: Dict[str, tuple] = {
    "total_revenue_fq_h": ("Revenue", "usd", "NASDAQ:NVDA"),
    "gross_profit_fq_h": ("Gross profit", "usd", "NASDAQ:NVDA"),
    "net_income_fq_h": ("Net income", "usd", "NASDAQ:NVDA"),
    "ebitda_fq_h": ("EBITDA", "usd", "NASDAQ:NVDA"),
    "free_cash_flow_fq_h": ("Free cash flow", "usd", "NASDAQ:NVDA"),
    "earnings_per_share_diluted_fq_h": ("EPS diluted", "usd", "NASDAQ:NVDA"),
    "total_debt_fq_h": ("Total debt", "usd", "NASDAQ:NVDA"),
}

FUND_COLUMNS: Dict[str, tuple] = {
    "name": ("Ticker", "text", "AMEX:SPY"),
    "description": ("Name", "text", "AMEX:SPY"),
    "exchange": ("Exchange", "text", "AMEX:SPY"),
    "typespecs": ("Type specs", "list", "AMEX:SPY"),
    "close": ("Price", "usd", "AMEX:SPY"),
    "change": ("Change %", "pct", "AMEX:SPY"),
    "volume": ("Volume", "shares", "AMEX:SPY"),
    "relative_volume_10d_calc": ("Rel. volume", "x", "AMEX:SPY"),
    "average_volume_30d_calc": ("Avg volume 30d", "shares", "AMEX:SPY"),
    "aum": ("AUM", "usd", "AMEX:SPY"),
    "expense_ratio": ("Expense ratio", "pct", "AMEX:SPY"),
    "nav": ("NAV", "usd", "AMEX:SPY"),
    "nav_discount_premium": ("Premium/discount", "pct", None),
    "index_tracked": ("Index", "text", "AMEX:SPY"),
    "asset_class": ("Asset class", "code", "AMEX:SPY"),
    "focus": ("Focus", "code", "AMEX:SPY"),
    "dividends_yield": ("Distribution yield", "pct", "AMEX:SPY"),
    "Perf.1M": ("1M %", "pct", "AMEX:SPY"),
    "Perf.YTD": ("YTD %", "pct", "AMEX:SPY"),
    "Perf.Y": ("1Y %", "pct", "AMEX:SPY"),
    "price_52_week_high": ("52w high", "usd", "AMEX:SPY"),
    "price_52_week_low": ("52w low", "usd", "AMEX:SPY"),
    "Volatility.M": ("TV volatility M", "pct", "AMEX:SPY"),
}

# Confirmed non-columns. Requesting them is a bug.
FORBIDDEN = {"short_interest", "holdings_count", "fund_flows_1m", "dividend_yield_recent"}


class UnknownColumnError(ValueError):
    pass


def validate(columns: List[str], registry: Dict[str, tuple]) -> List[str]:
    bad = [c for c in columns if c not in registry or c in FORBIDDEN]
    if bad:
        raise UnknownColumnError(f"columns not in registry: {bad}")
    return columns
