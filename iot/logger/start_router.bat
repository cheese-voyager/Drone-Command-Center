@echo off
title MAVLink Telemetry Router
cd /d "%~dp0\.."

echo ======================================================================
echo   MAVLink Telemetry Router (Mission Planner + Python Logger)
echo ======================================================================
echo.
echo Pastikan Radio Telemetry (SiK 3DR) sudah terpasang.
echo.

uv run python logger/telemetry_router.py %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Router berhenti dengan kode error: %ERRORLEVEL%
    pause
)
