from typing import Dict, Any

class TrustScoreEngine:
    """
    Application-level decision-support trust score engine.
    Computes a deterministic score (0 - 100) based on six contributing verification checks.
    """
    
    # Weight points totaling 100
    WEIGHT_AUTH = 25       # AES-256-GCM authentication tag
    WEIGHT_SIG = 25        # ECDSA P-256 digital signature
    WEIGHT_FRESHNESS = 20  # Timestamp within sliding window
    WEIGHT_REPLAY = 15     # Nonce uniqueness check
    WEIGHT_INTEGRITY = 10  # SHA-256 payload digest verification
    WEIGHT_SOURCE = 5      # Source identity authorization
    
    @classmethod
    def calculate(
        cls,
        auth_ok: bool,
        sig_ok: bool,
        fresh_ok: bool,
        replay_ok: bool,
        integrity_ok: bool,
        source_ok: bool
    ) -> Dict[str, Any]:
        """
        Calculates score and returns full breakdown of contributing checks.
        """
        score = 0
        breakdown = {
            "auth_points": cls.WEIGHT_AUTH if auth_ok else 0,
            "sig_points": cls.WEIGHT_SIG if sig_ok else 0,
            "fresh_points": cls.WEIGHT_FRESHNESS if fresh_ok else 0,
            "replay_points": cls.WEIGHT_REPLAY if replay_ok else 0,
            "integrity_points": cls.WEIGHT_INTEGRITY if integrity_ok else 0,
            "source_points": cls.WEIGHT_SOURCE if source_ok else 0,
        }
        score = sum(breakdown.values())
        
        # Heavy penalty for tampering: if GCM tag fails, score cannot exceed 25
        if not auth_ok:
            score = min(score, 25)
            
        # Heavy penalty for replay: if replay detected, score cannot exceed 35
        if not replay_ok or not fresh_ok:
            score = min(score, 35)

        return {
            "score": score,
            "auth_ok": auth_ok,
            "sig_ok": sig_ok,
            "fresh_ok": fresh_ok,
            "replay_ok": replay_ok,
            "integrity_ok": integrity_ok,
            "source_ok": source_ok,
            "breakdown": breakdown,
            "is_suspicious": score < 60
        }

trust_score_engine = TrustScoreEngine()
