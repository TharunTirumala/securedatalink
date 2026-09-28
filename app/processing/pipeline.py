import time
import json
import base64
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.core.logging import logger
from app.crypto.aes_gcm import AESGCMProcessor
from app.crypto.ecdsa_signer import ecdsa_processor
from app.crypto.hasher import SHA256Hasher
from app.crypto.key_manager import key_manager
from app.processing.freshness import freshness_verifier
from app.processing.classifier import packet_classifier
from app.processing.trust_score import trust_score_engine
from app.processing.adaptive_filter import adaptive_filter
from app.services.audit_service import audit_service
from app.services.c2_service import c2_service
from app.services.ws_manager import ws_manager
from app.database.connection import async_session
from app.database.models import PacketRecord

# Registered authorized tactical nodes
AUTHORIZED_NODES = {
    "UAV-ALPHA-01",
    "UAV-BRAVO-02",
    "UGV-SIERRA-03",
    "BASE-RELAY-04",
    "SYS-RELAY-DEFAULT",
    "TACTICAL-TEST-NODE",
    "CUSTOM-001",
    "UAV-001"
}

class TacticalProcessingPipeline:
    """
    Executes the strict 10-stage cyber-security tactical datalink pipeline.
    """
    
    def __init__(self):
        self.stream_paused = False

    async def initialize_state(self):
        from app.database.connection import get_system_state
        state = await get_system_state("stream_status", "ACTIVE")
        self.stream_paused = (state == "PAUSED")
        if self.stream_paused:
            logger.info("Restored stream state: PAUSED")
        else:
            logger.info("Restored stream state: ACTIVE")

    async def pause_stream(self):
        from app.database.connection import set_system_state
        self.stream_paused = True
        await set_system_state("stream_status", "PAUSED")
        logger.warning("Pipeline: Stream PAUSED by operator command")

    async def resume_stream(self):
        from app.database.connection import set_system_state
        self.stream_paused = False
        await set_system_state("stream_status", "ACTIVE")
        logger.info("Pipeline: Stream RESUMED by operator command")


    async def process_packet(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes a single tactical datalink packet through all stages.
        """
        start_time = time.perf_counter()
        
        # -------------------------------------------------------------
        # Stage 1: Signal Ingestion
        # -------------------------------------------------------------
        packet_id = str(raw_data.get("packet_id", f"PKT-{int(time.time()*1000)%1000000}"))
        sequence_num = int(raw_data.get("sequence_num", 0))
        source = str(raw_data.get("source", "UNKNOWN"))
        packet_timestamp = float(raw_data.get("timestamp", time.time()))
        packet_type = str(raw_data.get("packet_type", "Telemetry"))
        key_id = str(raw_data.get("key_id", key_manager.active_key_id))
        simulated = bool(raw_data.get("simulated", False))
        
        # -------------------------------------------------------------
        # Stage 2: Preprocessing
        # -------------------------------------------------------------
        iv_hex = raw_data.get("iv", "")
        tag_hex = raw_data.get("tag", "")
        ciphertext_hex = raw_data.get("ciphertext", "")
        signature_hex = raw_data.get("signature", "")
        payload_hash = raw_data.get("payload_hash", "")
        
        format_valid = bool(iv_hex and tag_hex and ciphertext_hex and signature_hex and payload_hash)
        
        # Check stream pause
        if self.stream_paused and not raw_data.get("allow_custom_ingest", False):
            logger.info(f"Packet {packet_id} skipped: Stream is currently paused by operator")
            return {
                "packet_id": packet_id,
                "action": "FILTERED",
                "classification": "FILTERED",
                "status": "STREAM_PAUSED"
            }

        # -------------------------------------------------------------
        # Stage 3: Dynamic Nonce / Freshness Check
        # -------------------------------------------------------------
        is_fresh = False
        is_unique_nonce = False
        freshness_status = "FAIL"
        
        if format_valid:
            is_fresh, is_unique_nonce, fresh_msg = freshness_verifier.verify(
                source=source,
                nonce=iv_hex,
                packet_time=packet_timestamp
            )
            freshness_status = "PASS" if (is_fresh and is_unique_nonce) else "FAIL"
        else:
            fresh_msg = "Format invalid: cannot parse nonce"

        # -------------------------------------------------------------
        # Stage 4: AES-256-GCM Authentication / Decryption
        # -------------------------------------------------------------
        auth_verified = False
        auth_status = "FAILED"
        decrypted_payload = None
        key_bytes = key_manager.get_key_bytes(key_id)
        
        if format_valid and key_bytes:
            try:
                iv_bytes = bytes.fromhex(iv_hex)
                tag_bytes = bytes.fromhex(tag_hex)
                ciphertext_bytes = bytes.fromhex(ciphertext_hex)
                associated_data = f"{packet_id}:{source}".encode('utf-8')
                
                is_auth, plaintext_bytes, auth_msg = AESGCMProcessor.decrypt_and_authenticate(
                    key=key_bytes,
                    iv=iv_bytes,
                    ciphertext=ciphertext_bytes,
                    tag=tag_bytes,
                    associated_data=associated_data
                )
                if is_auth and plaintext_bytes:
                    auth_verified = True
                    auth_status = "VERIFIED"
                    try:
                        decrypted_payload = json.loads(plaintext_bytes.decode('utf-8'))
                    except Exception:
                        decrypted_payload = {"raw": plaintext_bytes.hex()}
                else:
                    auth_status = "FAILED"
            except Exception as e:
                auth_status = "FAILED"
                auth_msg = f"Hex decode or decryption failure: {str(e)}"
        else:
            auth_status = "FAILED"
            auth_msg = "Missing key or invalid frame format"

        # -------------------------------------------------------------
        # Stage 5: ECDSA Signature Verification
        # -------------------------------------------------------------
        sig_verified = False
        sig_status = "INVALID"
        
        if format_valid:
            try:
                sig_bytes = bytes.fromhex(signature_hex)
                # Signature is calculated over standard header elements + payload hash
                signed_data = f"{packet_id}:{sequence_num}:{source}:{packet_timestamp:.3f}:{payload_hash}".encode('utf-8')
                sig_ok, sig_msg = ecdsa_processor.verify(source, sig_bytes, signed_data)
                if sig_ok:
                    sig_verified = True
                    sig_status = "VERIFIED"
                else:
                    sig_status = "INVALID"
            except Exception as e:
                sig_status = "INVALID"
                sig_msg = f"Signature decode error: {str(e)}"
        else:
            sig_status = "SKIPPED"
            sig_msg = "Format invalid"

        # -------------------------------------------------------------
        # Stage 6: Integrity Check (SHA-256)
        # -------------------------------------------------------------
        integrity_passed = False
        integrity_status = "FAIL"
        
        if auth_verified and decrypted_payload is not None:
            # Recompute digest over the decrypted plaintext
            reconstructed_bytes = json.dumps(decrypted_payload, sort_keys=True).encode('utf-8')
            if SHA256Hasher.verify(reconstructed_bytes, payload_hash):
                integrity_passed = True
                integrity_status = "PASS"
            else:
                integrity_status = "FAIL"
        elif format_valid and payload_hash:
            # Check if payload_hash exists and is valid 64-char hex
            integrity_status = "FAIL"

        # -------------------------------------------------------------
        # Stage 7: Packet Classification
        # -------------------------------------------------------------
        source_authorized = bool(
            source
            and source != "UNKNOWN"
            and not adaptive_filter.is_source_filtered(source)
            and len(source) <= 64
        )
        is_source_filtered = adaptive_filter.is_source_filtered(source)
        
        classification, action = packet_classifier.classify(
            format_valid=format_valid,
            is_fresh=is_fresh,
            is_unique_nonce=is_unique_nonce,
            auth_verified=auth_verified,
            sig_verified=sig_verified,
            integrity_passed=integrity_passed,
            source_authorized=source_authorized,
            is_source_filtered=is_source_filtered
        )

        # -------------------------------------------------------------
        # Stage 8: Trust Assessment (0 - 100)
        # -------------------------------------------------------------
        trust_result = trust_score_engine.calculate(
            auth_ok=auth_verified,
            sig_ok=sig_verified,
            fresh_ok=is_fresh,
            replay_ok=is_unique_nonce,
            integrity_ok=integrity_passed,
            source_ok=source_authorized and not is_source_filtered
        )
        trust_score = trust_result["score"]

        # -------------------------------------------------------------
        # Stage 9: Adaptive Filtering
        # -------------------------------------------------------------
        adaptive_filter.update_metrics(classification, action)

        # -------------------------------------------------------------
        # Stage 10: Output Decision & Distribution
        # -------------------------------------------------------------
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        created_at_dt = datetime.now(timezone.utc)
        created_at_iso = created_at_dt.isoformat()

        if action == "ACCEPTED":
            reason = "Cryptographically authenticated & verified (AES-256-GCM + ECDSA P-256 + SHA-256)"
        elif classification == "REPLAYED":
            reason = fresh_msg if 'fresh_msg' in locals() and fresh_msg else "Replay attack detected (stale timestamp or reused nonce)"
        elif classification == "TAMPERED":
            reason = auth_msg if 'auth_msg' in locals() and auth_msg else "AES-256-GCM authentication tag mismatch (tampering detected)"
        elif classification == "INVALID SIGNATURE":
            reason = sig_msg if 'sig_msg' in locals() and sig_msg else "ECDSA P-256 digital signature invalid"
        elif classification == "INTEGRITY FAILURE":
            reason = "SHA-256 payload digest mismatch"
        elif classification == "INVALID FORMAT":
            reason = "Missing or malformed cryptographic frame attributes"
        elif classification == "FILTERED":
            reason = f"Source node '{source}' filtered by tactical link security policy"
        else:
            reason = f"Security verification failed ({classification})"
        
        result_dict = {
            "packet_id": packet_id,
            "sequence_num": sequence_num,
            "source": source,
            "timestamp": packet_timestamp,
            "packet_type": packet_type,
            "key_id": key_id,
            "iv_hex": iv_hex,
            "tag_hex": tag_hex,
            "ciphertext_preview": (ciphertext_hex[:32] + "...") if len(ciphertext_hex) > 32 else ciphertext_hex,
            "signature_hex": (signature_hex[:32] + "...") if len(signature_hex) > 32 else signature_hex,
            "payload_hash": payload_hash,
            "auth_status": auth_status,
            "freshness_status": freshness_status,
            "sig_status": sig_status,
            "integrity_status": integrity_status,
            "classification": classification,
            "trust_score": trust_score,
            "trust_details": trust_result,
            "action": action,
            "reason": reason,
            "latency_ms": latency_ms,
            "decrypted_payload": decrypted_payload,
            "simulated": simulated,
            "created_at": created_at_iso
        }

        # Forward to Trusted C2 if ACCEPTED
        if action == "ACCEPTED":
            c2_service.forward_packet(result_dict)
        else:
            c2_service.record_dropped(action)

        # Persist to database
        try:
            async with async_session() as session:
                record = PacketRecord(
                    packet_id=packet_id,
                    sequence_num=sequence_num,
                    source=source,
                    timestamp=packet_timestamp,
                    packet_type=packet_type,
                    key_id=key_id,
                    iv_hex=iv_hex,
                    tag_hex=tag_hex,
                    ciphertext_preview=result_dict["ciphertext_preview"],
                    signature_hex=signature_hex,
                    payload_hash=payload_hash,
                    decrypted_payload=decrypted_payload,
                    auth_status=auth_status,
                    freshness_status=freshness_status,
                    sig_status=sig_status,
                    integrity_status=integrity_status,
                    classification=classification,
                    trust_score=trust_score,
                    trust_details=trust_result,
                    action=action,
                    reason=reason,
                    latency_ms=latency_ms,
                    simulated=simulated,
                    created_at=created_at_dt
                )
                session.add(record)
                await session.commit()
                await session.refresh(record)
                result_dict["id"] = record.id
        except Exception as e:
            logger.error(f"Failed to persist packet {packet_id} to DB: {e}")

        # Security Logging & Threat Detection
        if action in ["BLOCKED", "REJECTED", "FILTERED"]:
            severity = "CRITICAL" if classification in ["TAMPERED", "REPLAYED"] else "WARNING"
            await audit_service.log_threat_event(
                packet_id=packet_id,
                source=source,
                event=f"Security violation detected: {classification}",
                severity=severity,
                action=action,
                details={
                    "trust_score": trust_score,
                    "auth": auth_status,
                    "sig": sig_status,
                    "freshness": freshness_status,
                    "integrity": integrity_status,
                    "simulated": simulated
                }
            )
            await ws_manager.broadcast("threat_detected", {
                "packet_id": packet_id,
                "source": source,
                "event": f"{classification} - {action}",
                "severity": severity,
                "action": action,
                "timestamp": created_at_iso,
                "trust_score": trust_score
            })
        else:
            # Audit log for authentic arrival
            await audit_service.log_security_event(
                event_type="PACKET_AUTHENTICATED",
                severity="INFO",
                source=source,
                packet_id=packet_id,
                description=f"Packet #{sequence_num} authenticated from {source} (Trust: {trust_score}/100)"
            )

        # Broadcast packet outcome over WebSocket
        await ws_manager.broadcast("packet_processed", result_dict)
        return result_dict

pipeline = TacticalProcessingPipeline()
