@echo off
echo ========================================================
echo Starting SecureLink: Cyber-Secure Tactical Datalink System
echo ========================================================

start SecureLink Backend cmd /k python run.py
start SecureLink Frontend cmd /k npm run dev

echo Both services launched.
echo Backend API: http://127.0.0.1:8000
echo Frontend UI: http://localhost:5173
