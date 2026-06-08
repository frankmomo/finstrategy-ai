from typing import Any

from .indicators import IndicatorState


def evaluate_strategy(rules: dict[str, Any], state: IndicatorState, ticker: str, timeframe: str) -> dict[str, Any]:
    details: list[dict[str, Any]] = []

    for condition in rules.get("conditions", []):
        left = state.value(ticker, timeframe, condition["indicator"], condition.get("params", {}))
        right = _right_value(condition, state, ticker, timeframe)
        matched = _compare(left, condition["operator"], right)
        details.append(
            {
                "condition": condition,
                "left": left,
                "right": right,
                "matched": matched,
            }
        )

    return {
        "matched": bool(details) and all(item["matched"] for item in details),
        "details": details,
    }


def _right_value(condition: dict[str, Any], state: IndicatorState, ticker: str, timeframe: str):
    compare_to = condition.get("compare_to")
    if compare_to:
        return state.value(ticker, timeframe, compare_to["indicator"], compare_to.get("params", {}))
    value = condition.get("value")
    if value is None:
        return None
    return {"current": float(value), "prev": float(value)}


def _compare(left, operator: str, right) -> bool:
    if left is None or right is None:
        return False

    left_current = left["current"] if isinstance(left, dict) else left
    right_current = right["current"] if isinstance(right, dict) else right

    if operator == ">":
        return left_current > right_current
    if operator == "<":
        return left_current < right_current
    if operator == ">=":
        return left_current >= right_current
    if operator == "<=":
        return left_current <= right_current
    if operator == "==":
        return left_current == right_current
    if operator == "crosses_above":
        return left["prev"] <= right["prev"] and left["current"] > right["current"]
    if operator == "crosses_below":
        return left["prev"] >= right["prev"] and left["current"] < right["current"]
    return False
