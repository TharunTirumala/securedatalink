import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.logging import logger
from app.database.connection import init_db
from app.api.router import api_router
from app.api.websocket import router as ws_router
from app.ingestion.file_watcher import file_watcher
from app.ingestion.simulator import simulator
from app.ingestion.udp_receiver import udp_receiver
from app.processing.pipeline import pipeline
from app.processing.freshness import freshness_verifier

_initialized = False
_init_lock = asyncio.Lock()

async def _perform_system_init():
    global _initialized
    if not _initialized:
        await init_db()
        await pipeline.initialize_state()
        await freshness_verifier.initialize_state()
        await simulator.sync_sequence_from_db()
        from app.database.connection import set_system_state
        await set_system_state("demo_state", "STOPPED")
        simulator.enabled = False
        pipeline.stream_paused = False
        _initialized = True

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SecureLink Cyber-Secure Tactical Datalink System...")
    async with _init_lock:
        await _perform_system_init()

    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    is_testing = bool(os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING"))
    if not is_serverless and not is_testing:
        await file_watcher.start()
        await udp_receiver.start()
        logger.info("SecureLink backend services ready (STATUS: STOPPED).")
    else:
        logger.info("SecureLink running in test or serverless environment.")

    yield

    if not is_serverless and not is_testing:
        logger.info("Shutting down SecureLink backend services...")
        await simulator.stop()
        await file_watcher.stop()
        await udp_receiver.stop()
        logger.info("SecureLink shutdown complete.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Cyber-Secure Tactical Datalink System - Real-Time Telemetry Authentication & Threat Filtering",
    lifespan=lifespan
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "connect-src 'self' ws: wss: http: https:;"
    )
    return response

# Lazy DB & pipeline initialization middleware for serverless cold starts
@app.middleware("http")
async def ensure_db_initialized(request, call_next):
    global _initialized
    if not _initialized:
        async with _init_lock:
            if not _initialized:
                try:
                    await _perform_system_init()
                except Exception as e:
                    logger.error(f"Error during lazy initialization: {e}")
    response = await call_next(request)
    return response

# Strict CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include API and WebSocket routes
app.include_router(api_router)
app.include_router(ws_router)

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "HEALTHY", "telemetry": "CONNECTED"}

@app.get("/system/info")
@app.get("/api/system/info")
async def system_info():
    return {
        "system": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "ONLINE",
        "scope": settings.TRL_LEVEL,
        "encryption": "AES-256-GCM ACTIVE",
        "signature": "ECDSA NIST P-256",
        "documentation": "/docs"
    }

# Static SPA mounting if dist exists
DIST_DIR = settings.BASE_DIR / "dist"
if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    if (DIST_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/favicon.svg", include_in_schema=False)
    async def favicon():
        fav = DIST_DIR / "favicon.svg"
        if fav.exists():
            return FileResponse(fav)
        return {"status": "not found"}

    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(DIST_DIR / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_fallback(full_path: str):
        if full_path.startswith("api") or full_path.startswith("ws") or full_path in ("docs", "redoc", "openapi.json", "health"):
            return None
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "system": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "ONLINE",
            "scope": settings.TRL_LEVEL,
            "encryption": "AES-256-GCM ACTIVE",
            "signature": "ECDSA NIST P-256",
            "documentation": "/docs"
        }
