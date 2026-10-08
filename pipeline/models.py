"""Typed rows written to the snapshot. Optional everywhere: a missing value stays None."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel

F = Optional[float]


class StockRow(BaseModel):
    symbol: str
    ticker: str
    name: Optional[str]
    exchange: Optional[str]
    subtype: Optional[str]
    typespecs: List[str]
    country: Optional[str]
    sector: Optional[str]
    industry: Optional[str]
    close: F
    change: F
    pre_change: F
    post_change: F
    volume: F
    rel_volume: F
    adv: F
    market_cap: F
    float_shares: F
    beta: F
    atr_pct: F
    tv_vol_m: F
    rv20: F
    rv60: F
    pe: F
    ps: F
    ev_sales: F
    fwd_pe: F
    gross_margin: F
    op_margin: F
    fcf: F
    net_debt: F
    revenue: F
    roe: F
    div_yield: F
    perf_1w: F
    perf_1m: F
    perf_3m: F
    perf_ytd: F
    perf_1y: F
    high_52w: F
    low_52w: F
    from_high: F
    from_low: F
    sma50: F
    sma200: F
    rsi: F
    next_earnings: Optional[int]
    pt_avg: F
    pt_high: F
    pt_low: F
    ratings: List[Optional[int]]
    eps_next_fq: F
    rev_next_fq: F
    eps_next_fy: F
    spark: Optional[List[float]]


class FundRow(BaseModel):
    symbol: str
    ticker: str
    name: Optional[str]
    exchange: Optional[str]
    typespecs: List[str]
    close: F
    change: F
    volume: F
    rel_volume: F
    adv: F
    aum: F
    expense_ratio: F
    nav: F
    premium: F
    index_tracked: Optional[str]
    asset_class: Optional[str]
    focus: Optional[str]
    div_yield: F
    perf_1m: F
    perf_ytd: F
    perf_1y: F
    high_52w: F
    low_52w: F
    from_high: F
    tv_vol_m: F
    rv20: F
    rv60: F
    spark: Optional[List[float]]
    leveraged: bool
    leverage_factor: F
    flags: List[str]


class HoldingLine(BaseModel):
    name: str
    ticker: Optional[str]
    cusip: Optional[str]
    sedol: Optional[str]
    weight: float
    shares: F
    currency: Optional[str]
    asset_type: str
    is_derivative: bool
    symbol: Optional[str]
    issuer: str
    market_value: F


class Meta(BaseModel):
    generated_at: str
    sources: Dict[str, Dict[str, Any]]
    counts: Dict[str, int]
    warnings: List[str]
