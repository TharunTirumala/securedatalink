import sys
import os
import json
import time
from pathlib import Path

# Add backend to sys.path so we can use backend crypto libraries
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root / "backend"))

from app.crypto.aes_gcm import AESGCMProcessor
from app.crypto.ecdsa_signer import ecdsa_processor
from app.crypto.hasher import SHA256Hasher
from app.crypto.key_manager import key_manager
from app.core.config import settings

def create_packet(packet_id: str, seq: int, source: str, scenario: str = "AUTHENTIC", key_id: str = None) -> dict:
    active_key = key_manager.get_key_bytes()
    key_id = key_id or key_manager.active_key_id
    now = time.time()
    
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
        # Stale timestamp 30s ago
        ts = now - 30.0
    elif scenario == "TAMPERED":
        # Alter ciphertext
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
        "key_id": key_id,
        "iv": iv_hex,
        "tag": tag_hex,
        "ciphertext": ct_hex,
        "signature": sig_hex,
        "payload_hash": hash_hex,
        "simulated": False
    }

def main():
    dest_dir = settings.INCOMING_DIR
    if len(sys.argv) > 1 and sys.argv[1] == "--samples":
        dest_dir = settings.SAMPLES_DIR

    timestamp_str = int(time.time())
    
    # 1. Authentic packet file
    auth_packet = create_packet(f"PKT-AUTH-{timestamp_str}", 2001, "UAV-BRAVO-02", "AUTHENTIC")
    auth_file = dest_dir / f"telemetry_authentic_{timestamp_str}.json"
    auth_file.write_text(json.dumps([auth_packet], indent=2))
    print(f"Generated authentic file: {auth_file.name} in {dest_dir}")

    # 2. Tampered test packet
    tampered_packet = create_packet(f"PKT-TAMP-{timestamp_str}", 2002, "UAV-BRAVO-02", "TAMPERED")
    tamp_file = dest_dir / f"telemetry_tampered_{timestamp_str}.json"
    tamp_file.write_text(json.dumps([tampered_packet], indent=2))
    print(f"Generated tampered file: {tamp_file.name} in {dest_dir}")

if __name__ == "__main__":
    main()
