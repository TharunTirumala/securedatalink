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
    """Initializes tables in persistent SQLite database."""
    async with engine.begin() as conn:
        from app.database import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Persistent SQLite database initialized successfully.")

async def get_db():
    """Dependency for API endpoints to get database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
