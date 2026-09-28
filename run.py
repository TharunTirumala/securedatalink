import os
import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    # Default to 127.0.0.1 for secure local binding; overridden by HOST env in container/cloud
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", str(settings.PORT)))

    # Note: SecureLink intentionally uses a single worker process (workers=1).
    # The in-memory replay cache (FreshnessVerifier), active session key state (KeyManager),
    # and SQLite database writes require single-process state synchronization.
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        workers=1,
        reload=False,
        log_level="info"
    )
