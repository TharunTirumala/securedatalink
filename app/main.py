import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.logging import logger
from app.database.connection import init_db
from app.api.router import api_router
from app.api.websocket import router as ws_router
from app.api.endpoints_dashboard import router as dashboard_router
from app.api.endpoints_telemetry import router as telemetry_router
from app.api.endpoints_threats import router as threats_router
from app.api.endpoints_keys import router as keys_router
from app.api.endpoints_operator import router as operator_router
from app.api.endpoints_archive import router as archive_router
from app.ingestion.file_watcher import file_watcher
from app.ingestion.simulator import simulator
from app.ingestion.udp_receiver import udp_receiver
from app.processing.pipeline import pipeline
from app.processing.freshness import freshness_verifier

_initialized = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _initialized
    logger.info("Initializing SecureLink Cyber-Secure Tactical Datalink System...")
    if not _initialized:
        await init_db()
        await pipeline.initialize_state()
        await freshness_verifier.initialize_state()
        await simulator.sync_sequence_from_db()
        from app.database.connection import get_system_state
        saved_demo_state = await get_system_state("demo_state", "STOPPED")
        if saved_demo_state == "RUNNING":
            simulator.enabled = True
            pipeline.stream_paused = False
        elif saved_demo_state == "PAUSED":
            simulator.enabled = True
            pipeline.stream_paused = True
        else:
            simulator.enabled = False
            pipeline.stream_paused = False
        _initialized = True

    is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    is_testing = bool(os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING"))
    if not is_serverless and not is_testing:
        await file_watcher.start()
        await simulator.start()
        await udp_receiver.start()
        logger.info("SecureLink backend services started successfully.")
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

# Lazy DB & pipeline initialization middleware for serverless cold starts
@app.middleware("http")
async def ensure_db_initialized(request, call_next):
    global _initialized
    if not _initialized:
        try:
            await init_db()
            await pipeline.initialize_state()
            await freshness_verifier.initialize_state()
            await simulator.sync_sequence_from_db()
            from app.database.connection import get_system_state
            saved_demo_state = await get_system_state("demo_state", "STOPPED")
            if saved_demo_state == "RUNNING":
                simulator.enabled = True
                pipeline.stream_paused = False
            elif saved_demo_state == "PAUSED":
                simulator.enabled = True
                pipeline.stream_paused = True
            else:
                simulator.enabled = False
                pipeline.stream_paused = False
            _initialized = True
        except Exception as e:
            logger.error(f"Error during lazy initialization: {e}")
    response = await call_next(request)
    return response

# CORS configuration for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes with both /api/v1 and /v1 prefixes for Vercel serverless compatibility
app.include_router(api_router)
app.include_router(ws_router)

v1_router = APIRouter(prefix="/v1")
v1_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
v1_router.include_router(telemetry_router, prefix="/telemetry", tags=["Telemetry"])
v1_router.include_router(threats_router, prefix="/threats", tags=["Threats"])
v1_router.include_router(keys_router, prefix="/keys", tags=["Key Management"])
v1_router.include_router(operator_router, prefix="/operator", tags=["Operator Controls"])
v1_router.include_router(archive_router, prefix="/archive", tags=["Archive & Logs"])
app.include_router(v1_router)

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
