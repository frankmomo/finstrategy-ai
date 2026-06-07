from typing import Any

from openai import OpenAI

from ..config import get_settings
from .market_context import build_market_context


SYSTEM_PROMPT = """
You are FinStrategy Copilot, a market-analysis assistant embedded in a financial analytics dashboard.
Use only the supplied application context: latest market bars, active strategies, and recent alerts.
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
        },
    }
