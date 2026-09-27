import pytest
import time
from app.processing.freshness import FreshnessVerifier

def test_freshness_verifier_pass():
    verifier = FreshnessVerifier(max_drift_seconds=5.0)
    now = time.time()
    is_fresh, is_unique, msg = verifier.verify("UAV-01", "nonce-001", now)
    assert is_fresh is True
    assert is_unique is True
    assert "PASS" in msg

def test_freshness_verifier_stale_timestamp():
    verifier = FreshnessVerifier(max_drift_seconds=5.0)
    stale_time = time.time() - 15.0 # 15 seconds in the past
    is_fresh, is_unique, msg = verifier.verify("UAV-01", "nonce-002", stale_time)
    assert is_fresh is False
    assert is_unique is True
    assert "exceeds limit" in msg

def test_freshness_verifier_replay_detection():
    verifier = FreshnessVerifier(max_drift_seconds=5.0)
    now = time.time()
    # First time passes
    is_fresh1, is_unique1, _ = verifier.verify("UAV-01", "nonce-003", now)
    assert is_fresh1 is True
    assert is_unique1 is True

    # Replay of the exact same nonce for the same source
    is_fresh2, is_unique2, msg2 = verifier.verify("UAV-01", "nonce-003", now + 0.1)
    assert is_unique2 is False
    assert "Replay detected" in msg2
