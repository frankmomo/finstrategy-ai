import base64
import json
from openai import OpenAI

from ..config import get_settings
from ..models import StrategyRules


PROMPT = """
Extract the trading strategy rules from this screenshot.
Return only valid JSON using this exact shape:
{
  "type": "technical_strategy",
  "side": "long|short|neutral",
  "timeframe": "1m|5m|15m|1h|1d",
  "tickers": ["SPY"],
  "conditions": [
    {
      "indicator": "close|open|high|low|volume|sma|ema|rsi",
      "params": {"period": 20},
      "operator": ">|<|>=|<=|==|crosses_above|crosses_below",
      "value": 100.0,
      "compare_to": {"indicator": "ema", "params": {"period": 50}}
    }
  ],
  "risk": {"stop_loss_pct": 1.0, "take_profit_pct": 2.0},
  "notes": "short explanation"
}
Use only explicit rules visible in the image. If unclear, choose conservative defaults and lower confidence.
"""


def parse_strategy_image(image_bytes: bytes, content_type: str = "image/png") -> tuple[StrategyRules, float]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required to parse strategy screenshots")

    client = OpenAI(api_key=settings.openai_api_key)
    encoded = base64.b64encode(image_bytes).decode("ascii")

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{encoded}"},
                    },
                ],
            }
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("OpenAI returned an empty strategy response")

    parsed = json.loads(content)
    confidence = float(parsed.pop("confidence", 0.75))
    return StrategyRules.model_validate(parsed), confidence
