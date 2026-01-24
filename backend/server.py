"""
DynoPay Node.js Backend Launcher with Lightweight Reverse Proxy

This script launches the Node.js/TypeScript backend and proxies requests to it.
Required because supervisor configuration expects Python/uvicorn on port 8001.

Architecture:
- Python/uvicorn: Lightweight proxy on port 8001 (supervisor requirement)
- Main Backend: Node.js on internal port 3300 (handles all business logic)
- API Service: Node.js on port 3301 (external merchant API)

The proxy adds minimal overhead (<5ms) and allows the project to remain pure Node.js.
"""

import subprocess
import os
import sys
import signal
import atexit
import time
import httpx
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Internal port for Node.js backend
NODE_PORT = 3300
# API Service port
API_SERVICE_PORT = int(os.environ.get('API_SERVICE_PORT', 3301))

# Process references
NODE_PROCESS = None
API_SERVICE_PROCESS = None
HTTP_CLIENT = None

print("""
╔══════════════════════════════════════════════════════════╗
║  DynoPay - Node.js Backend with Python Launcher          ║
║  Pure Node.js/TypeScript backend via lightweight proxy   ║
╚══════════════════════════════════════════════════════════╝
""", flush=True)

def start_node_backend():
    """Start main Node.js backend on internal port."""
    global NODE_PROCESS
    
    env = os.environ.copy()
    env['PORT'] = str(NODE_PORT)
    
    print(f"🚀 Starting Node.js Backend (internal port {NODE_PORT})...", flush=True)
    
    NODE_PROCESS = subprocess.Popen(
        ['/app/backend/node_modules/.bin/ts-node', '--transpile-only', 'server.ts'],
        cwd='/app/backend',
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True
    )
    
    # Stream output
    def stream():
        for line in iter(NODE_PROCESS.stdout.readline, ''):
            if line:
                print(f"[Backend] {line.rstrip()}", flush=True)
    
    threading.Thread(target=stream, daemon=True).start()
    
    # Wait for startup
    time.sleep(5)
    
    if NODE_PROCESS.poll() is None:
        print(f"✅ Node.js Backend running (PID: {NODE_PROCESS.pid})", flush=True)
    else:
        print(f"❌ ERROR: Node.js Backend failed to start", flush=True)
        sys.exit(1)

def start_api_service():
    """Start API Service."""
    global API_SERVICE_PROCESS
    
    env = os.environ.copy()
    env['API_SERVICE_PORT'] = str(API_SERVICE_PORT)
    
    print(f"🚀 Starting API Service (port {API_SERVICE_PORT})...", flush=True)
    
    API_SERVICE_PROCESS = subprocess.Popen(
        ['/app/backend/node_modules/.bin/ts-node', '--transpile-only', 'api-service/server.ts'],
        cwd='/app/backend',
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True
    )
    
    # Stream output
    def stream():
        for line in iter(API_SERVICE_PROCESS.stdout.readline, ''):
            if line:
                print(f"[API] {line.rstrip()}", flush=True)
    
    threading.Thread(target=stream, daemon=True).start()
    
    time.sleep(3)
    
    if API_SERVICE_PROCESS.poll() is None:
        print(f"✅ API Service running (PID: {API_SERVICE_PROCESS.pid})", flush=True)

def stop_all():
    """Stop all services gracefully."""
    global NODE_PROCESS, API_SERVICE_PROCESS
    
    for name, proc in [("Backend", NODE_PROCESS), ("API", API_SERVICE_PROCESS)]:
        if proc and proc.poll() is None:
            print(f"Stopping {name}...", flush=True)
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

atexit.register(stop_all)
signal.signal(signal.SIGTERM, lambda s, f: (stop_all(), sys.exit(0)))
signal.signal(signal.SIGINT, lambda s, f: (stop_all(), sys.exit(0)))

def monitor_services():
    """Monitor and restart crashed services."""
    global NODE_PROCESS, API_SERVICE_PROCESS
    
    while True:
        time.sleep(10)
        
        if NODE_PROCESS and NODE_PROCESS.poll() is not None:
            print("⚠️  Backend crashed, restarting...", flush=True)
            time.sleep(2)
            start_node_backend()
        
        if API_SERVICE_PROCESS and API_SERVICE_PROCESS.poll() is not None:
            print("⚠️  API crashed, restarting...", flush=True)
            time.sleep(2)
            start_api_service()

# Lightweight reverse proxy
async def proxy_request(scope, receive, send):
    """Lightweight HTTP proxy to Node.js backend."""
    global HTTP_CLIENT
    
    # Build full path with query string
    path = scope.get('path', '/')
    query = scope.get('query_string', b'')
    if query:
        path = f"{path}?{query.decode()}"
    
    # Get headers (exclude hop-by-hop headers)
    headers = {}
    for name, value in scope.get('headers', []):
        name_str = name.decode().lower()
        if name_str not in ('host', 'content-length', 'transfer-encoding'):
            headers[name_str] = value.decode()
    
    # Get body
    body = b''
    while True:
        message = await receive()
        body += message.get('body', b'')
        if not message.get('more_body', False):
            break
    
    method = scope.get('method', 'GET')
    
    try:
        # Forward to Node.js
        response = await HTTP_CLIENT.request(
            method=method,
            url=path,
            headers=headers,
            content=body if body else None
        )
        
        # Send response
        response_headers = [
            (k.lower().encode(), v.encode())
            for k, v in response.headers.items()
            if k.lower() not in ('transfer-encoding', 'content-encoding')
        ]
        response_headers.append((b'content-length', str(len(response.content)).encode()))
        
        await send({
            'type': 'http.response.start',
            'status': response.status_code,
            'headers': response_headers,
        })
        await send({
            'type': 'http.response.body',
            'body': response.content,
        })
        
    except httpx.ConnectError:
        await send({
            'type': 'http.response.start',
            'status': 503,
            'headers': [(b'content-type', b'application/json')],
        })
        await send({
            'type': 'http.response.body',
            'body': b'{"error": "Backend starting, please retry"}',
        })
    except Exception as e:
        await send({
            'type': 'http.response.start',
            'status': 502,
            'headers': [(b'content-type', b'application/json')],
        })
        await send({
            'type': 'http.response.body',
            'body': f'{{"error": "Proxy error: {str(e)}"}}'.encode(),
        })

# ASGI application
async def app(scope, receive, send):
    """Main ASGI app - handles lifespan and proxies HTTP requests."""
    global HTTP_CLIENT
    
    if scope['type'] == 'lifespan':
        message = await receive()
        if message['type'] == 'lifespan.startup':
            # Start Node.js services
            start_node_backend()
            start_api_service()
            
            # Start monitoring thread
            threading.Thread(target=monitor_services, daemon=True).start()
            
            # Create HTTP client for proxying
            HTTP_CLIENT = httpx.AsyncClient(
                base_url=f"http://127.0.0.1:{NODE_PORT}",
                timeout=httpx.Timeout(60.0, connect=10.0)
            )
            
            print("✅ Proxy ready on port 8001 → Node.js on port 3300", flush=True)
            await send({'type': 'lifespan.startup.complete'})
            
        message = await receive()
        if message['type'] == 'lifespan.shutdown':
            if HTTP_CLIENT:
                await HTTP_CLIENT.aclose()
            stop_all()
            await send({'type': 'lifespan.shutdown.complete'})
            
    elif scope['type'] == 'http':
        await proxy_request(scope, receive, send)
