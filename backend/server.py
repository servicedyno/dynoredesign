"""
Node.js Backend Launcher

This module spawns Node.js TypeScript backend on port 8001.
Exists because supervisor is readonly and expects a Python entry point.

The actual DynoPay backend is pure Node.js/TypeScript.
"""

import subprocess
import os
import sys
import signal
import atexit
import time
import socket
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

NODE_PROCESS = None
STARTUP_COMPLETE = False

def is_port_in_use(port):
    """Check if a port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_node_server():
    """Start Node.js TypeScript server on port 8001."""
    global NODE_PROCESS, STARTUP_COMPLETE
    
    # Set Node.js to use port 8001
    env = os.environ.copy()
    env['PORT'] = '8001'
    
    print("=" * 60)
    print(" DYNOPAY - Starting Node.js TypeScript Backend")
    print(" Port: 8001")
    print("=" * 60, flush=True)
    
    NODE_PROCESS = subprocess.Popen(
        [
            '/app/backend/node_modules/.bin/ts-node',
            '--transpile-only',
            'server.ts'
        ],
        cwd='/app/backend',
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    
    # Wait for Node.js to start and bind to port
    for i in range(30):  # Wait up to 30 seconds
        time.sleep(1)
        if is_port_in_use(8001):
            print(f"[Launcher] Node.js successfully bound to port 8001", flush=True)
            STARTUP_COMPLETE = True
            break
        if NODE_PROCESS.poll() is not None:
            print(f"[Launcher] Node.js process exited unexpectedly", flush=True)
            break
    
    return NODE_PROCESS

def cleanup():
    """Terminate Node.js on exit."""
    global NODE_PROCESS
    if NODE_PROCESS and NODE_PROCESS.poll() is None:
        print("[Launcher] Shutting down Node.js...", flush=True)
        NODE_PROCESS.terminate()
        try:
            NODE_PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            NODE_PROCESS.kill()
        print("[Launcher] Node.js stopped", flush=True)

atexit.register(cleanup)

def handle_signal(signum, frame):
    """Handle termination signals."""
    print(f"[Launcher] Received signal {signum}", flush=True)
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

# ============================================================
# START NODE.JS IMMEDIATELY
# ============================================================
# This runs when uvicorn imports this module
start_node_server()

# Keep the launcher alive, monitoring Node.js
def keep_alive():
    """Keep launcher running and restart Node if needed."""
    global NODE_PROCESS
    while True:
        time.sleep(10)
        if NODE_PROCESS and NODE_PROCESS.poll() is not None:
            exit_code = NODE_PROCESS.returncode
            print(f"[Launcher] Node.js exited with code {exit_code}, restarting...", flush=True)
            time.sleep(2)
            start_node_server()

# Run keep_alive in background thread
import threading
keep_alive_thread = threading.Thread(target=keep_alive, daemon=True)
keep_alive_thread.start()

# ============================================================
# ASGI APP (required by uvicorn but not used)
# ============================================================
# uvicorn will fail to bind to 8001 since Node.js has it
# That's expected - Node.js handles all traffic
async def app(scope, receive, send):
    """Placeholder ASGI app - Node.js handles port 8001."""
    pass
