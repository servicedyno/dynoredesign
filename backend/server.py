"""
Node.js Backend Launcher for DynoPay

Spawns TWO Node.js TypeScript services:
1. Main Backend (port 3300 internal) - proxied to 8001
2. API Service (port 3301) - external merchant API

Required because supervisor config is readonly and expects Python/uvicorn.

Architecture:
- Main Backend: Node.js on internal port 3300, proxied via this ASGI app on 8001
- API Service: Node.js on port 3301 (direct access, no proxy needed)
- Supervisor manages this Python process, which manages both Node.js services
"""

import subprocess
import os
import sys
import signal
import atexit
import time
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import httpx
import threading

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Internal port for main Node.js backend
NODE_PORT = 3300
# API Service port (external)
API_SERVICE_PORT = int(os.environ.get('API_SERVICE_PORT', 3301))

# Process references
NODE_PROCESS = None
API_SERVICE_PROCESS = None
HTTP_CLIENT = None

def start_node_server():
    """Start main Node.js TypeScript backend on internal port."""
    global NODE_PROCESS
    
    env = os.environ.copy()
    env['PORT'] = str(NODE_PORT)
    
    print("=" * 60)
    print(f" DYNOPAY - Starting Main Backend (internal port {NODE_PORT})")
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
    
    # Wait for Node.js to start
    time.sleep(4)
    
    if NODE_PROCESS.poll() is None:
        print(f"[Launcher] Main Backend started (PID: {NODE_PROCESS.pid})", flush=True)
    else:
        print(f"[Launcher] WARNING: Main Backend may have failed to start", flush=True)
    
    return NODE_PROCESS

def start_api_service():
    """Start API Service on its configured port."""
    global API_SERVICE_PROCESS
    
    env = os.environ.copy()
    env['API_SERVICE_PORT'] = str(API_SERVICE_PORT)
    
    print("=" * 60)
    print(f" DYNOPAY - Starting API Service (port {API_SERVICE_PORT})")
    print("=" * 60, flush=True)
    
    API_SERVICE_PROCESS = subprocess.Popen(
        [
            '/app/backend/node_modules/.bin/ts-node',
            '--transpile-only',
            'api-service/server.ts'
        ],
        cwd='/app/backend',
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    
    # Wait for API Service to start
    time.sleep(3)
    
    if API_SERVICE_PROCESS.poll() is None:
        print(f"[Launcher] API Service started (PID: {API_SERVICE_PROCESS.pid})", flush=True)
    else:
        print(f"[Launcher] WARNING: API Service may have failed to start", flush=True)
    
    return API_SERVICE_PROCESS

def stop_all_services():
    """Stop all Node.js services."""
    global NODE_PROCESS, API_SERVICE_PROCESS
    
    for name, process in [("Main Backend", NODE_PROCESS), ("API Service", API_SERVICE_PROCESS)]:
        if process and process.poll() is None:
            print(f"[Launcher] Stopping {name}...", flush=True)
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            print(f"[Launcher] {name} stopped", flush=True)

# Register cleanup
atexit.register(stop_all_services)

def handle_signal(signum, frame):
    print(f"[Launcher] Received signal {signum}", flush=True)
    stop_all_services()
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

def monitor_services():
    """Monitor and restart services if they crash."""
    global NODE_PROCESS, API_SERVICE_PROCESS
    
    while True:
        time.sleep(10)
        
        # Check main backend
        if NODE_PROCESS and NODE_PROCESS.poll() is not None:
            print("[Launcher] Main Backend crashed, restarting...", flush=True)
            time.sleep(2)
            start_node_server()
        
        # Check API service
        if API_SERVICE_PROCESS and API_SERVICE_PROCESS.poll() is not None:
            print("[Launcher] API Service crashed, restarting...", flush=True)
            time.sleep(2)
            start_api_service()

async def proxy_request(scope, receive, send):
    """Proxy HTTP request to Node.js main backend."""
    global HTTP_CLIENT
    
    # Build path with query string
    path = scope.get('path', '/')
    query_string = scope.get('query_string', b'')
    if query_string:
        path = f"{path}?{query_string.decode()}"
    
    # Get headers
    headers = {}
    for name, value in scope.get('headers', []):
        name = name.decode()
        if name.lower() not in ('host', 'content-length'):
            headers[name] = value.decode()
    
    # Get request body
    body = b''
    while True:
        message = await receive()
        body += message.get('body', b'')
        if not message.get('more_body', False):
            break
    
    method = scope.get('method', 'GET')
    
    try:
        # Forward request to Node.js
        response = await HTTP_CLIENT.request(
            method=method,
            url=path,
            headers=headers,
            content=body if body else None
        )
        
        # Send response back
        response_headers = [
            (k.lower().encode(), v.encode())
            for k, v in response.headers.items()
            if k.lower() not in ('content-encoding', 'transfer-encoding', 'content-length')
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
            'body': b'{"error": "Backend starting up, please retry"}',
        })
    except Exception as e:
        print(f"[Proxy] Error: {e}", flush=True)
        await send({
            'type': 'http.response.start',
            'status': 502,
            'headers': [(b'content-type', b'application/json')],
        })
        await send({
            'type': 'http.response.body',
            'body': f'{{"error": "Proxy error: {str(e)}"}}'.encode(),
        })

async def app(scope, receive, send):
    """Main ASGI application."""
    global HTTP_CLIENT
    
    if scope['type'] == 'lifespan':
        while True:
            message = await receive()
            if message['type'] == 'lifespan.startup':
                # Start both Node.js services
                start_node_server()
                start_api_service()
                
                # Start monitoring thread
                monitor_thread = threading.Thread(target=monitor_services, daemon=True)
                monitor_thread.start()
                
                # Create HTTP client for proxying
                HTTP_CLIENT = httpx.AsyncClient(
                    base_url=f"http://127.0.0.1:{NODE_PORT}",
                    timeout=httpx.Timeout(60.0, connect=10.0)
                )
                
                await send({'type': 'lifespan.startup.complete'})
                
            elif message['type'] == 'lifespan.shutdown':
                if HTTP_CLIENT:
                    await HTTP_CLIENT.aclose()
                stop_all_services()
                await send({'type': 'lifespan.shutdown.complete'})
                return
                
    elif scope['type'] == 'http':
        await proxy_request(scope, receive, send)
