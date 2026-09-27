import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.connection import init_db

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    await init_db()

@pytest.mark.asyncio
async def test_key_management_safe_masking():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/keys/active")
        assert response.status_code == 200
        data = response.json()
        assert "key_id" in data
        assert data["algorithm"] == "AES-256-GCM"
        assert data["status"] == "ACTIVE"
        # Verify secret key is masked and NOT exposed
        assert data["masked_key"] == "••••••••••••••••••••••••••••••••"
        assert "key_bytes" not in data
        assert "secret" not in data

@pytest.mark.asyncio
async def test_dashboard_stats():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "authenticated_packets" in data
        assert "trust_score" in data
        assert "stream_status" in data

@pytest.mark.asyncio
async def test_key_resync():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res1 = await ac.get("/api/v1/keys/active")
        initial_key_id = res1.json()["key_id"]

        res2 = await ac.post("/api/v1/keys/resync?operator_id=TEST-OP")
        assert res2.status_code == 200
        new_key_id = res2.json()["key_id"]
        assert new_key_id != initial_key_id
