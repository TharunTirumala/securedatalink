from typing import Dict, Any, Set
from app.core.logging import logger

class AdaptiveFilter:
    """
    Deterministic Adaptive Verification and Filtering module.
    Maintains running evaluation metrics and executes rules based on
    cryptographic and behavioral policy criteria.
    """
    
    def __init__(self):
        self.is_active = True
        self.evaluated_count = 0
        self.accepted_count = 0
        self.rejected_count = 0
        self.blocked_count = 0
        self.replay_count = 0
        self.tampered_count = 0
        self.filtered_count = 0
        
        # Explicit blocklist/filter list for suspicious tactical nodes
        self._filtered_sources: Set[str] = set()

    def add_filtered_source(self, source: str):
        self._filtered_sources.add(source)
        logger.info(f"Adaptive filter policy: Added {source} to restricted filter list")

    def remove_filtered_source(self, source: str):
        self._filtered_sources.discard(source)
        logger.info(f"Adaptive filter policy: Removed {source} from restricted filter list")

    def is_source_filtered(self, source: str) -> bool:
        return source in self._filtered_sources

    def update_metrics(self, classification: str, action: str):
        """Updates deterministic operational counters."""
        self.evaluated_count += 1
        
        if action == "ACCEPTED":
            self.accepted_count += 1
        elif action == "BLOCKED":
            self.blocked_count += 1
        elif action == "REJECTED":
            self.rejected_count += 1
        elif action == "FILTERED":
            self.filtered_count += 1
            
        if classification == "REPLAYED":
            self.replay_count += 1
        elif classification == "TAMPERED":
            self.tampered_count += 1

    def get_stats(self) -> Dict[str, Any]:
        return {
            "is_active": self.is_active,
            "evaluated": self.evaluated_count,
            "accepted": self.accepted_count,
            "rejected": self.rejected_count,
            "blocked": self.blocked_count,
            "replay": self.replay_count,
            "tampered": self.tampered_count,
            "filtered": self.filtered_count,
            "filtered_sources": list(self._filtered_sources)
        }

adaptive_filter = AdaptiveFilter()
