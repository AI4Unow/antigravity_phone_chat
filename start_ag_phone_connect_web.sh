#!/bin/bash

# Navigate to script directory
cd "$(dirname "$0")"

echo "==================================================="
echo "  Antigravity Phone Connect - Tailscale Access"
echo "==================================================="
echo

# 0. Cleanup old server processes
echo "[0/2] Cleaning up orphans..."
pkill -f "node server.js" &> /dev/null
# Cleanup by port (Linux/Mac)
if command -v lsof &> /dev/null; then
    lsof -ti:3000 | xargs kill -9 &> /dev/null
fi

# 1. Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing Node.js dependencies..."
    npm install
fi

# 2. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    exit 1
fi

# 3. Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed."
    exit 1
fi

# 4. Check for .env file
if [ ! -f ".env" ]; then
    echo "[WARNING] .env file not found."
    echo
    if [ -f ".env.example" ]; then
        echo "[INFO] Creating .env from .env.example..."
        cp .env.example .env
        echo "[SUCCESS] .env created from template!"
        echo "[ACTION] Please update .env with your configuration if needed."
        exit 0
    else
        echo "[ERROR] .env.example not found. Cannot create .env template."
        exit 1
    fi
fi
echo "[INFO] .env configuration found."

# 5. Launch via Python launcher
echo "[1/1] Launching Antigravity Phone Connect..."
echo "(Access via Tailscale hostname or local IP)"
python3 launcher.py

# 6. Auto-close when done
exit 0
