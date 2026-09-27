import time
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

@pytest.mark.asyncio
async def test_custom_telemetry_ingestion_and_pipeline_execution():
    import time
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Reject missing device ID (HTTP 422)
        res_missing_id = await ac.post("/api/v1/telemetry/ingest", json={
            "latitude": 34.0522,
            "longitude": -118.2437,
            "altitude": 250.0,
            "speed": 25.0,
            "heading": 180.0
        })
        assert res_missing_id.status_code == 422
        assert "Device ID / Source is required" in res_missing_id.json()["detail"]

        # 2. Reject out-of-range coordinates (HTTP 422)
        res_bad_lat = await ac.post("/api/v1/telemetry/ingest", json={
            "device_id": "CUSTOM-001",
            "latitude": 125.0, # Invalid latitude
            "longitude": -118.2437,
            "altitude": 250.0,
            "speed": 25.0,
            "heading": 180.0
        })
        assert res_bad_lat.status_code == 422
        assert "Latitude must be a numeric value between -90.0 and 90.0" in res_bad_lat.json()["detail"]

        # 3. Accept valid custom telemetry and verify full 10-stage execution
        now_ts = time.time()
        custom_payload = {
            "device_id": "CUSTOM-001",
            "latitude": 37.774929,
            "longitude": -122.419418,
            "altitude": 180.5,
            "speed": 32.4,
            "heading": 270.0,
            "timestamp": now_ts,
            "battery_pct": 94.5,
            "flight_mode": "AUTONOMOUS_PATROL"
        }
        res_custom = await ac.post("/api/v1/telemetry/ingest", json=custom_payload)
        assert res_custom.status_code == 200
        data = res_custom.json()
        assert data["action"] == "ACCEPTED"
        assert data["classification"] == "AUTHENTIC"
        assert data["trust_score"] == 100
        assert data["auth_status"] == "VERIFIED"
        assert data["freshness_status"] == "PASS"
        assert data["sig_status"] == "VERIFIED"
        assert data["integrity_status"] == "PASS"
        assert data["simulated"] is False
        assert data["packet_type"] == "Custom Telemetry"
        assert data["source"] == "CUSTOM-001"
        assert data["decrypted_payload"]["latitude"] == 37.774929
        assert data["decrypted_payload"]["flight_mode"] == "AUTONOMOUS_PATROL"

        # 4. Verify packet appears in telemetry packets list
        res_packets = await ac.get(f"/api/v1/telemetry/packets/{data['packet_id']}")
        assert res_packets.status_code == 200
        pkt_data = res_packets.json()
        assert pkt_data["packet_id"] == data["packet_id"]
        assert pkt_data["simulated"] is False
        assert pkt_data["source"] == "CUSTOM-001"

@pytest.mark.asyncio
async def test_demo_state_machine_and_audit_transitions():
    """
    Verifies full lifecycle of Demo state machine:
    STOPPED -> START DEMO -> RUNNING -> PAUSE -> PAUSED -> RESUME -> RUNNING -> STOP -> STOPPED.
    Verifies persistent demo_state, audit events, and custom telemetry coexistence.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Start Demo
        res_start = await ac.post("/api/v1/operator/start?operator_id=OPERATOR-PRIMARY")
        assert res_start.status_code == 200
        start_data = res_start.json()
        assert start_data["status"] == "RUNNING"
        assert start_data["demo_state"] == "RUNNING"
        assert start_data["stream_status"] == "ACTIVE"

        # Check status & dashboard stats reflect RUNNING
        res_status = await ac.get("/api/v1/operator/status")
        assert res_status.status_code == 200
        assert res_status.json()["demo_state"] == "RUNNING"

        res_dash = await ac.get("/api/v1/dashboard/stats")
        assert res_dash.status_code == 200
        assert res_dash.json()["demo_state"] == "RUNNING"

        # 2. Pause Demo
        res_pause = await ac.post("/api/v1/operator/pause?operator_id=OPERATOR-PRIMARY")
        assert res_pause.status_code == 200
        pause_data = res_pause.json()
        assert pause_data["status"] == "PAUSED"
        assert pause_data["demo_state"] == "PAUSED"
        assert pause_data["stream_status"] == "PAUSED"

        res_status = await ac.get("/api/v1/operator/status")
        assert res_status.json()["demo_state"] == "PAUSED"

        # 3. Custom telemetry must still process through 10-stage pipeline while paused
        now_ts = time.time()
        res_custom = await ac.post("/api/v1/telemetry/ingest", json={
            "device_id": "CUSTOM-001",
            "latitude": 34.0522,
            "longitude": -118.2437,
            "altitude": 150.0,
            "speed": 22.0,
            "heading": 90.0,
            "timestamp": now_ts
        })
        assert res_custom.status_code == 200
        assert res_custom.json()["action"] == "ACCEPTED"
        assert res_custom.json()["source"] == "CUSTOM-001"

        # 4. Resume Demo
        res_resume = await ac.post("/api/v1/operator/resume?operator_id=OPERATOR-PRIMARY")
        assert res_resume.status_code == 200
        resume_data = res_resume.json()
        assert resume_data["status"] == "ACTIVE"
        assert resume_data["demo_state"] == "RUNNING"
        assert resume_data["stream_status"] == "ACTIVE"

        # 5. Stop Demo
        res_stop = await ac.post("/api/v1/operator/stop?operator_id=OPERATOR-PRIMARY")
        assert res_stop.status_code == 200
        stop_data = res_stop.json()
        assert stop_data["status"] == "STOPPED"
        assert stop_data["demo_state"] == "STOPPED"
        assert stop_data["stream_status"] == "STOPPED"

        res_status = await ac.get("/api/v1/operator/status")
        assert res_status.json()["demo_state"] == "STOPPED"

        # 6. Verify audit logs record all actions persistently
        res_logs = await ac.get("/api/v1/archive/logs?limit=50")
        assert res_logs.status_code == 200
        logs = res_logs.json()
        descriptions = [l.get("description", "") for l in logs]

        assert any("DEMO_STARTED" in d or "START" in d for d in descriptions)
        assert any("STREAM_PAUSED" in d or "PAUSED" in d for d in descriptions)
        assert any("STREAM_RESUMED" in d or "RESUMED" in d for d in descriptions)
        assert any("DEMO_STOPPED" in d or "STOPPED" in d for d in descriptions)

@pytest.mark.asyncio
async def test_import_telemetry_json_and_csv_batches():
    """
    Verifies the Import JSON / CSV pipeline:
    1. Single JSON record import
    2. Array JSON records import with ISO-8601 timestamps
    3. CSV file upload with header validation
    4. Rejection of malformed rows while processing valid ones
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Single JSON record import via direct JSON body
        single_json = {
            "device_id": "UAV-IMPORT-01",
            "latitude": 17.385044,
            "longitude": 78.486671,
            "altitude": 450.0,
            "speed": 65.0,
            "heading": 120.0,
            "timestamp": "2026-09-27T18:00:00Z",
            "battery_pct": 92.0,
            "flight_mode": "AUTONOMOUS_NAV"
        }
        res_single = await ac.post("/api/v1/telemetry/import", json=single_json)
        assert res_single.status_code == 200
        single_data = res_single.json()
        assert single_data["status"] == "COMPLETED"
        assert single_data["total_records"] == 1
        assert single_data["accepted_count"] == 1
        assert single_data["failed_count"] == 0

        # 2. JSON Array of records
        json_array = [
            {
                "device_id": "UAV-IMP-02",
                "latitude": 17.3860,
                "longitude": 78.4870,
                "altitude": 500.0,
                "speed": 70.0,
                "heading": 180.0,
                "timestamp": "2026-09-27T18:05:00Z"
            },
            {
                "device_id": "UGV-IMP-03",
                "latitude": 17.3870,
                "longitude": 78.4880,
                "altitude": 100.0,
                "speed": 20.0,
                "heading": 45.0,
                "timestamp": "2026-09-27T18:05:10Z"
            }
        ]
        res_array = await ac.post("/api/v1/telemetry/import", json=json_array)
        assert res_array.status_code == 200
        array_data = res_array.json()
        assert array_data["total_records"] == 2
        assert array_data["accepted_count"] == 2
        assert array_data["failed_count"] == 0

        # 3. CSV File Upload
        csv_content = (
            "device_id,latitude,longitude,altitude,speed,heading,timestamp,battery_pct,flight_mode\n"
            "UAV-CSV-01,17.3850,78.4867,500.0,80.0,90.0,2026-09-27T18:00:00Z,95.0,AUTONOMOUS_NAV\n"
            "UAV-CSV-02,17.3860,78.4870,550.0,75.0,120.0,2026-09-27T18:00:05Z,91.0,WAYPOINT_PATROL\n"
        ).encode('utf-8')
        files = {"file": ("tactical_feed.csv", csv_content, "text/csv")}
        res_csv = await ac.post("/api/v1/telemetry/import", files=files)
        assert res_csv.status_code == 200
        csv_data = res_csv.json()
        assert csv_data["status"] == "COMPLETED"
        assert csv_data["total_records"] == 2
        assert csv_data["accepted_count"] == 2
        assert csv_data["failed_count"] == 0

        # 4. Mixed CSV with one malformed row (should safely flag failed and process valid)
        mixed_csv = (
            "device_id,latitude,longitude,altitude,speed,heading,timestamp\n"
            "UAV-OK-01,17.3850,78.4867,500.0,80.0,90.0,2026-09-27T18:00:00Z\n"
            "UAV-BAD-02,999.0,78.4870,550.0,75.0,120.0,2026-09-27T18:00:05Z\n" # Invalid lat > 90
        ).encode('utf-8')
        files_mixed = {"file": ("mixed_feed.csv", mixed_csv, "text/csv")}
        res_mixed = await ac.post("/api/v1/telemetry/import", files=files_mixed)
        assert res_mixed.status_code == 200
        mixed_data = res_mixed.json()
        assert mixed_data["total_records"] == 2
        assert mixed_data["accepted_count"] == 1
        assert mixed_data["failed_count"] == 1


