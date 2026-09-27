from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings
from app.core.logging import logger

Base = declarative_base()

engine = create_async_engine(
    settings.DATABASE_URL,
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

    # Seed operational data if persistent store is brand new
    try:
        from datetime import datetime, timezone
        from sqlalchemy import func, select
        from app.database.models import SecurityLogRecord, OperatorActionRecord, PacketRecord
        
        async with async_session() as session:
            log_count = await session.scalar(select(func.count(SecurityLogRecord.id)))
            if log_count == 0:
                now = datetime.now(timezone.utc)
                session.add(SecurityLogRecord(
                    timestamp=now,
                    event_type="SYSTEM_STARTUP",
                    severity="INFO",
                    source="SYSTEM",
                    description="SecureLink Tactical Datalink System online. Cryptographic core initialized.",
                    details={"engine": "AES-256-GCM / ECDSA NIST P-256", "status": "NOMINAL"}
                ))
                session.add(OperatorActionRecord(
                    timestamp=now,
                    operator_id="OPERATOR-PRIMARY",
                    action="INITIALIZE_TACTICAL_CONTROLS",
                    confirmed=True,
                    status="SUCCESS",
                    details={"scope": "TACTICAL_LINK_READY"}
                ))
                await session.commit()

            pkt_count = await session.scalar(select(func.count(PacketRecord.id)))
            if pkt_count == 0:
                from app.ingestion.simulator import simulator
                from app.processing.pipeline import pipeline
                for _ in range(6):
                    pkt = simulator._generate_packet()
                    await pipeline.process_packet(pkt)
    except Exception as e:
        logger.warning(f"Note on initial seed: {e}")

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

