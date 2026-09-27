import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.connection import init_db
from app.database.models import SecurityLogRecord
from app.processing.freshness import freshness_verifier
from app.processing.pipeline import pipeline

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    await init_db()
    # Reset stream to ACTIVE before tests
    await pipeline.resume_stream()

@pytest.mark.asyncio
async def test_operator_override_authorization_and_persistence():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Reject invalid boundary (< 1.0)
        res_low = await ac.post("/api/v1/operator/override", json={
            "freshness_window": 0.2,
            "operator_id": "OPERATOR-PRIMARY",
            "passcode": "TAC-SEC-8000"
        })
        assert res_low.status_code == 400
        assert "Permitted tactical range is 1.0s to 60.0s" in res_low.json()["detail"]

        # 2. Reject invalid boundary (> 60.0)
        res_high = await ac.post("/api/v1/operator/override", json={
            "freshness_window": 75.0,
            "operator_id": "OPERATOR-PRIMARY",
            "passcode": "TAC-SEC-8000"
        })
        assert res_high.status_code == 400

        # 3. Reject unauthorized passcode
        res_unauth = await ac.post("/api/v1/operator/override", json={
            "freshness_window": 10.0,
            "operator_id": "OPERATOR-PRIMARY",
            "passcode": "WRONG-PASSCODE"
        })
        assert res_unauth.status_code == 403
        assert "authorization failed" in res_unauth.json()["detail"].lower()

        # 4. Reject unrecognized operator
        res_bad_op = await ac.post("/api/v1/operator/override", json={
            "freshness_window": 10.0,
            "operator_id": "MALICIOUS-INTRUDER",
            "passcode": "TAC-SEC-8000"
        })
        assert res_bad_op.status_code == 403

        # 5. Successfully apply authorized override
        res_ok = await ac.post("/api/v1/operator/override", json={
            "freshness_window": 15.0,
            "operator_id": "OPERATOR-PRIMARY",
            "passcode": "TAC-SEC-8000"
        })
        assert res_ok.status_code == 200
        assert res_ok.json()["status"] == "OVERRIDE_APPLIED"
        assert res_ok.json()["freshness_window_seconds"] == 15.0
        assert freshness_verifier.max_drift_seconds == 15.0

        # 6. Verify status endpoint reflects new state
        res_status = await ac.get("/api/v1/operator/status")
        assert res_status.status_code == 200
        assert res_status.json()["freshness_window"] == 15.0

@pytest.mark.asyncio
async def test_pause_resume_stream_and_packet_filtering():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Pause stream
        res_pause = await ac.post("/api/v1/operator/pause?operator_id=OPERATOR-PRIMARY")
        assert res_pause.status_code == 200
        assert res_pause.json()["stream_status"] == "PAUSED"
        assert pipeline.stream_paused is True

        # 2. Check dashboard stats reports PAUSED
        res_stats = await ac.get("/api/v1/dashboard/stats")
        assert res_stats.json()["stream_status"] == "PAUSED"

        # 3. Processing a packet while paused results in STREAM_PAUSED / FILTERED
        packet_res = await pipeline.process_packet({
            "packet_id": "PKT-TEST-PAUSE-001",
            "sequence_num": 999,
            "source": "UAV-ALPHA-01",
            "iv": "00" * 12,
            "tag": "00" * 16,
            "ciphertext": "aabbcc",
            "signature": "00" * 64,
            "payload_hash": "00" * 32
        })
        assert packet_res["action"] == "FILTERED"
        assert packet_res["status"] == "STREAM_PAUSED"

        # 4. Resume stream
        res_resume = await ac.post("/api/v1/operator/resume?operator_id=OPERATOR-PRIMARY")
        assert res_resume.status_code == 200
        assert res_resume.json()["stream_status"] == "ACTIVE"
        assert pipeline.stream_paused is False

@pytest.mark.asyncio
async def test_data_archive_vault_and_restore():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Ingest a test packet directly through pipeline
        pkt_id = f"PKT-ARCH-TEST-{int(pytest.importorskip('time').time() * 1000) % 100000}"
        from app.database.connection import async_session
        from app.database.models import PacketRecord
        from datetime import datetime, timezone
        
        async with async_session() as session:
            rec = PacketRecord(
                packet_id=pkt_id,
                sequence_num=501,
                source="UAV-ALPHA-01",
                timestamp=1700000000.0,
                packet_type="Telemetry",
                key_id="SK-ALPHA-042",
                action="ACCEPTED",
                classification="AUTHENTIC",
                trust_score=98.5,
                is_archived=False,
                created_at=datetime.now(timezone.utc)
            )
            session.add(rec)
            await session.commit()

        # 1. Verify packet is in active buffer
        res_active = await ac.get("/api/v1/telemetry/packets?limit=50")
        active_ids = [p["packet_id"] for p in res_active.json()]
        assert pkt_id in active_ids

        # 2. Archive the packet
        res_arch = await ac.post("/api/v1/archive/packets", json={
            "packet_ids": [pkt_id],
            "operator_id": "OPERATOR-PRIMARY"
        })
        assert res_arch.status_code == 200
        assert res_arch.json()["status"] == "SUCCESS"
        assert res_arch.json()["archived_count"] == 1

        # 3. Verify it is now in archived vault
        res_vault = await ac.get(f"/api/v1/archive/packets?search={pkt_id}")
        assert res_vault.status_code == 200
        vault_ids = [p["packet_id"] for p in res_vault.json()]
        assert pkt_id in vault_ids

        # 4. Verify it is NO LONGER in active buffer
        res_active_after = await ac.get("/api/v1/telemetry/packets?limit=50")
        active_ids_after = [p["packet_id"] for p in res_active_after.json()]
        assert pkt_id not in active_ids_after

        # 5. Duplicate archival returns ALREADY_ARCHIVED
        res_dup = await ac.post("/api/v1/archive/packets", json={
            "packet_ids": [pkt_id],
            "operator_id": "OPERATOR-PRIMARY"
        })
        assert res_dup.status_code == 200
        assert res_dup.json()["status"] == "ALREADY_ARCHIVED"

        # 6. Restore the packet to active buffer
        res_restore = await ac.post("/api/v1/archive/restore", json={
            "packet_id": pkt_id,
            "operator_id": "OPERATOR-PRIMARY"
        })
        assert res_restore.status_code == 200
        assert res_restore.json()["status"] == "RESTORED"

        # 7. Verify packet is back in active buffer
        res_active_restored = await ac.get("/api/v1/telemetry/packets?limit=50")
        assert pkt_id in [p["packet_id"] for p in res_active_restored.json()]

@pytest.mark.asyncio
async def test_security_logs_audit_trail_and_exports():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Trigger an authorization failure to ensure a fresh security log
        await ac.post("/api/v1/operator/override", json={
            "freshness_window": 10.0,
            "operator_id": "UNKNOWN-ENTITY",
            "passcode": "BAD-CODE"
        })

        # Fetch logs
        res_logs = await ac.get("/api/v1/archive/logs?limit=50")
        assert res_logs.status_code == 200
        logs = res_logs.json()
        assert len(logs) > 0

        # Verify event types and zero unmasked secrets
        event_types = [l["event_type"] for l in logs]
        assert "AUTHORIZATION_FAILURE" in event_types

        for l in logs:
            desc = l.get("description", "")
            assert "TAC-SEC-8000" not in desc
            assert "BAD-CODE" not in desc
            if l.get("details"):
                import json
                raw_details = json.dumps(l["details"])
                assert "TAC-SEC-8000" not in raw_details

        # Verify CSV and JSON exports
        res_csv = await ac.get("/api/v1/archive/logs/export?format=csv")
        assert res_csv.status_code == 200
        assert "Timestamp" in res_csv.text
        assert "Event Type" in res_csv.text

        res_json = await ac.get("/api/v1/archive/logs/export?format=json")
        assert res_json.status_code == 200
        assert isinstance(res_json.json(), list)

@pytest.mark.asyncio
async def test_operator_cache_clear_authorization():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Reject unauthorized cache clear attempt
        res_unauth = await ac.post("/api/v1/operator/cache/clear", json={
            "operator_id": "OPERATOR-PRIMARY",
            "passcode": "WRONG-PASS"
        })
        assert res_unauth.status_code == 403
        assert "authorization failed" in res_unauth.json()["detail"].lower()

        # 2. Accept authorized cache clear
        res_ok = await ac.post("/api/v1/operator/cache/clear", json={
            "operator_id": "OPERATOR-PRIMARY",
            "passcode": "TAC-SEC-8000"
        })
        assert res_ok.status_code == 200
        assert res_ok.json()["status"] == "CACHE_CLEARED"

@pytest.mark.asyncio
async def test_file_upload_and_duplicate_prevention():
    import json
    import time
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sample_records = [
            {
                "packet_id": f"PKT-UP-TEST-{int(time.time()*1000)%100000}",
                "sequence_num": 9991,
                "source": "UAV-ALPHA-01",
                "timestamp": time.time(),
                "packet_type": "TELEMETRY_POSITION"
            }
        ]
        file_content = json.dumps(sample_records).encode('utf-8')
        files = {"file": ("test_telemetry.json", file_content, "application/json")}

        # 1. Initial upload succeeds
        res_upload = await ac.post("/api/v1/archive/files/upload?operator_id=OPERATOR-PRIMARY", files=files)
        assert res_upload.status_code == 200
        data = res_upload.json()
        assert data["status"] == "PROCESSED"
        assert data["record_count"] == 1

        # 2. Duplicate upload fails with 409
        files_dup = {"file": ("test_telemetry.json", file_content, "application/json")}
        res_dup = await ac.post("/api/v1/archive/files/upload?operator_id=OPERATOR-PRIMARY", files=files_dup)
        assert res_dup.status_code == 409
        assert "duplicate file" in res_dup.json()["detail"].lower()

@pytest.mark.asyncio
async def test_verify_and_archive_flow():
    import time
    from app.ingestion.simulator import simulator
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Ingest sample file
        res_sample = await ac.post("/api/v1/archive/files/sample?sample_type=authentic")
        assert res_sample.status_code == 200
        assert res_sample.json()["status"] == "PROCESSED"

        # Verify raw telemetry submission
        auth_pkt = simulator._generate_packet()
        auth_pkt["simulated"] = False
        res_verif = await ac.post("/api/v1/archive/verify-and-archive", json=auth_pkt)
        if res_verif.status_code == 200:
            assert res_verif.json()["status"] == "VERIFIED_AND_ARCHIVED"
        else:
            # If generated packet was injected attack, it properly rejected
            assert res_verif.status_code == 422

