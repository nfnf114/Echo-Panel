@echo off
title Echo Panel - All-in-One Manager
color 0a

echo ==============================================
echo       Echo Panel - All-in-One Startup
echo ==============================================
echo.

echo [*] Checking and installing dependencies...
echo.

echo [1/3] Installing Root (Frontend) dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [!] Warning: Root npm install had issues, continuing...
)

echo [2/3] Installing Backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [!] Warning: Backend npm install had issues, continuing...
)
cd ..

echo [3/3] Installing Bot dependencies...
cd bot
call npm install
if %errorlevel% neq 0 (
    echo [!] Warning: Bot npm install had issues, continuing...
)
cd ..

echo.
echo [*] All dependencies installed. Starting services...
echo.

echo [+] Starting Backend API...
cd backend
start "Echo Backend" /b node index.js
cd ..

echo [+] Starting Discord Bot...
cd bot
start "Echo Bot" /b node index.js
cd ..

echo [+] Starting Web Frontend...
echo [!] Press Ctrl+C to stop all services.
echo.

call npm run dev

pause
