from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field


Operator = Literal[">", "<", ">=", "<=", "==", "crosses_above", "crosses_below"]
Indicator = Literal["close", "open", "high", "low", "volume", "sma", "ema", "rsi"]


class IndicatorRef(BaseModel):
    indicator: Indicator
    params: dict[str, Any] = Field(default_factory=dict)


class StrategyCondition(BaseModel):
    indicator: Indicator
    operator: Operator
    params: dict[str, Any] = Field(default_factory=dict)
    value: float | None = None
    compare_to: IndicatorRef | None = None


class StrategyRules(BaseModel):
    type: str = "technical_strategy"
    side: Literal["long", "short", "neutral"] = "long"
    timeframe: str = "1m"
    tickers: list[str]
    conditions: list[StrategyCondition]
    risk: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


class StrategyCreate(BaseModel):
    name: str
    tickers: list[str]
    timeframe: str = "1m"
    rules: StrategyRules
    confidence: float | None = None


class StrategyOut(BaseModel):
    id: UUID
    name: str
    tickers: list[str]
    timeframe: str
    rules: dict[str, Any]
    status: str
    confidence: float | None


class MarketBar(BaseModel):
    ticker: str
    timeframe: str = "1m"
    ts: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None
