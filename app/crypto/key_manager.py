import os
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import logger

def derive_session_key(key_id: str) -> bytes:
    """
    Tactical Key Derivation Function (KDF) for laboratory demonstration.
    Derives deterministic 256-bit symmetric key per Key ID from tactical master seed.
    """
    master_seed = os.environ.get("SECURELINK_MASTER_KEY", "SECURELINK_TACTICAL_LAB_MASTER_KEY_V1").encode('utf-8')
    return hashlib.sha256(master_seed + b":" + key_id.encode('utf-8')).digest()

class KeyManager:
    """
    Manages cryptographic session keys with zero secret leakage.
    Maintains active AES-256-GCM session keys, key rotation intervals,
    and safe metadata projection for the UI and external APIs.
    """
    
    def __init__(self):
        self._key_counter = 42
        self._active_key_id = f"SK-ALPHA-{self._key_counter:03d}"
        self._active_key_bytes = derive_session_key(self._active_key_id)
        self._created_at = datetime.now(timezone.utc)
        self._last_sync_at = datetime.now(timezone.utc)
        self._rotation_interval = timedelta(seconds=settings.ROTATION_INTERVAL_SECONDS)
        self._status = "ACTIVE"
        self._purpose = "Tactical Telemetry Encryption & Authentication"
        self._algorithm = "AES-256-GCM"
        self._curve = "NIST P-256 (secp256r1)"
        
        # Historical key cache for grace-period verification
        self._key_archive: Dict[str, bytes] = {
            self._active_key_id: self._active_key_bytes
        }
        logger.info(f"Initialized KeyManager. Active Key ID: {self._active_key_id} (secret protected)")

    @property
    def active_key_id(self) -> str:
        return self._active_key_id

    def get_key_bytes(self, key_id: Optional[str] = None) -> Optional[bytes]:
        """Internal backend only. Never expose to API or frontend."""
        target_id = key_id or self._active_key_id
        if target_id in self._key_archive:
            return self._key_archive[target_id]
        
        # Derive if valid tactical format
        if target_id.startswith("SK-ALPHA-"):
            derived = derive_session_key(target_id)
            self._key_archive[target_id] = derived
            return derived
            
        return None

    def resync_key(self, operator_id: str = "OPERATOR-PRIMARY") -> Dict[str, Any]:
        """
        Rotates the active AES-256 session key dynamically upon operator re-sync command.
        Archive old key for grace period, generate new key, update timestamps.
        """
        self._key_counter += 1
        new_key_id = f"SK-ALPHA-{self._key_counter:03d}"
        new_key = derive_session_key(new_key_id)
        
        self._active_key_id = new_key_id
        self._active_key_bytes = new_key
        self._key_archive[new_key_id] = new_key
        self._created_at = datetime.now(timezone.utc)
        self._last_sync_at = datetime.now(timezone.utc)
        
        logger.info(f"Dynamic re-keying completed by {operator_id}. New Active Key ID: {new_key_id}")
        return self.get_safe_metadata()

    def get_safe_metadata(self) -> Dict[str, Any]:
        """
        Returns SAFE metadata for UI display.
        Strictly masks the secret key as bullet characters.
        """
        now = datetime.now(timezone.utc)
        next_rotation = self._created_at + self._rotation_interval
        seconds_remaining = max(0, int((next_rotation - now).total_seconds()))
        
        return {
            "key_id": self._active_key_id,
            "algorithm": self._algorithm,
            "signature_algorithm": self._curve,
            "status": self._status,
            "purpose": self._purpose,
            "rotation_status": "READY",
            "created_at": self._created_at.isoformat(),
            "last_sync": self._last_sync_at.isoformat(),
            "next_rotation": next_rotation.isoformat(),
            "rotation_seconds_remaining": seconds_remaining,
            "masked_key": "••••••••••••••••••••••••••••••••",
            "environment_note": "Safe Demonstration / Laboratory Key - Secret Protected in Backend Memory"
        }

key_manager = KeyManager()
