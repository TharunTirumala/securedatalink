@echo off
echo ========================================================
echo Starting SecureLink Backend (FastAPI + Uvicorn)
echo Tactical Datalink Cyber-Security System
echo ========================================================
cd /d "%~dp0..\backend"
call .\venv\Scripts\activate
set PYTHONPATH=.;..
python run.py
pause
