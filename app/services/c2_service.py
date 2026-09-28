from typing import Dict, Any, List
from collections import deque

class C2OutputService:
    """
    Trusted C2 (Command & Control) Output Subsystem.
    Only packets that pass every security verification check and are ACCEPTED
    are forwarded to the tactical operator / C2 consumer interface.
    """
    
    def __init__(self, max_buffer: int = 500):
        self.status = "CONNECTED"
        self.forwarded_count = 0
        self.blocked_count = 0
        self.rejected_count = 0
        self._c2_buffer: deque = deque(maxlen=max_buffer)

    def forward_packet(self, packet_dict: Dict[str, Any]):
        """Forwards an authenticated, verified packet to the C2 stream."""
        self.forwarded_count += 1
        c2_record = {
            "packet_id": packet_dict["packet_id"],
            "source": packet_dict["source"],
            "timestamp": packet_dict["timestamp"],
            "trust_score": packet_dict["trust_score"],
            "telemetry": packet_dict.get("decrypted_payload"),
            "forwarded_at": packet_dict.get("created_at")
        }
        self._c2_buffer.append(c2_record)

    def record_dropped(self, action: str):
        if action == "BLOCKED":
            self.blocked_count += 1
        elif action in ["REJECTED", "FILTERED"]:
            self.rejected_count += 1

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "forwarded": self.forwarded_count,
            "blocked": self.blocked_count,
            "rejected": self.rejected_count,
            "recent_count": len(self._c2_buffer)
        }

    def get_recent_c2_packets(self, limit: int = 50) -> List[Dict[str, Any]]:
        return list(self._c2_buffer)[-limit:]

c2_service = C2OutputService()
