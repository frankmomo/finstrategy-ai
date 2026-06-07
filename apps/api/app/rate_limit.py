import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


_requests: dict[str, deque[float]] = defaultdict(deque)


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def check_rate_limit(request: Request, *, bucket: str, max_requests: int, window_seconds: int) -> None:
    now = time.monotonic()
    key = f"{bucket}:{client_key(request)}"
    hits = _requests[key]
    cutoff = now - window_seconds
    while hits and hits[0] < cutoff:
        hits.popleft()
    if len(hits) >= max_requests:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    hits.append(now)
