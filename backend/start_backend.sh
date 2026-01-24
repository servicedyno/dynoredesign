#!/bin/bash
# Wrapper script to run uvicorn on dummy port while Node.js uses port 8001
# This satisfies supervisor's expectation while allowing Node.js to handle real traffic

cd /app/backend
exec /root/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 9999 --workers 1
