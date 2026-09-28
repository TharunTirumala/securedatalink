from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.core.logging import logger

Base = declarative_base()

engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    echo=False,
    future=True
)

async_session = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession
)

async def init_db():
    """Initializes tables and performs safe migrations on persistent SQLite database."""
    async with engine.begin() as conn:
        from app.database import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        
        def migrate_schema(sync_conn):
            cursor = sync_conn.connection.cursor()
            try:
                cursor.execute("PRAGMA table_info(packets)")
                columns = [row[1] for row in cursor.fetchall()]
                if "reason" not in columns:
                    cursor.execute("ALTER TABLE packets ADD COLUMN reason VARCHAR(256)")
                if "is_archived" not in columns:
                    cursor.execute("ALTER TABLE packets ADD COLUMN is_archived BOOLEAN DEFAULT 0")
                if "archived_at" not in columns:
                    cursor.execute("ALTER TABLE packets ADD COLUMN archived_at DATETIME")
                if "archived_by" not in columns:
                    cursor.execute("ALTER TABLE packets ADD COLUMN archived_by VARCHAR(64)")
                if "archive_batch_id" not in columns:
                    cursor.execute("ALTER TABLE packets ADD COLUMN archive_batch_id VARCHAR(64)")
                sync_conn.connection.commit()
            except Exception as e:
                logger.warning(f"Schema migration note: {e}")

        await conn.run_sync(migrate_schema)
    logger.info("Persistent SQLite database initialized and verified.")

    # Seed minimal system state if not present
    try:
        from app.database.models import SystemStateRecord
        async with async_session() as session:
            state = await session.get(SystemStateRecord, "demo_state")
            if not state:
                session.add(SystemStateRecord(key="demo_state", value="STOPPED"))
                await session.commit()
    except Exception as e:
        logger.warning(f"Note on initial system state check: {e}")

async def get_system_state(key: str, default: str = None) -> str:
    """Retrieves a persistent system state value."""
    from app.database.models import SystemStateRecord
    from sqlalchemy import select
    async with async_session() as session:
        result = await session.execute(select(SystemStateRecord).where(SystemStateRecord.key == key))
        rec = result.scalar_one_or_none()
        return rec.value if rec else default

async def set_system_state(key: str, value: str):
    """Sets a persistent system state value."""
    from app.database.models import SystemStateRecord
    from datetime import datetime, timezone
    async with async_session() as session:
        rec = await session.get(SystemStateRecord, key)
        if rec:
            rec.value = value
            rec.updated_at = datetime.now(timezone.utc)
        else:
            rec = SystemStateRecord(key=key, value=value)
            session.add(rec)
        await session.commit()

async def get_db():
    """Dependency for API endpoints to get database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

