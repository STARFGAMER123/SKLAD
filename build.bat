@echo off
chcp 437 >nul
setlocal enabledelayedexpansion

echo.
echo =============================================
echo   SKLAD v2.1 - Warehouse Management System
echo   Portable App Builder for Windows 10 x64
echo =============================================
echo.

:: Check Node.js
echo [1/7] Checking environment...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed or not in PATH!
    echo.
    echo Install Node.js v20+ from https://nodejs.org/
    echo Recommended: Node.js v20 LTS
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo   Node.js: %NODE_VER%

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm not found!
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo   npm: %NPM_VER%

:: Set variables
set APP_NAME=SKLAD
set APP_VERSION=2.1
set ELECTRON_VERSION=33.2.1
set NODE_OPTIONS=--max-old-space-size=4096

echo.
echo [2/7] Cleaning old build files...
if exist ".next" rmdir /s /q ".next"
if exist "dist-electron" rmdir /s /q "dist-electron"
if exist "dist" rmdir /s /q "dist"
mkdir "dist-electron"
echo   Done.

echo.
echo [3/7] Preparing package.json for Electron build...
if exist "package-build.json" (
    copy /y "package-build.json" "package.json" >nul
    echo   package.json copied from package-build.json
) else (
    echo   Using current package.json
)

echo.
echo [4/7] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies!
    echo Try: npm cache clean --force
    echo Then re-run this script.
    echo.
    pause
    exit /b 1
)
echo   Done.

echo.
echo [5/7] Building Next.js application...
call npx next build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Next.js build failed!
    echo.
    pause
    exit /b 1
)
echo   Done.

echo.
echo [5.5/7] Preparing standalone build...
call node scripts/post-build.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Post-build preparation failed!
    echo.
    pause
    exit /b 1
)

echo.
echo [6/7] Rebuilding native modules for Electron...
call npx @electron/rebuild -f -w better-sqlite3
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to rebuild better-sqlite3 for Electron!
    echo.
    echo Possible solutions:
    echo   1. Install Visual Studio Build Tools 2019+
    echo   2. Ensure Python 3.x is installed and in PATH
    echo   3. Run: npm install -g windows-build-tools
    echo.
    pause
    exit /b 1
)
echo   Done.

echo.
echo [7/7] Packaging Electron application...
call npx electron-builder --win portable --x64 --config electron-builder.json
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Electron packaging failed!
    echo.
    pause
    exit /b 1
)

echo.
echo =============================================
echo         BUILD SUCCESSFUL!
echo =============================================
echo.
echo   Application: %APP_NAME% v%APP_VERSION%
echo   Format: Portable (.exe)
echo   Platform: Windows 10 x64
echo.
echo   Output files:
echo.

:: List output files
if exist "dist-electron\*.exe" (
    for %%f in (dist-electron\*.exe) do (
        echo   [OK] %%f
    )
) else (
    echo   Searching in dist-electron\:
    dir /b /s "dist-electron\*.exe" 2>nul
)

echo.
echo   To run: copy the .exe to any Windows 10 PC
echo   and double-click to start. Database is created
echo   automatically next to the .exe file.
echo.
pause
