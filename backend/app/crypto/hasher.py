import hashlib

class SHA256Hasher:
    """
    SHA-256 cryptographic digest calculator for packet integrity.
    """
    
    @staticmethod
    def digest(data: bytes) -> str:
        """Returns lowercase hex-encoded SHA-256 digest."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def verify(data: bytes, expected_hex: str) -> bool:
        """Verifies binary data against expected hex-encoded SHA-256 digest."""
        computed = hashlib.sha256(data).hexdigest()
        return computed.lower() == expected_hex.lower()
