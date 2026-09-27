from pathlib import Path
import os
from pydantic import BaseModel, Field

# Base Directory paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
INCOMING_DIR = DATA_DIR / "incoming"
PROCESSED_DIR = DATA_DIR / "processed"
ARCHIVE_DIR = DATA_DIR / "archive"
SAMPLES_DIR = DATA_DIR / "samples"
DB_PATH = DATA_DIR / "securelink.db"

# Ensure directories exist
for directory in [DATA_DIR, INCOMING_DIR, PROCESSED_DIR, ARCHIVE_DIR, SAMPLES_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    APP_NAME: str = "SecureLink - Tactical Datalink System"
    APP_VERSION: str = "1.0.0"
    TRL_LEVEL: str = "TRL 3/4 Proof-of-Concept (Laboratory Validation)"
    
    # Directory paths
    BASE_DIR: Path = BASE_DIR
    DATA_DIR: Path = DATA_DIR
    INCOMING_DIR: Path = INCOMING_DIR
    PROCESSED_DIR: Path = PROCESSED_DIR
    ARCHIVE_DIR: Path = ARCHIVE_DIR
    SAMPLES_DIR: Path = SAMPLES_DIR
    DB_PATH: Path = DB_PATH

    # Network & Ingestion
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    UDP_HOST: str = "0.0.0.0"
    UDP_PORT: int = 9871
    
    # Cryptographic Pipeline parameters
    FRESHNESS_WINDOW_SECONDS: float = 5.0
    MAX_NONCE_CACHE_SIZE: int = 50000
    DEFAULT_KEY_ID: str = "SK-ALPHA-042"
    ROTATION_INTERVAL_SECONDS: int = 3600
    
    # Database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DB_PATH.as_posix()}"
    SYNC_DATABASE_URL: str = f"sqlite:///{DB_PATH.as_posix()}"
    
    # Demonstration Mode
    DEMO_DEFAULT_ENABLED: bool = False
    DEMO_DEFAULT_RATE_HZ: float = 1.0
    DEMO_DEFAULT_ATTACK_RATIO: float = 0.25

settings = Settings()
