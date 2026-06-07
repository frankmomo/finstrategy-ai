from fastapi import Header, HTTPException

from .config import get_settings


def require_api_key(x_finstrategy_key: str | None = Header(default=None)) -> None:
    expected = get_settings().app_api_key
    if not expected:
        return
    if x_finstrategy_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing FinStrategy access key")
