@echo off
setlocal enabledelayedexpansion
:: Always anchor working directory to the folder containing this .bat file
cd /d "%~dp0"

title CrewAI Studio — Standalone Desktop Application (Port 3000)
color 0B

echo ============================================================================
echo        CrewAI Studio ^& Multi-Agent Workbench (Standalone Launcher)
echo        Full-Stack 8-Agent Org ^| LangGraph ^| Google Jules VM ^| GitHub Hub
echo ============================================================================
echo.
echo [INFO] Working Directory: %CD%

:: 1. Verify Node.js & npm are installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in your Windows PATH.
    echo         Please install Node.js LTS ^(v20 or v22+^) from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo [OK] Runtime Detected: Node.js !NODE_VER! ^| npm v!NPM_VER!

:: 2. Configure CPU & Memory Guardrails (Prevent PC Freeze / RAM Bloat)
set "PORT=3000"
set "NODE_OPTIONS=--max-old-space-size=2048"
echo [OK] Resource Guard Active: NODE_OPTIONS=%NODE_OPTIONS% ^| PORT=%PORT%

:: 3. Ensure .env file exists (Auto-create from .env.example or standalone template)
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy /y ".env.example" ".env" >nul
        echo [OK] Created .env file from .env.example.
    ) else (
        echo [INFO] Generating default standalone .env configuration...
        (
            echo # CrewAI Studio Standalone Configuration
            echo PORT=3000
            echo GEMINI_API_KEY=
            echo GEMINI_API_KEY_0=
            echo GEMINI_API_KEY_1=
            echo GEMINI_API_KEY_2=
            echo GEMINI_API_KEY_3=
            echo GITHUB_TOKEN=
            echo OPENAI_API_KEY=
            echo ANTHROPIC_API_KEY=
            echo GROQ_API_KEY=
            echo OLLAMA_HOST=http://127.0.0.1:11434
        ) > ".env"
        echo [OK] Created default .env file. Add your GEMINI_API_KEY and GITHUB_TOKEN anytime.
    )
) else (
    echo [OK] Found existing .env configuration file.
)

:: 4. Check & free Port 3000 if a stale server instance is still holding it
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    set "STALE_PID=%%p"
)
if defined STALE_PID (
    if not "!STALE_PID!"=="0" (
        echo [WARN] Port 3000 is currently in use by PID !STALE_PID!.
        echo [INFO] Stopping previous standalone server instance ^(PID !STALE_PID!^)...
        taskkill /F /PID !STALE_PID! >nul 2>nul
        timeout /t 1 /nobreak >nul
    )
)

:: 5. Install dependencies if node_modules or tsx binary is missing
if not exist "node_modules\.bin\tsx.cmd" (
    echo.
    echo [INFO] Installing standalone application dependencies ^(first-time setup^)...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] npm install failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
    echo [OK] All dependencies installed.
)

:: 6. Launch background readiness waiter that opens the app in Standalone Desktop Window mode
::    Uses Microsoft Edge (--app) or Google Chrome (--app) for a native chromeless window,
::    with automatic fallback to the system default browser.
set "APP_URL=http://localhost:%PORT%"
echo.
echo [INFO] Starting background health watcher for %APP_URL%...
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "$url = '%APP_URL%'; for ($i=0; $i -lt 45; $i++) { Start-Sleep -Milliseconds 700; try { $r = Invoke-WebRequest -Uri ($url + '/api/agents/heartbeat') -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; if ($r.StatusCode -eq 200) { break } } catch {} }; if (Get-Command msedge -ErrorAction SilentlyContinue) { Start-Process msedge -ArgumentList ('--app=' + $url), '--window-size=1480,940' } elseif (Get-Command chrome -ErrorAction SilentlyContinue) { Start-Process chrome -ArgumentList ('--app=' + $url), '--window-size=1480,940' } else { Start-Process $url }"

:: 7. Start the Full-Stack Standalone Server (Express API + Vite/SPA)
echo ============================================================================
echo [STANDALONE READY] Launching CrewAI Studio on %APP_URL%
echo  - Dedicated Desktop App Window will open automatically once port 3000 is live.
echo  - Global CPU/Memory Task Throttler ^& .env Persistence are active.
echo  - Press Ctrl+C in this window to shut down the standalone server.
echo ============================================================================
echo.

:server_loop
if /i "%~1"=="--prod" (
    if not exist "dist\index.html" (
        echo [INFO] Building production bundle...
        call npm run build
    )
    set "NODE_ENV=production"
    call npx tsx server.ts
) else (
    call npm run dev
)

echo.
echo [WARN] Standalone server process exited.
choice /C YN /T 10 /D N /M "Do you want to restart the CrewAI Studio Standalone Server"
if errorlevel 2 goto :eof
if errorlevel 1 goto :server_loop
