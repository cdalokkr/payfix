@echo off
title PayFix TimeWatch Biometric Sync Service
echo ========================================================
echo   Starting PayFix Biometric Server (32-bit SysWOW64)...
echo ========================================================
cd /d d:\payfix\sync-agent
C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File "d:\payfix\sync-agent\timewatch-direct-service.ps1"
if errorlevel 1 (
    echo.
    echo Service stopped or encountered an error.
)
pause
