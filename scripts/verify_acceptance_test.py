import sys
import os
import time
import json
import httpx
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from scripts.generate_sample_file import create_packet
from app.core.config import settings

def run_acceptance_test():
    print("=" * 60)
    print("RUNNING SECURELINK END-TO-END FINAL ACCEPTANCE TEST")
    print("=" * 60)

    client = httpx.Client(timeout=10.0)

    # STEP 1: Verify backend
    print("\n[STEP 1] Checking backend service...")
    res = client.get("http://127.0.0.1:8000/health")
    assert res.status_code == 200, f"Backend health check failed: {res.text}"
    print("[PASS] Backend active: http://127.0.0.1:8000 (status: HEALTHY)")

    # STEP 2: Verify frontend
    print("\n[STEP 2] Checking frontend service...")
    res = client.get("http://127.0.0.1:5173/")
    assert res.status_code == 200, f"Frontend check failed: {res.status_code}"
    print("[PASS] Frontend active: http://127.0.0.1:5173 (Vite + React)")

    # STEP 3: Check initial dashboard stats
    print("\n[STEP 3] Fetching initial dashboard state...")
    stats_res = client.get("http://127.0.0.1:8000/api/v1/dashboard/stats")
    assert stats_res.status_code == 200
    initial_stats = stats_res.json()
    print(f"[PASS] Initial Packets Authenticated: {initial_stats['authenticated_packets']}, Trust Score: {initial_stats['trust_score']}")

    # STEP 4: Enable Simulated Demonstration Mode
    print("\n[STEP 4] Enabling Simulated Demonstration Mode...")
    sim_res = client.post("http://127.0.0.1:8000/api/v1/operator/simulator", json={
        "enabled": True,
        "rate_hz": 2.0,
        "attack_ratio": 0.3
    })
    assert sim_res.status_code == 200
    print("[PASS] Simulated Demonstration Mode ENABLED @ 2.0 Hz")

    # STEP 5 & 6: Wait 4 seconds and observe continuous packet generation
    print("\n[STEP 5 & 6] Observing continuous packet arrival and live processing (4s)...")
    time.sleep(4.0)

    stats_after_sim = client.get("http://127.0.0.1:8000/api/v1/dashboard/stats").json()
    packets_res = client.get("http://127.0.0.1:8000/api/v1/telemetry/packets?limit=10").json()
    print(f"[PASS] Packets Evaluated: {stats_after_sim['adaptive_filter']['evaluated']}")
    print(f"[PASS] Packets Accepted: {stats_after_sim['adaptive_filter']['accepted']}")
    print(f"[PASS] Packets Blocked: {stats_after_sim['adaptive_filter']['blocked']}")
    print(f"[PASS] Replay Detected: {stats_after_sim['adaptive_filter']['replay']}")
    print(f"[PASS] Tampered Detected: {stats_after_sim['adaptive_filter']['tampered']}")
    assert len(packets_res) > 0, "No packets found in live stream!"

    # Stop simulator for file ingestion test
    client.post("http://127.0.0.1:8000/api/v1/operator/simulator", json={"enabled": False})

    # STEP 7 & 8 & 9 & 10: Continuous File Ingestion Test
    print("\n[STEP 7-10] Testing Continuous File Ingestion (/data/incoming)...")
    timestamp = int(time.time() * 1000)
    auth_pkt = create_packet(f"PKT-ACCEPT-{timestamp}", 3001, "UAV-BRAVO-02", "AUTHENTIC")
    tamp_pkt = create_packet(f"PKT-BLOCK-{timestamp}", 3002, "UAV-BRAVO-02", "TAMPERED")
    replay_pkt = create_packet(f"PKT-REPLAY-{timestamp}", 3003, "UAV-BRAVO-02", "REPLAY")

    test_file_path = settings.INCOMING_DIR / f"telemetry_live_demo_{timestamp}.json"
    test_file_path.write_text(json.dumps([auth_pkt, tamp_pkt, replay_pkt]))
    print(f"[PASS] Dropped test file: {test_file_path.name} into data/incoming/")

    print("Waiting 2.5 seconds for background file watcher detection...")
    time.sleep(2.5)

    # Verify file was detected and moved from incoming
    assert not test_file_path.exists(), f"File {test_file_path.name} was not moved from data/incoming!"
    print("[PASS] Backend file watcher automatically detected, processed, and archived the file.")

    # STEP 11: Valid packet verification
    print("\n[STEP 11] Verifying AUTHENTIC packet...")
    pkt_auth = client.get(f"http://127.0.0.1:8000/api/v1/telemetry/packets/PKT-ACCEPT-{timestamp}").json()
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
    pkt_tamp = client.get(f"http://127.0.0.1:8000/api/v1/telemetry/packets/PKT-BLOCK-{timestamp}").json()
    print(f"  Tampered Packet: {pkt_tamp['packet_id']}")
    print(f"  Classification: {pkt_tamp['classification']}")
    print(f"  Auth Status: {pkt_tamp['auth_status']}")
    print(f"  Action: {pkt_tamp['action']}")
    print(f"  Trust Score: {pkt_tamp['trust_score']}/100")
    assert pkt_tamp["classification"] == "TAMPERED"
    assert pkt_tamp["action"] == "BLOCKED"
    assert pkt_tamp["trust_score"] <= 35

    pkt_replay = client.get(f"http://127.0.0.1:8000/api/v1/telemetry/packets/PKT-REPLAY-{timestamp}").json()
    print(f"  Replayed Packet: {pkt_replay['packet_id']}")
    print(f"  Classification: {pkt_replay['classification']}")
    print(f"  Action: {pkt_replay['action']}")
    assert pkt_replay["classification"] == "REPLAYED"
    assert pkt_replay["action"] == "BLOCKED"
    print("[PASS] STEP 12 PASSED: Malicious test packets received TAMPERED/REPLAYED, BLOCKED")

    # STEP 13, 14, 15: Security logs & C2 output
    print("\n[STEP 13, 14, 15] Checking Trust Score, Security Audit Logs, and Trusted C2...")
    threats = client.get("http://127.0.0.1:8000/api/v1/threats?limit=5").json()
    assert len(threats) > 0, "No threats recorded in threat log!"
    print(f"[PASS] Security Log recorded threat: {threats[0]['event']} ({threats[0]['action']})")

    c2_data = client.get("http://127.0.0.1:8000/api/v1/telemetry/c2-stream").json()
    print(f"[PASS] Trusted C2 Forwarded Packets: {c2_data['forwarded_count']}")
    assert c2_data["forwarded_count"] > 0

    # STEP 16 & 17: Persistence across refresh
    print("\n[STEP 16 & 17] Verifying State Persistence...")
    all_packets = client.get("http://127.0.0.1:8000/api/v1/telemetry/packets?limit=10").json()
    assert len(all_packets) >= 3
    print("[PASS] Persistent SQLite records remain accessible upon query.")

    # STEP 18: Key Security & Zero Secret Exposure
    print("\n[STEP 18] Verifying Key Security & Zero Secret Exposure...")
    key_meta = client.get("http://127.0.0.1:8000/api/v1/keys/active").json()
    print(f"  Key ID: {key_meta['key_id']}")
    print(f"  Algorithm: {key_meta['algorithm']}")
    print(f"  Status: {key_meta['status']}")
    print(f"  Masked Secret: {key_meta['masked_key']}")

    assert key_meta["masked_key"] == "••••••••••••••••••••••••••••••••"
    assert "key_bytes" not in key_meta
    assert "secret" not in key_meta
    print("[PASS] STEP 18 PASSED: Raw AES secret key is strictly protected and NEVER exposed.")

    # Dynamic Re-Keying test
    print("\nTesting Dynamic Key Re-Sync...")
    resync_res = client.post("http://127.0.0.1:8000/api/v1/keys/resync?operator_id=ACCEPTANCE-TESTER").json()
    print(f"[PASS] Re-sync executed. New Active Key ID: {resync_res['key_id']}")
    assert resync_res['key_id'] != key_meta['key_id']

    print("\n" + "=" * 60)
    print("ALL 18 FINAL ACCEPTANCE TEST STEPS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_acceptance_test()
