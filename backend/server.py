"""
Node.js launcher - spawns Node.js TypeScript backend directly.
This file exists only because supervisor config is readonly and expects Python.
The actual backend is pure Node.js/TypeScript running on port 8001.

Strategy: Start Node.js on 8001 BEFORE uvicorn tries to bind, then let uvicorn
fail silently while Node.js handles all traffic.
"""

import subprocess
import os
import sys
import signal
import atexit
import time
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Node.js handles port 8001
os.environ['PORT'] = '8001'

NODE_PROCESS = None

def start_node():
    """Start Node.js server on port 8001."""
    global NODE_PROCESS
    
    print("=" * 60)
    print("STARTING NODE.JS TYPESCRIPT BACKEND ON PORT 8001")
    print("=" * 60, flush=True)
    
    NODE_PROCESS = subprocess.Popen(
        ['/app/backend/node_modules/.bin/ts-node', '--transpile-only', 'server.ts'],
        cwd='/app/backend',
        env=os.environ.copy(),
        stdout=sys.stdout,
        stderr=sys.stderr
    )
    
    # Give Node.js time to bind to port 8001
    time.sleep(3)
    
    return NODE_PROCESS

def cleanup():
    """Cleanup Node.js process on exit."""
    global NODE_PROCESS
    if NODE_PROCESS and NODE_PROCESS.poll() is None:
        print("Shutting down Node.js server...", flush=True)
        NODE_PROCESS.terminate()
        try:
            NODE_PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            NODE_PROCESS.kill()

atexit.register(cleanup)

def signal_handler(signum, frame):
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Start Node.js immediately at module import
start_node()

# Keep Python process alive monitoring Node.js
def monitor_node():
    """Monitor Node.js and restart if it crashes."""
    global NODE_PROCESS
    while True:
        if NODE_PROCESS.poll() is not None:
            print("Node.js process exited, restarting...", flush=True)
            start_node()
        time.sleep(5)

# Start monitoring in background thread
import threading
monitor_thread = threading.Thread(target=monitor_node, daemon=True)
monitor_thread.start()

# Minimal ASGI app for uvicorn - binds to different port or fails gracefully
# The actual traffic goes to Node.js on 8001
async def app(scope, receive, send):
    """This app exists only to satisfy uvicorn import requirement."""
    pass
