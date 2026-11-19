@echo off
REM Nhac Viec - bam dup de chay. Khong can cai dat gi them.
REM Dong cua so nay = tat app.
cd /d "%~dp0"
if errorlevel 1 (
  echo Khong vao duoc thu muc cua app: %~dp0
  pause
  exit /b 1
)
title Nhac Viec - http://localhost:4173

REM Dang chay roi thi chi mo trinh duyet
netstat -ano | findstr ":4173 " | findstr LISTENING >nul
if not errorlevel 1 (
  start "" http://localhost:4173
  exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 4173
