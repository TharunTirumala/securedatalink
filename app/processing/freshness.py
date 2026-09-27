import time
from typing import Tuple, Dict, Set
from collections import OrderedDict
from app.core.config import settings
from app.core.logging import logger

class FreshnessVerifier:
    """
    Dynamic Nonce & Freshness Verification.
    Validates packet timestamp against sliding time window and
    detects replayed frames via bounded LRU nonce cache.
    """
    
    def __init__(self, max_drift_seconds: float = 5.0, cache_limit: int = 50000):
        self.max_drift_seconds = max_drift_seconds
        self.cache_limit = cache_limit
        # LRU cache: nonce_key -> timestamp
        self._nonce_cache: OrderedDict[str, float] = OrderedDict()

    async def initialize_state(self):
        """Restores persisted freshness window from database."""
        from app.database.connection import get_system_state
        persisted = await get_system_state("freshness_window")
        if persisted:
            try:
                self.max_drift_seconds = float(persisted)
                logger.info(f"Restored persisted freshness tolerance: {self.max_drift_seconds:.1f}s")
            except ValueError:
                pass

    def set_max_drift(self, seconds: float):
        """Allows operator override of freshness tolerance."""
        self.max_drift_seconds = max(0.5, seconds)
        logger.info(f"Operator override: Freshness window updated to {self.max_drift_seconds:.1f}s")


    def verify(self, source: str, nonce: str, packet_time: float) -> Tuple[bool, bool, str]:
        """
        Verifies both timestamp freshness and nonce uniqueness.
        Returns: (is_fresh, is_unique_nonce, status_description)
        """
        current_time = time.time()
        time_diff = abs(current_time - packet_time)
        
        is_fresh = time_diff <= self.max_drift_seconds
        nonce_key = f"{source}:{nonce}"
        
        # Check nonce cache
        if nonce_key in self._nonce_cache:
            is_unique = False
            return is_fresh, False, f"Replay detected: nonce '{nonce[:8]}...' already recorded for {source}"
        
        is_unique = True
        
        # Add to LRU cache
        self._nonce_cache[nonce_key] = current_time
        if len(self._nonce_cache) > self.cache_limit:
            self._nonce_cache.popitem(last=False)
            
        if not is_fresh:
            return False, is_unique, f"Freshness check failed: timestamp skew {time_diff:.2f}s exceeds limit {self.max_drift_seconds}s"
            
        return True, True, "Freshness and nonce verified (PASS)"

freshness_verifier = FreshnessVerifier(max_drift_seconds=settings.FRESHNESS_WINDOW_SECONDS)
