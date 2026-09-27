import os
import base64
from typing import Tuple, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
from app.core.logging import logger

class AESGCMProcessor:
    """
    Cryptographic processor for AES-256-GCM authenticated encryption.
    Provides confidentiality, integrity, and authenticity for tactical telemetry.
    """
    
    @staticmethod
    def generate_key() -> bytes:
        """Generates a secure 256-bit (32 bytes) cryptographic key."""
        return AESGCM.generate_key(bit_length=256)

    @staticmethod
    def generate_iv() -> bytes:
        """Generates a standard 96-bit (12 bytes) initialization vector."""
        return os.urandom(12)

    @classmethod
    def encrypt(cls, key: bytes, plaintext: bytes, associated_data: Optional[bytes] = None, iv: Optional[bytes] = None) -> Tuple[bytes, bytes, bytes]:
        """
        Encrypts plaintext with AES-256-GCM.
        Returns: (ciphertext, iv, auth_tag)
        Note: AESGCM in pyca/cryptography appends the 16-byte tag to the ciphertext.
        We separate them for transparent tactical datalink frame formatting.
        """
        if iv is None:
            iv = cls.generate_iv()
        
        aesgcm = AESGCM(key)
        # combined contains ciphertext + 16-byte tag
        combined = aesgcm.encrypt(nonce=iv, data=plaintext, associated_data=associated_data)
        ciphertext = combined[:-16]
        tag = combined[-16:]
        return ciphertext, iv, tag

    @classmethod
    def decrypt_and_authenticate(cls, key: bytes, iv: bytes, ciphertext: bytes, tag: bytes, associated_data: Optional[bytes] = None) -> Tuple[bool, Optional[bytes], str]:
        """
        Verifies GCM authentication tag and decrypts payload.
        Returns: (is_authentic, plaintext_or_none, status_message)
        """
        try:
            aesgcm = AESGCM(key)
            combined = ciphertext + tag
            plaintext = aesgcm.decrypt(nonce=iv, data=combined, associated_data=associated_data)
            return True, plaintext, "AES-256-GCM authentication verified"
        except InvalidTag:
            return False, None, "AES-256-GCM authentication tag mismatch (tampering detected)"
        except Exception as e:
            return False, None, f"AES-256-GCM decryption failed: {str(e)}"
