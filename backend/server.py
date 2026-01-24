"""
Node.js Backend Launcher for DynoPay

Simple launcher that spawns Node.js directly on port 8001.
Python/uvicorn runs on a dummy port to satisfy supervisor requirements.

Architecture:
- Main Backend: Node.js on port 8001 (handles all traffic)
- API Service: Node.js on port 3301 (external merchant API)  
- Python/uvicorn: Dummy ASGI app on port 9999 (just keeps supervisor happy)
"""

import subprocess
import os
import sys
import signal
import atexit
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Port for main Node.js backend
BACKEND_PORT = 8001
# API Service port (external)
API_SERVICE_PORT = int(os.environ.get('API_SERVICE_PORT', 3301))

# Process references
BACKEND_PROCESS = None
API_SERVICE_PROCESS = None

def start_backend_server():
    """Start main Node.js TypeScript backend on port 8001."""
    global BACKEND_PROCESS
    
    env = os.environ.copy()
    env['PORT'] = str(BACKEND_PORT)
    
    print("=" * 60, flush=True)
    print(f" DYNOPAY - Starting Main Backend (port {BACKEND_PORT})", flush=True)
    print("=" * 60, flush=True)
    
    BACKEND_PROCESS = subprocess.Popen(
        [
            '/app/backend/node_modules/.bin/ts-node',
            '--transpile-only',
            'server.ts'
        ],
        cwd='/app/backend',
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True
    )
    
    # Stream output in separate thread
    def stream_output():
        for line in iter(BACKEND_PROCESS.stdout.readline, ''):
            if line:
                print(f"[Backend] {line.rstrip()}", flush=True)
    
    import threading
    output_thread = threading.Thread(target=stream_output, daemon=True)
    output_thread.start()
    
    # Wait a bit for startup
    time.sleep(4)
    
    if BACKEND_PROCESS.poll() is None:
        print(f"[Launcher] ✅ Main Backend started (PID: {BACKEND_PROCESS.pid})", flush=True)
    else:
        print(f"[Launcher] ❌ ERROR: Main Backend failed to start", flush=True)
        sys.exit(1)
    
    return BACKEND_PROCESS

def start_api_service():
    """Start API Service on its configured port."""
    global API_SERVICE_PROCESS
    
    env = os.environ.copy()
    env['API_SERVICE_PORT'] = str(API_SERVICE_PORT)
    
    print("=" * 60, flush=True)
    print(f" DYNOPAY - Starting API Service (port {API_SERVICE_PORT})", flush=True)
    print("=" * 60, flush=True)
    
    API_SERVICE_PROCESS = subprocess.Popen(
        [
            '/app/backend/node_modules/.bin/ts-node',
            '--transpile-only',
            'api-service/server.ts'
        ],
        cwd='/app/backend',
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True
    )
    
    # Stream output in separate thread  
    def stream_output():
        for line in iter(API_SERVICE_PROCESS.stdout.readline, ''):
            if line:
                print(f"[API] {line.rstrip()}", flush=True)
    
    import threading
    output_thread = threading.Thread(target=stream_output, daemon=True)
    output_thread.start()
    
    # Wait a bit for startup
    time.sleep(3)
    
    if API_SERVICE_PROCESS.poll() is None:
        print(f"[Launcher] ✅ API Service started (PID: {API_SERVICE_PROCESS.pid})", flush=True)
    else:
        print(f"[Launcher] ⚠️  WARNING: API Service may have failed to start", flush=True)
    
    return API_SERVICE_PROCESS

def stop_all_services():
    """Stop all Node.js services gracefully."""
    global BACKEND_PROCESS, API_SERVICE_PROCESS
    
    for name, process in [("Main Backend", BACKEND_PROCESS), ("API Service", API_SERVICE_PROCESS)]:
        if process and process.poll() is None:
            print(f"[Launcher] Stopping {name}...", flush=True)
            process.terminate()
            try:
                process.wait(timeout=10)
                print(f"[Launcher] {name} stopped gracefully", flush=True)
            except subprocess.TimeoutExpired:
                print(f"[Launcher] {name} did not stop gracefully, forcing...", flush=True)
                process.kill()
                process.wait()
                print(f"[Launcher] {name} stopped forcefully", flush=True)

# Register cleanup handlers
atexit.register(stop_all_services)

def handle_signal(signum, frame):
    """Handle termination signals."""
    print(f"[Launcher] Received signal {signum}, shutting down...", flush=True)
    stop_all_services()
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

def monitor_and_keep_alive():
    """Monitor services and restart if they crash."""
    global BACKEND_PROCESS, API_SERVICE_PROCESS
    
    print("[Launcher] Monitoring services...", flush=True)
    
    while True:
        time.sleep(10)
        
        # Check main backend
        if BACKEND_PROCESS and BACKEND_PROCESS.poll() is not None:
            print("[Launcher] ⚠️  Main Backend crashed, restarting...", flush=True)
            time.sleep(2)
            start_backend_server()
        
        # Check API service
        if API_SERVICE_PROCESS and API_SERVICE_PROCESS.poll() is not None:
            print("[Launcher] ⚠️  API Service crashed, restarting...", flush=True)
            time.sleep(2)
            start_api_service()

# Track if services started
_services_started = False

# Minimal ASGI app (uvicorn requirement, but Node.js handles actual traffic on port 8001)
async def app(scope, receive, send):
    """
    Minimal ASGI stub. Node.js handles all real traffic on port 8001.
    This just launches Node.js and keeps Python alive for supervisor.
    """
    global _services_started
    
    if scope['type'] == 'lifespan':
        message = await receive()
        if message['type'] == 'lifespan.startup':
            if not _services_started:
                # Start both Node.js services
                start_backend_server()
                start_api_service()
                _services_started = True
                
                # Monitor in background
                import threading
                monitor_thread = threading.Thread(target=monitor_and_keep_alive, daemon=True)
                monitor_thread.start()
            
            await send({'type': 'lifespan.startup.complete'})
            
        message = await receive()
        if message['type'] == 'lifespan.shutdown':
            stop_all_services()
            await send({'type': 'lifespan.shutdown.complete'})
    
    elif scope['type'] == 'http':
        # This should never be called - Node.js is on port 8001
        await send({
            'type': 'http.response.start',
            'status': 200,
            'headers': [(b'content-type', b'text/plain')],
        })
        await send({
            'type': 'http.response.body',
            'body': b'Python launcher running. Node.js backend is on port 8001.',
        })

# If run directly  
if __name__ == '__main__':
    print("[Launcher] Starting DynoPay services directly...", flush=True)
    start_backend_server()
    start_api_service()
    
    try:
        monitor_and_keep_alive()
    except KeyboardInterrupt:
        print("\n[Launcher] Shutting down...", flush=True)
        stop_all_services()
