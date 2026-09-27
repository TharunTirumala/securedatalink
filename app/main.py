from contextlib import asynccontextmanager
from pathlib import Path
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing SecureLink Cyber-Secure Tactical Datalink System...")
    await init_db()
    await file_watcher.start()
    await simulator.start()
    await udp_receiver.start()
    logger.info("SecureLink backend services started successfully.")
    
    yield
    
    # Shutdown
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

# CORS configuration for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)
app.include_router(ws_router)

@app.get("/health")
async def health_check():
    return {"status": "HEALTHY", "telemetry": "CONNECTED"}

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
