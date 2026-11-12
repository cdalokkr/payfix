@echo off
title IP Camera Video Analytics and NVR Server
color 0A

echo ======================================================================
echo    IP CAMERA VIDEO ANALYTICS AND NVR SERVER (ANPR + FACE ACCESS)
echo ======================================================================
echo.
echo [1/3] Checking Python Environment...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in system PATH.
    pause
    exit /b 1
)

echo [2/3] Initializing Video Analytics Server on http://localhost:8000 ...
echo       - Storage: storage/continuous, storage/events, storage/snapshots
echo       - ANPR: Number Plate Detection and OCR Whitelist
echo       - Face AI: ArcFace 512-d Biometric Access Control
echo       - NVR: 24/7 Segmented Recording and Storage Janitor Auto-Purge
echo.
echo [3/3] Starting Server... Press Ctrl+C to stop.
echo.

python main.py

pause
