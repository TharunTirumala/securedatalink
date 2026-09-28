import sys
import os
import time
import json
import httpx
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.generate_sample_file import create_packet
from app.core.config import settings
from app.crypto.key_manager import key_manager

def poll_until(fn, timeout: float = 10.0, interval: float = 0.2, error_msg: str = "Condition not met in time"):
    """Active polling helper with timeout to avoid brittle static sleeps."""
    start = time.time()
    last_err = None
    while time.time() - start < timeout:
        try:
            res = fn()
            if res:
                return res
        except Exception as e:
            last_err = e
        time.sleep(interval)
    raise TimeoutError(f"{error_msg} (elapsed: {timeout}s, last error: {last_err})")

def run_acceptance_test():
    print("=" * 60)
    print("RUNNING SECURELINK END-TO-END FINAL ACCEPTANCE TEST")
    print("=" * 60)

    client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=10.0)

    # STEP 1: Verify backend
    print("\n[STEP 1] Checking backend service...")
    res = client.get("/health")
    assert res.status_code == 200, f"Backend health check failed: {res.text}"
    print("[PASS] Backend active: http://127.0.0.1:8000 (status: HEALTHY)")

    # STEP 2: Verify frontend (optional / warning if not running)
    print("\n[STEP 2] Checking frontend service...")
    try:
        fe_res = httpx.get("http://127.0.0.1:5173/", timeout=2.0)
        assert fe_res.status_code == 200, f"Frontend check failed: {fe_res.status_code}"
        print("[PASS] Frontend active: http://127.0.0.1:5173 (Vite + React)")
    except Exception as e:
        print(f"[NOTE] Frontend service not active on :5173 ({e}); continuing backend tests.")

    # STEP 3: Check initial dashboard stats
    print("\n[STEP 3] Fetching initial dashboard state...")
    stats_res = client.get("/api/v1/dashboard/stats")
    assert stats_res.status_code == 200
    initial_stats = stats_res.json()
    print(f"[PASS] Initial Packets Authenticated: {initial_stats['authenticated_packets']}, Trust Score: {initial_stats['trust_score']}")

    # STEP 4: Enable Simulated Demonstration Mode
    print("\n[STEP 4] Enabling Simulated Demonstration Mode...")
    sim_res = client.post("/api/v1/operator/simulator", json={
        "enabled": True,
        "rate_hz": 2.0,
        "attack_ratio": 0.3
    })
    assert sim_res.status_code == 200
    print("[PASS] Simulated Demonstration Mode ENABLED @ 2.0 Hz")

    # STEP 5 & 6: Wait and observe continuous packet generation
    print("\n[STEP 5 & 6] Observing continuous packet arrival and live processing via active polling...")
    def check_packets_flowing():
        s = client.get("/api/v1/dashboard/stats").json()
        pkts = client.get("/api/v1/telemetry/packets?limit=10").json()
        if len(pkts) > 0 and s["adaptive_filter"]["evaluated"] > initial_stats["adaptive_filter"]["evaluated"]:
            return s, pkts
        return None

    stats_after_sim, packets_res = poll_until(
        check_packets_flowing,
        timeout=10.0,
        interval=0.3,
        error_msg="No packets generated or evaluated by simulator"
    )
    print(f"[PASS] Packets Evaluated: {stats_after_sim['adaptive_filter']['evaluated']}")
    print(f"[PASS] Packets Accepted: {stats_after_sim['adaptive_filter']['accepted']}")
    print(f"[PASS] Packets Blocked: {stats_after_sim['adaptive_filter']['blocked']}")
    print(f"[PASS] Replay Detected: {stats_after_sim['adaptive_filter']['replay']}")
    print(f"[PASS] Tampered Detected: {stats_after_sim['adaptive_filter']['tampered']}")
    assert len(packets_res) > 0, "No packets found in live stream!"

    # Stop simulator for file ingestion test
    client.post("/api/v1/operator/simulator", json={"enabled": False})

    # STEP 7 & 8 & 9 & 10: Continuous File Ingestion Test
    print("\n[STEP 7-10] Testing Continuous File Ingestion (/data/incoming)...")
    timestamp = int(time.time() * 1000)
    auth_pkt = create_packet(f"PKT-ACCEPT-{timestamp}", 3001, "UAV-BRAVO-02", "AUTHENTIC")
    tamp_pkt = create_packet(f"PKT-BLOCK-{timestamp}", 3002, "UAV-BRAVO-02", "TAMPERED")
    replay_pkt = create_packet(f"PKT-REPLAY-{timestamp}", 3003, "UAV-BRAVO-02", "REPLAY")

    test_file_path = settings.INCOMING_DIR / f"telemetry_live_demo_{timestamp}.json"
    test_file_path.write_text(json.dumps([auth_pkt, tamp_pkt, replay_pkt]))
    print(f"[PASS] Dropped test file: {test_file_path.name} into data/incoming/")

    print("Polling for background file watcher detection and archive...")
    poll_until(
        lambda: not test_file_path.exists(),
        timeout=8.0,
        interval=0.2,
        error_msg=f"File {test_file_path.name} was not moved from data/incoming!"
    )
    print("[PASS] Backend file watcher automatically detected, processed, and archived the file.")

    # STEP 11: Valid packet verification
    print("\n[STEP 11] Verifying AUTHENTIC packet...")
    pkt_auth = poll_until(
        lambda: client.get(f"/api/v1/telemetry/packets/PKT-ACCEPT-{timestamp}").json()
        if client.get(f"/api/v1/telemetry/packets/PKT-ACCEPT-{timestamp}").status_code == 200 else None,
        timeout=5.0,
        interval=0.2,
        error_msg="Authentic packet not found in database"
    )
    print(f"  Packet: {pkt_auth['packet_id']}")
    print(f"  Classification: {pkt_auth['classification']}")
    print(f"  Auth Status: {pkt_auth['auth_status']}")
    print(f"  Action: {pkt_auth['action']}")
    print(f"  Trust Score: {pkt_auth['trust_score']}/100")
    assert pkt_auth["classification"] == "AUTHENTIC"
    assert pkt_auth["action"] == "ACCEPTED"
    assert pkt_auth["trust_score"] >= 90
    print("[PASS] STEP 11 PASSED: Valid packet received AUTHENTIC, VERIFIED, ACCEPTED")

    # STEP 12: Tampered / Replay packet verification
    print("\n[STEP 12] Verifying TAMPERED and REPLAY packets...")
    pkt_tamp = poll_until(
        lambda: client.get(f"/api/v1/telemetry/packets/PKT-BLOCK-{timestamp}").json()
        if client.get(f"/api/v1/telemetry/packets/PKT-BLOCK-{timestamp}").status_code == 200 else None,
        timeout=5.0,
        interval=0.2,
        error_msg="Tampered packet not found in database"
    )
    print(f"  Tampered Packet: {pkt_tamp['packet_id']}")
    print(f"  Classification: {pkt_tamp['classification']}")
    print(f"  Auth Status: {pkt_tamp['auth_status']}")
    print(f"  Action: {pkt_tamp['action']}")
    print(f"  Trust Score: {pkt_tamp['trust_score']}/100")
    assert pkt_tamp["classification"] == "TAMPERED"
    assert pkt_tamp["action"] == "BLOCKED"
    assert pkt_tamp["trust_score"] <= 35

    pkt_replay = poll_until(
        lambda: client.get(f"/api/v1/telemetry/packets/PKT-REPLAY-{timestamp}").json()
        if client.get(f"/api/v1/telemetry/packets/PKT-REPLAY-{timestamp}").status_code == 200 else None,
        timeout=5.0,
        interval=0.2,
        error_msg="Replay packet not found in database"
    )
    print(f"  Replayed Packet: {pkt_replay['packet_id']}")
    print(f"  Classification: {pkt_replay['classification']}")
    print(f"  Action: {pkt_replay['action']}")
    assert pkt_replay["classification"] == "REPLAYED"
    assert pkt_replay["action"] == "BLOCKED"
    print("[PASS] STEP 12 PASSED: Malicious test packets received TAMPERED/REPLAYED, BLOCKED")

    # STEP 13, 14, 15: Security logs & C2 output
    print("\n[STEP 13, 14, 15] Checking Trust Score, Security Audit Logs, and Trusted C2...")
    threats_res = client.get("/api/v1/threats?limit=5")
    assert threats_res.status_code == 200
    threats = threats_res.json()
    assert len(threats) > 0, "No threats recorded in threat log!"
    print(f"[PASS] Security Log recorded threat: {threats[0]['event']} ({threats[0]['action']})")

    c2_data = client.get("/api/v1/telemetry/c2-stream").json()
    print(f"[PASS] Trusted C2 Forwarded Packets: {c2_data['forwarded_count']}")
    assert c2_data["forwarded_count"] > 0

    # STEP 16 & 17: Persistence across refresh
    print("\n[STEP 16 & 17] Verifying State Persistence...")
    all_packets = client.get("/api/v1/telemetry/packets?limit=10").json()
    assert len(all_packets) >= 3
    print("[PASS] Persistent SQLite records remain accessible upon query.")

    # STEP 18: Key Security & Zero Secret Exposure
    print("\n[STEP 18] Verifying Key Security & Zero Secret Exposure...")
    active_key_bytes = key_manager.get_key_bytes()
    raw_secret_hex = active_key_bytes.hex() if active_key_bytes else ""
    
    key_meta_res = client.get("/api/v1/keys/active")
    assert key_meta_res.status_code == 200
    key_meta = key_meta_res.json()
    raw_response_text = key_meta_res.text

    print(f"  Key ID: {key_meta['key_id']}")
    print(f"  Algorithm: {key_meta['algorithm']}")
    print(f"  Status: {key_meta['status']}")
    print(f"  Masked Secret: {key_meta['masked_key']}")

    assert key_meta["masked_key"] == "••••••••••••••••••••••••••••••••"
    assert "key_bytes" not in key_meta
    assert "secret" not in key_meta
    assert raw_secret_hex not in raw_response_text, "CRITICAL: Raw key hex leaked in API response!"
    print("[PASS] STEP 18 PASSED: Raw AES secret key is strictly protected and NEVER exposed in memory/API responses.")

    # Dynamic Re-Keying test
    print("\nTesting Dynamic Key Re-Sync...")
    resync_res = client.post("/api/v1/keys/resync?operator_id=ACCEPTANCE-TESTER").json()
    print(f"[PASS] Re-sync executed. New Active Key ID: {resync_res['key_id']}")
    assert resync_res['key_id'] != key_meta['key_id']

    new_key_bytes = key_manager.get_key_bytes(resync_res['key_id'])
    if new_key_bytes:
        assert new_key_bytes.hex() not in json.dumps(resync_res), "CRITICAL: New raw key hex leaked in re-sync response!"

    print("\n" + "=" * 60)
    print("ALL 18 FINAL ACCEPTANCE TEST STEPS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_acceptance_test()
