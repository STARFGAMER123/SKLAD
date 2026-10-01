@echo off
chcp 437 >nul
setlocal enabledelayedexpansion

echo.
echo ==================================================
echo   SKLAD v3.1 - SERVER build (SKLAD_Server.exe)
echo   Portable, tray-only, Windows 10 x64
echo ==================================================
echo.

:: Check Node.js
echo [1/8] Checking environment...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Install Node.js v20+ LTS from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo   Node.js: %%i
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found!
    pause
    exit /b 1
)

set NODE_OPTIONS=--max-old-space-size=4096
set BUILD_TARGET=server

echo.
echo [2/8] Cleaning old build files...
if exist ".next" rmdir /s /q ".next"
if exist "dist-app" rmdir /s /q "dist-app"
if exist "release\server" rmdir /s /q "release\server"
echo   Done.

echo.
echo [3/8] Preparing package.json for Server build...
copy /y "package-build-server.json" "package.json" >nul
echo   Done.

echo.
echo [4/8] Installing dependencies (postinstall rebuilds better-sqlite3 for Electron ABI)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed! Try: npm cache clean --force
    pause
    exit /b 1
)
echo   Done.

echo.
echo [5/8] Building Next.js (standalone, API + UI)...
call npx next build
if %errorlevel% neq 0 (
    echo [ERROR] Next.js build failed!
    pause
    exit /b 1
)
echo   Done.

echo.
echo [6/8] Preparing standalone (post-build)...
call node scripts/post-build.js
if %errorlevel% neq 0 (
    echo [ERROR] post-build failed!
    pause
    exit /b 1
)
if not exist "dist-app" mkdir "dist-app"
xcopy /e /i /y ".next\standalone\*" "dist-app\" >nul
echo   Standalone copied to dist-app\

echo.
echo [7/8] Control rebuild of better-sqlite3 for Electron ABI...
call npx @electron/rebuild -f -w better-sqlite3
if %errorlevel% neq 0 (
    echo [ERROR] electron-rebuild failed!
    echo Need: Visual Studio Build Tools 2019+ and Python 3.x
    pause
    exit /b 1
)
echo   Done.

echo.
echo [8/8] Packaging SKLAD_Server.exe...
call npx electron-builder --win portable --x64 --config electron-builder.server.yml
if %errorlevel% neq 0 (
    echo [ERROR] electron-builder failed!
    pause
    exit /b 1
)

echo.
echo ==================================================
echo         SERVER BUILD SUCCESSFUL!
echo ==================================================
echo.
echo   Output: release\server\SKLAD_Server-3.1.0.exe
echo.
echo   Run: double-click - icon appears in the system tray.
echo   Config: server-config.json next to the exe.
echo   Client: build SKLAD_Client-3.1.0.exe via build-client.bat
echo.
pause
