from pathlib import Path
import os
from pydantic import BaseModel

# Base Directory paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# On Vercel / serverless runtimes, only /tmp is writable
is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
DATA_DIR = Path("/tmp/data") if is_serverless else BASE_DIR / "data"

INCOMING_DIR = DATA_DIR / "incoming"
PROCESSED_DIR = DATA_DIR / "processed"
ARCHIVE_DIR = DATA_DIR / "archive"
SAMPLES_DIR = DATA_DIR / "samples"
DB_PATH = DATA_DIR / "securelink.db"

# Ensure directories exist safely without failing on restricted filesystems
for directory in [DATA_DIR, INCOMING_DIR, PROCESSED_DIR, ARCHIVE_DIR, SAMPLES_DIR]:
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

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

    # Operator Security & Authorization
    OPERATOR_OVERRIDE_PASSCODE: str = os.getenv("OPERATOR_OVERRIDE_PASSCODE", "TAC-SEC-8000")
    OPERATOR_AUTH_TOKEN: str = os.getenv("SECURELINK_OPERATOR_TOKEN", "TAC-OP-TOKEN-9871")
    AUTHORIZED_OPERATORS: list = ["OPERATOR-PRIMARY", "OPERATOR-BACKUP", "TACTICAL-SUPERVISOR", "CHIEF-SECURITY-OFFICER"]
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]


settings = Settings()
