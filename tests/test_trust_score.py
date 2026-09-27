import pytest
from app.processing.trust_score import trust_score_engine

def test_trust_score_authentic_packet():
    result = trust_score_engine.calculate(
        auth_ok=True,
        sig_ok=True,
        fresh_ok=True,
        replay_ok=True,
        integrity_ok=True,
        source_ok=True
    )
    assert result["score"] == 100
    assert result["is_suspicious"] is False

def test_trust_score_tampered_packet():
    # If AES-GCM auth fails
    result = trust_score_engine.calculate(
        auth_ok=False,
        sig_ok=True,
        fresh_ok=True,
        replay_ok=True,
        integrity_ok=True,
        source_ok=True
    )
    assert result["score"] <= 25
    assert result["is_suspicious"] is True
    assert result["auth_ok"] is False

def test_trust_score_replayed_packet():
    result = trust_score_engine.calculate(
        auth_ok=True,
        sig_ok=True,
        fresh_ok=False,
        replay_ok=False,
        integrity_ok=True,
        source_ok=True
    )
    assert result["score"] <= 35
    assert result["is_suspicious"] is True
    assert result["replay_ok"] is False
