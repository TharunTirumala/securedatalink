import pytest
import json
from app.crypto.aes_gcm import AESGCMProcessor
from app.crypto.ecdsa_signer import ecdsa_processor
from app.crypto.hasher import SHA256Hasher

def test_aes_gcm_encryption_and_authentication():
    key = AESGCMProcessor.generate_key()
    plaintext = b'{"latitude": 34.05, "longitude": -118.25, "altitude": 200.0}'
    associated_data = b"PKT-1001:UAV-ALPHA-01"

    ciphertext, iv, tag = AESGCMProcessor.encrypt(key, plaintext, associated_data)
    assert len(iv) == 12
    assert len(tag) == 16
    assert len(ciphertext) == len(plaintext)

    # Decrypt and authenticate
    is_auth, decrypted, msg = AESGCMProcessor.decrypt_and_authenticate(
        key, iv, ciphertext, tag, associated_data
    )
    assert is_auth is True
    assert decrypted == plaintext

def test_aes_gcm_tamper_detection():
    key = AESGCMProcessor.generate_key()
    plaintext = b"Tactical payload"
    associated_data = b"AAD"

    ciphertext, iv, tag = AESGCMProcessor.encrypt(key, plaintext, associated_data)
    
    # Tamper with 1 byte of ciphertext
    tampered_ct = bytearray(ciphertext)
    tampered_ct[0] ^= 0x01
    
    is_auth, decrypted, msg = AESGCMProcessor.decrypt_and_authenticate(
        key, iv, bytes(tampered_ct), tag, associated_data
    )
    assert is_auth is False
    assert decrypted is None
    assert "tampering detected" in msg

def test_ecdsa_signature_verification():
    node_id = "UAV-BRAVO-02"
    message = b"PKT-1002:UAV-BRAVO-02:1700000000.000:hash123"

    signature = ecdsa_processor.sign(node_id, message)
    is_valid, msg = ecdsa_processor.verify(node_id, signature, message)
    assert is_valid is True

    # Corrupt signature
    bad_sig = bytearray(signature)
    bad_sig[2] ^= 0xFF
    is_valid_bad, _ = ecdsa_processor.verify(node_id, bytes(bad_sig), message)
    assert is_valid_bad is False

def test_sha256_integrity_hasher():
    data = b"Tactical Telemetry Integrity Check"
    expected_digest = SHA256Hasher.digest(data)
    assert len(expected_digest) == 64
    assert SHA256Hasher.verify(data, expected_digest) is True
    assert SHA256Hasher.verify(b"different data", expected_digest) is False
