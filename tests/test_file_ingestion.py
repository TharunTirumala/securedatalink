import pytest
import pytest_asyncio
import json
import time
from app.ingestion.file_watcher import file_watcher
from app.database.connection import init_db, async_session
from app.database.models import FileProcessingRecord
from app.core.config import settings
from scripts.generate_sample_file import create_packet
from sqlalchemy import select

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    await init_db()

@pytest.mark.asyncio
async def test_file_ingestion_workflow(tmp_path):
    unique_suffix = int(time.time() * 1000)
    packet_id = f"PKT-FILE-TEST-{unique_suffix}"
    filename = f"telemetry_test_ingest_{unique_suffix}.json"

    # Create test packet
    pkt = create_packet(packet_id, 9901, "UAV-ALPHA-01", "AUTHENTIC")
    test_file = settings.INCOMING_DIR / filename
    test_file.write_text(json.dumps([pkt]))

    # Trigger scan directly
    await file_watcher._scan_incoming()

    # Check file moved from incoming
    assert not test_file.exists()

    # Check database record exists
    async with async_session() as session:
        result = await session.execute(
            select(FileProcessingRecord).where(FileProcessingRecord.filename == filename)
        )
        record = result.scalar_one_or_none()
        assert record is not None
        assert record.status == "PROCESSED"
        assert record.record_count == 1
