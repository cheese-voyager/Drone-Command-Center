@echo off
title Drone Flight Logger GUI
cd /d "%~dp0"

echo Membuka Antarmuka GUI Logger...
uv run python logger/gui.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] GUI tertutup dengan pesan error: %ERRORLEVEL%
    pause
)
