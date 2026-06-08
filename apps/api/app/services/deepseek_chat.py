from typing import Any

from openai import OpenAI

from ..config import get_settings
from .market_context import build_market_context


SYSTEM_PROMPT = """
You are FinStrategy Copilot, a market-analysis assistant embedded in a financial analytics dashboard.
Use only the supplied application context: market_by_timeframe, active strategies, and recent alerts.
The context separates intraday data (1m, 5m, 15m) from daily data (1d). Always state which timeframe you are using.
Do not say the application only has 1-minute data when 5m, 15m, or 1d keys are present in market_by_timeframe.
For strategies, respect each strategy's own timeframe. A 1d strategy must be discussed using 1d/daily bars, not 1m bars.
If context.warnings mentions insufficient daily bars, surface that warning before drawing conclusions about 1d strategies.
Be concise, practical, and explicit about uncertainty.
Never claim to execute trades. Do not provide personalized financial advice.
If the user asks for an action recommendation, frame it as analytical observations and risk factors.
"""


async def ask_deepseek(message: str, history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured")

    context = await build_market_context()
    client = OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"Application context JSON:\n{context}",
        },
    ]

    for item in (history or [])[-8:]:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content[:4000]})

    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model=settings.deepseek_model,
        messages=messages,
        temperature=0.2,
        max_tokens=900,
    )

    answer = response.choices[0].message.content or ""
    return {
        "answer": answer,
        "model": response.model,
        "context": {
            "latest_market_count": len(context["latest_market"]),
            "active_strategy_count": len(context["active_strategies"]),
            "recent_alert_count": len(context["recent_alerts"]),
            "timeframes": list(context["market_by_timeframe"].keys()),
            "warning_count": len(context["warnings"]),
        },
    }
