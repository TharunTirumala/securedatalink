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

@app.get("/health")
async def health_check():
    return {"status": "HEALTHY", "telemetry": "CONNECTED"}
