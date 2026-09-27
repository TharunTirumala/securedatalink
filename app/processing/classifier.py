from typing import Tuple

class PacketClassifier:
    """
    Deterministic tactical packet classifier based on multi-stage cryptographic
    and freshness verification results.
    """
    
    @staticmethod
    def classify(
        format_valid: bool,
        is_fresh: bool,
        is_unique_nonce: bool,
        auth_verified: bool,
        sig_verified: bool,
        integrity_passed: bool,
        source_authorized: bool,
        is_source_filtered: bool
    ) -> Tuple[str, str]:
        """
        Returns: (classification, action)
        Actions: ACCEPTED, BLOCKED, REJECTED, FILTERED
        """
        if not format_valid:
            return "INVALID FORMAT", "REJECTED"
            
        if is_source_filtered:
            return "FILTERED", "FILTERED"
            
        if not is_unique_nonce or not is_fresh:
            return "REPLAYED", "BLOCKED"
            
        if not auth_verified:
            return "TAMPERED", "BLOCKED"
            
        if not sig_verified:
            return "INVALID SIGNATURE", "BLOCKED"
            
        if not integrity_passed:
            return "INTEGRITY FAILURE", "BLOCKED"
            
        if not source_authorized:
            return "FILTERED", "FILTERED"
            
        return "AUTHENTIC", "ACCEPTED"

packet_classifier = PacketClassifier()
