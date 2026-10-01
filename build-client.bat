@echo off
chcp 437 >nul
setlocal enabledelayedexpansion

echo.
echo ==================================================
echo   SKLAD v3.1 - CLIENT build (SKLAD_Client.exe)
echo   Portable thick client, Windows 10 x64
echo ==================================================
echo.

:: Check Node.js
echo [1/7] Checking environment...
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
set BUILD_TARGET=client

echo.
echo [2/7] Cleaning old build files...
if exist ".next" rmdir /s /q ".next"
if exist "out" rmdir /s /q "out"
if exist "release\client" rmdir /s /q "release\client"
echo   Done.

echo.
echo [3/7] Preparing package.json for Client build...
copy /y "package-build-client.json" "package.json" >nul
echo   Done.

echo.
echo [4/7] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed! Try: npm cache clean --force
    pause
    exit /b 1
)
echo   Done.

echo.
echo [5/7] Temporarily renaming middleware (not supported in export)...
if exist "src\middleware.ts" ren "src\middleware.ts" "middleware.ts.bak"
echo   Done.

echo.
echo [6/7] Building Next.js (static export)...
call npx next build
set BUILD_ERR=%errorlevel%
if exist "src\middleware.ts.bak" ren "src\middleware.ts.bak" "middleware.ts"
if %BUILD_ERR% neq 0 (
    echo [ERROR] Next.js build failed!
    pause
    exit /b 1
)
echo   Done.

echo.
echo [7/7] Packaging SKLAD_Client.exe...
call npx electron-builder --win portable --x64 --config electron-builder.client.yml
if %errorlevel% neq 0 (
    echo [ERROR] electron-builder failed!
    pause
    exit /b 1
)

echo.
echo ==================================================
echo         CLIENT BUILD SUCCESSFUL!
echo ==================================================
echo.
echo   Output: release\client\SKLAD_Client-3.1.0.exe
echo.
echo   Run: double-click. First start asks for server IP
echo   (the PC running SKLAD_Server.exe), default port 3270.
echo   Connection is remembered in %%APPDATA%%\SkladClient\config.json
echo.
pause
