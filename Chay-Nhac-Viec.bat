@echo off
REM Nhac Viec - chay ban production tren may nay: http://localhost:4173
REM Bam dup file nay. Dong cua so nay = tat app.
cd /d "%~dp0"
if errorlevel 1 (
  echo Khong vao duoc thu muc cua app: %~dp0
  pause
  exit /b 1
)
title Nhac Viec - http://localhost:4173

where node >nul 2>nul
if errorlevel 1 (
  echo Chua co Node.js. Cai ban 22 tro len tai https://nodejs.org roi chay lai.
  pause
  exit /b 1
)

REM Dang chay roi thi chi mo trinh duyet
netstat -ano | findstr "127.0.0.1:4173" | findstr LISTENING >nul
if not errorlevel 1 (
  start "" http://localhost:4173
  exit /b 0
)

if not exist node_modules (
  echo Lan dau: dang cai thu vien, mat khoang 1 phut...
  call npx -y pnpm@10.34.3 install
  if errorlevel 1 goto :loi
)

echo Dang build ban moi nhat...
call npx -y pnpm@10.34.3 run build
if errorlevel 1 goto :loi

start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 3; Start-Process http://localhost:4173"
echo.
echo Nhac Viec dang chay tai http://localhost:4173  (chi may nay truy cap duoc)
echo Giu cua so nay mo. Dong cua so = tat app.
echo.
call npx -y pnpm@10.34.3 exec vite preview --host 127.0.0.1 --port 4173 --strictPort
goto :eof

:loi
echo.
echo Co loi khi chuan bi app. Chup man hinh cua so nay de duoc ho tro.
pause
exit /b 1
