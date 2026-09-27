@echo off
echo ========================================================
echo Launching Complete SecureLink Tactical Datalink System
echo ========================================================

start "SecureLink Backend" cmd /c "%~dp0start_backend.bat"
timeout /t 2 /nobreak >nul
start "SecureLink Frontend" cmd /c "%~dp0start_frontend.bat"

echo.
echo SecureLink is launching...
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
