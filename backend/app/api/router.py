from fastapi import APIRouter
from app.api.endpoints_dashboard import router as dashboard_router
from app.api.endpoints_telemetry import router as telemetry_router
from app.api.endpoints_threats import router as threats_router
from app.api.endpoints_keys import router as keys_router
from app.api.endpoints_operator import router as operator_router
from app.api.endpoints_archive import router as archive_router
from app.api.websocket import router as ws_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(telemetry_router, prefix="/telemetry", tags=["Telemetry"])
api_router.include_router(threats_router, prefix="/threats", tags=["Threats"])
api_router.include_router(keys_router, prefix="/keys", tags=["Key Management"])
api_router.include_router(operator_router, prefix="/operator", tags=["Operator Controls"])
api_router.include_router(archive_router, prefix="/archive", tags=["Archive & Logs"])
