#!/bin/bash
set -e

# ── bgutil PO token server ─────────────────────────────────────────────────
# Provides YouTube BotGuard attestation (PO tokens) to yt-dlp via the
# bgutil-ytdlp-pot-provider plugin. Listens on localhost:4416.
echo "[startup] Starting bgutil PO token server on port 4416..."
node /bgutil/server/build/main.js &
BGUTIL_PID=$!
echo "[startup] bgutil started (PID=$BGUTIL_PID)"

# Wait up to 10 s for bgutil to accept connections
for i in $(seq 1 10); do
    if curl -sf -o /dev/null -w "%{http_code}" http://localhost:4416/ 2>/dev/null | grep -qv "^$"; then
        echo "[startup] bgutil is up (attempt $i)"
        break
    fi
    echo "[startup] waiting for bgutil... ($i/10)"
    sleep 1
done

# ── FastAPI app ────────────────────────────────────────────────────────────
echo "[startup] Starting FastAPI app on port ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
