#!/usr/bin/env bash
set -e

echo "================================================================"
echo "          CrewAI Studio & Multi-Agent Workbench"
echo "================================================================"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js 20+."
    exit 1
fi

echo "[OK] Node.js $(node -v) detected."

# Create .env from .env.example if missing
if [ ! -f .env ] && [ -f .env.example ]; then
    echo "[INFO] Creating .env from .env.example..."
    cp .env.example .env
    echo "[OK] .env file created."
fi

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies..."
    npm install
fi

echo ""
echo "[INFO] Opening http://localhost:3000..."
if command -v open &> /dev/null; then
    open http://localhost:3000 || true
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 || true
fi

echo "[READY] Starting CrewAI Studio server..."
npm run dev
