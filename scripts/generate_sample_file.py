import sys
import os
import json
import time
import argparse
from pathlib import Path

# Add project root to sys.path so app packages resolve correctly
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.crypto.aes_gcm import AESGCMProcessor
from app.crypto.ecdsa_signer import ecdsa_processor
from app.crypto.hasher import SHA256Hasher
from app.crypto.key_manager import key_manager
from app.core.config import settings

def create_packet(
    packet_id: str,
    seq: int,
    source: str,
    scenario: str = "AUTHENTIC",
    key_id: str | None = None,
    replayed_from: dict | None = None
) -> dict:
    active_key = key_manager.get_key_bytes()
    effective_key_id = key_id or key_manager.active_key_id
    now = time.time()
    
    if scenario == "TRUE_REPLAY" and replayed_from:
        # Exact replay of previously recorded authentic packet
        return {
            "packet_id": f"{replayed_from['packet_id']}-REPLAY",
            "sequence_num": replayed_from["sequence_num"],
            "source": replayed_from["source"],
            "timestamp": replayed_from["timestamp"],
            "packet_type": replayed_from.get("packet_type", "Telemetry"),
            "key_id": replayed_from.get("key_id", effective_key_id),
            "iv": replayed_from["iv"],
            "tag": replayed_from["tag"],
            "ciphertext": replayed_from["ciphertext"],
            "signature": replayed_from["signature"],
            "payload_hash": replayed_from["payload_hash"],
            "simulated": False
        }

    payload = {
        "latitude": 34.0537,
        "longitude": -118.2427,
        "altitude_m": 240.5,
        "speed_mps": 28.4,
        "heading_deg": 142.0,
        "battery_pct": 87.5,
        "pitch_deg": 1.2,
        "roll_deg": -0.8,
        "link_quality": 96,
        "flight_mode": "WAYPOINT_TRANSIT"
    }
    plaintext_bytes = json.dumps(payload, sort_keys=True).encode('utf-8')
    payload_hash = SHA256Hasher.digest(plaintext_bytes)
    
    associated_data = f"{packet_id}:{source}".encode('utf-8')
    ciphertext, iv, tag = AESGCMProcessor.encrypt(
        key=active_key,
        plaintext=plaintext_bytes,
        associated_data=associated_data
    )
    
    signed_data = f"{packet_id}:{seq}:{source}:{now:.3f}:{payload_hash}".encode('utf-8')
    signature = ecdsa_processor.sign(source, signed_data)
    
    ts = now
    iv_hex = iv.hex()
    tag_hex = tag.hex()
    ct_hex = ciphertext.hex()
    sig_hex = signature.hex()
    hash_hex = payload_hash
    
    if scenario == "REPLAY":
        # Stale timestamp (outside sliding freshness window)
        ts = now - 30.0
    elif scenario == "TAMPERED":
        # Inverted byte in ciphertext
        ct_bytes = bytearray(ciphertext)
        ct_bytes[0] ^= 0x55
        ct_hex = ct_bytes.hex()
    elif scenario == "INVALID_SIG":
        sig_bytes = bytearray(signature)
        sig_bytes[0] ^= 0xAA
        sig_hex = sig_bytes.hex()
    elif scenario == "INTEGRITY_FAIL":
        hash_hex = SHA256Hasher.digest(b"altered_content")
        
    return {
        "packet_id": packet_id,
        "sequence_num": seq,
        "source": source,
        "timestamp": ts,
        "packet_type": "Telemetry",
        "key_id": effective_key_id,
        "iv": iv_hex,
        "tag": tag_hex,
        "ciphertext": ct_hex,
        "signature": sig_hex,
        "payload_hash": hash_hex,
        "simulated": False
    }

def atomic_write_json(file_path: Path, data: list):
    """Writes to a temporary file first, then atomically renames to prevent partial reads."""
    temp_path = file_path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(temp_path, file_path)

def main():
    parser = argparse.ArgumentParser(description="SecureLink Tactical Telemetry Sample Generator")
    parser.add_argument("--samples", action="store_true", help="Write sample files to data/samples instead of data/incoming")
    parser.add_argument("--source", default="UAV-BRAVO-02", help="Tactical source node identifier")
    args = parser.parse_args()

    dest_dir = settings.SAMPLES_DIR if args.samples else settings.INCOMING_DIR
    dest_dir.mkdir(parents=True, exist_ok=True)
    timestamp_str = int(time.time())
    
    # 1. Authentic telemetry packet
    auth_packet = create_packet(f"PKT-AUTH-{timestamp_str}", 2001, args.source, "AUTHENTIC")
    auth_file = dest_dir / f"telemetry_authentic_{timestamp_str}.json"
    atomic_write_json(auth_file, [auth_packet])
    print(f"Generated authentic file (atomic): {auth_file.name} in {dest_dir}")

    # 2. Tampered test packet
    tampered_packet = create_packet(f"PKT-TAMP-{timestamp_str}", 2002, args.source, "TAMPERED")
    tamp_file = dest_dir / f"telemetry_tampered_{timestamp_str}.json"
    atomic_write_json(tamp_file, [tampered_packet])
    print(f"Generated tampered file (atomic): {tamp_file.name} in {dest_dir}")

if __name__ == "__main__":
    main()
