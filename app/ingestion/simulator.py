import asyncio
import time
import json
import random
import os
from typing import Dict, Any, List
from app.core.config import settings
from app.core.logging import logger
from app.crypto.aes_gcm import AESGCMProcessor
from app.crypto.ecdsa_signer import ecdsa_processor
from app.crypto.hasher import SHA256Hasher
from app.crypto.key_manager import key_manager
from app.processing.pipeline import pipeline

class TelemetrySimulator:
    """
    Simulated Demonstration Mode generator.
    Continuously produces realistic tactical telemetry with authentic vectors
    and configurable laboratory attack-injection scenarios (Replay, Tamper, Invalid Sig, Integrity Fail).
    Every packet is passed into the SAME multi-stage pipeline as live input.
    """
    
    def __init__(self):
        self.enabled = settings.DEMO_DEFAULT_ENABLED
        self.rate_hz = settings.DEMO_DEFAULT_RATE_HZ
        self.attack_ratio = settings.DEMO_DEFAULT_ATTACK_RATIO
        self.sources = ["UAV-ALPHA-01", "UAV-BRAVO-02", "UGV-SIERRA-03", "BASE-RELAY-04"]
        self._task: asyncio.Task = None
        self._sequence_counters: Dict[str, int] = {s: 1880 for s in self.sources}
        self._history_nonces: List[Dict[str, Any]] = []

    def set_config(self, enabled: bool, rate_hz: float = 1.0, attack_ratio: float = 0.25, sources: List[str] = None):
        self.enabled = enabled
        self.rate_hz = max(0.2, min(rate_hz, 10.0))
        self.attack_ratio = max(0.0, min(attack_ratio, 1.0))
        if sources:
            self.sources = sources
        logger.info(f"Simulator config updated: enabled={self.enabled}, rate={self.rate_hz}Hz, attack_ratio={self.attack_ratio}")

    def reset_run(self):
        """Resets sequence counters and history nonces for a fresh demonstration run."""
        self._sequence_counters = {s: 1880 for s in self.sources}
        self._history_nonces = []
        logger.info("Simulator: Run counters and history reset for fresh run.")

    async def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run_loop())
            logger.info("Telemetry Simulator background worker started.")

    async def stop(self):
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            logger.info("Telemetry Simulator background worker stopped.")

    async def _run_loop(self):
        while True:
            try:
                if self.enabled and not pipeline.stream_paused:
                    raw_packet = self._generate_packet()
                    await pipeline.process_packet(raw_packet)
                
                # Sleep interval based on rate_hz
                interval = 1.0 / self.rate_hz if self.rate_hz > 0 else 1.0
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in Telemetry Simulator loop: {e}", exc_info=True)
                await asyncio.sleep(1.0)

    def _generate_packet(self) -> Dict[str, Any]:
        source = random.choice(self.sources)
        self._sequence_counters[source] += 1
        sequence_num = self._sequence_counters[source]
        now = time.time()
        packet_id = f"PKT-{sequence_num}"
        active_key_id = key_manager.active_key_id
        active_key = key_manager.get_key_bytes()

        # Telemetry payload
        base_lat = 34.0522 + (random.random() - 0.5) * 0.05
        base_lon = -118.2437 + (random.random() - 0.5) * 0.05
        payload_data = {
            "latitude": round(base_lat, 6),
            "longitude": round(base_lon, 6),
            "altitude_m": round(random.uniform(120.0, 450.0), 1),
            "speed_mps": round(random.uniform(15.0, 42.0), 1),
            "heading_deg": round(random.uniform(0.0, 360.0), 1),
            "battery_pct": round(random.uniform(45.0, 99.0), 1),
            "pitch_deg": round(random.uniform(-5.0, 8.0), 1),
            "roll_deg": round(random.uniform(-4.0, 4.0), 1),
            "link_quality": random.randint(88, 100),
            "flight_mode": "AUTONOMOUS_NAV"
        }
        plaintext_bytes = json.dumps(payload_data, sort_keys=True).encode('utf-8')
        payload_hash = SHA256Hasher.digest(plaintext_bytes)
        
        # Determine scenario
        is_attack = random.random() < self.attack_ratio
        attack_scenario = None
        if is_attack:
            attack_scenario = random.choice(["REPLAY", "TAMPERED", "INVALID_SIG", "INTEGRITY_FAIL"])

        # Base authentic encryption
        associated_data = f"{packet_id}:{source}".encode('utf-8')
        ciphertext, iv, tag = AESGCMProcessor.encrypt(
            key=active_key,
            plaintext=plaintext_bytes,
            associated_data=associated_data
        )

        signed_data = f"{packet_id}:{sequence_num}:{source}:{now:.3f}:{payload_hash}".encode('utf-8')
        signature = ecdsa_processor.sign(source, signed_data)

        # Apply laboratory attack vector modifications
        timestamp_to_use = now
        iv_to_use = iv.hex()
        tag_to_use = tag.hex()
        ciphertext_to_use = ciphertext.hex()
        signature_to_use = signature.hex()
        hash_to_use = payload_hash

        if attack_scenario == "REPLAY":
            if self._history_nonces and random.random() < 0.6:
                # Re-use past recorded IV/nonce
                reused = random.choice(self._history_nonces)
                iv_to_use = reused["iv"]
                source = reused["source"]
            else:
                # Stale timestamp (15 seconds in past)
                timestamp_to_use = now - random.uniform(12.0, 30.0)
        elif attack_scenario == "TAMPERED":
            # Flip bits in ciphertext or corrupt authentication tag
            ct_bytes = bytearray(ciphertext)
            if ct_bytes:
                ct_bytes[0] ^= 0xFF
            ciphertext_to_use = ct_bytes.hex()
        elif attack_scenario == "INVALID_SIG":
            # Corrupt signature bytes
            sig_bytes = bytearray(signature)
            if len(sig_bytes) > 4:
                sig_bytes[2] ^= 0xAA
                sig_bytes[3] ^= 0x55
            signature_to_use = sig_bytes.hex()
        elif attack_scenario == "INTEGRITY_FAIL":
            # Modify declared payload hash
            hash_to_use = SHA256Hasher.digest(b"corrupted_payload_digest")

        # Cache for potential replay injection
        if attack_scenario is None:
            self._history_nonces.append({"iv": iv_to_use, "source": source})
            if len(self._history_nonces) > 50:
                self._history_nonces.pop(0)

        return {
            "packet_id": packet_id,
            "sequence_num": sequence_num,
            "source": source,
            "timestamp": timestamp_to_use,
            "packet_type": "Telemetry",
            "key_id": active_key_id,
            "iv": iv_to_use,
            "tag": tag_to_use,
            "ciphertext": ciphertext_to_use,
            "signature": signature_to_use,
            "payload_hash": hash_to_use,
            "simulated": True
        }

simulator = TelemetrySimulator()
