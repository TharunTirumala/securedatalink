from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# CORS configuration for local frontend development
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

# Locate frontend static dist folder for unified single-service hosting
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")
INDEX_PATH = os.path.join(DIST_DIR, "index.html")

if os.path.exists(INDEX_PATH):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(INDEX_PATH)

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws") or full_path in ["docs", "openapi.json", "redoc"]:
            return None
        candidate = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(INDEX_PATH)
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
