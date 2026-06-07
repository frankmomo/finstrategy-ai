import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "api"
sys.path.insert(0, str(ROOT))

from app.db import close_db, connect_db
from app.services.realtime_ingestion import run_ingestion_forever


async def main() -> None:
    await connect_db()
    try:
        await run_ingestion_forever()
    finally:
        await close_db()


if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
