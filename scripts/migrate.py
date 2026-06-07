import asyncio
from pathlib import Path
import sys

import asyncpg

ROOT = Path(__file__).resolve().parents[1]
for candidate in (ROOT / "apps" / "api", ROOT / "api", ROOT):
    if candidate.exists():
        sys.path.insert(0, str(candidate))

from app.config import get_settings


async def main() -> None:
    settings = get_settings()
    if settings.database_url.startswith("sqlite"):
        print("[migrate] SQLite mode initializes schema on API startup; skipping PostgreSQL migrations.")
        return

    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        migrations_dir = ROOT / "migrations"
        for path in sorted(migrations_dir.glob("*.sql")):
            version = path.stem
            exists = await conn.fetchval("SELECT 1 FROM schema_migrations WHERE version = $1", version)
            if exists:
                print(f"[migrate] skip {version}")
                continue
            async with conn.transaction():
                await conn.execute(path.read_text(encoding="utf-8"))
                await conn.execute("INSERT INTO schema_migrations (version) VALUES ($1)", version)
            print(f"[migrate] applied {version}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
