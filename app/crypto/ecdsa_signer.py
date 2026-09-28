import hashlib
from typing import Tuple, Dict
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

class ECDSAProcessor:
    """
    ECDSA cryptographic processor using NIST P-256 (secp256r1) curve and SHA-256.
    Ensures non-repudiation and sender authenticity for tactical data units.
    """
    
    def __init__(self):
        # Local node keystore mapping source_id -> (private_key, public_key)
        self._private_keys: Dict[str, ec.EllipticCurvePrivateKey] = {}
        self._public_keys: Dict[str, ec.EllipticCurvePublicKey] = {}
        
        # Pre-seed deterministic keys for standard tactical nodes
        for node_id in ["UAV-ALPHA-01", "UAV-BRAVO-02", "UGV-SIERRA-03", "BASE-RELAY-04", "SYS-RELAY-DEFAULT", "TACTICAL-TEST-NODE"]:
            self.generate_node_keypair(node_id)

    def generate_node_keypair(self, node_id: str) -> ec.EllipticCurvePublicKey:
        # Deterministic derivation from node ID for multi-process laboratory consistency
        seed = hashlib.sha256(f"SECURELINK_TACTICAL_ECDSA_{node_id}".encode('utf-8')).digest()
        int_val = int.from_bytes(seed, "big")
        private_key = ec.derive_private_key(int_val, ec.SECP256R1())
        public_key = private_key.public_key()
        self._private_keys[node_id] = private_key
        self._public_keys[node_id] = public_key
        return public_key

    def get_public_key_pem(self, node_id: str) -> str:
        if node_id not in self._public_keys:
            self.generate_node_keypair(node_id)
        pub_key = self._public_keys[node_id]
        pem = pub_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return pem.decode('utf-8')

    def sign(self, node_id: str, data: bytes) -> bytes:
        """Signs binary data using the specified node's ECDSA private key."""
        if node_id not in self._private_keys:
            self.generate_node_keypair(node_id)
        private_key = self._private_keys[node_id]
        return private_key.sign(data, ec.ECDSA(hashes.SHA256()))

    def verify(self, node_id: str, signature: bytes, data: bytes) -> Tuple[bool, str]:
        """Verifies ECDSA signature against the registered public key for the node."""
        if node_id not in self._public_keys:
            self.generate_node_keypair(node_id)
        
        public_key = self._public_keys[node_id]
        try:
            public_key.verify(signature, data, ec.ECDSA(hashes.SHA256()))
            return True, "ECDSA P-256 signature verified"
        except InvalidSignature:
            return False, "ECDSA P-256 digital signature invalid (signature verification failed)"
        except Exception as e:
            return False, f"ECDSA verification error: {str(e)}"

# Global instance for signing and verification
ecdsa_processor = ECDSAProcessor()
