"""
Node.js Backend Launcher for DynoPay

Spawns Node.js TypeScript backend and proxies requests to it.
Required because supervisor config is readonly and expects Python/uvicorn.

Architecture:
- Node.js runs on internal port 3300
- This ASGI app proxies all requests from port 8001 to Node.js
- Supervisor manages this Python process, which manages Node.js
"""

import subprocess
import os
import sys
import signal
import atexit
import time
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Internal port for Node.js (not exposed externally)
NODE_PORT = 3300
NODE_PROCESS = None
HTTP_CLIENT = None

def start_node_server():
    """Start Node.js TypeScript server on internal port."""
    global NODE_PROCESS
    
    env = os.environ.copy()
    env['PORT'] = str(NODE_PORT)
    
    print("=" * 60)
    print(f" DYNOPAY - Starting Node.js Backend (internal port {NODE_PORT})")
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
        print(f"[Launcher] Node.js started successfully (PID: {NODE_PROCESS.pid})", flush=True)
    else:
        print(f"[Launcher] WARNING: Node.js may have failed to start", flush=True)
    
    return NODE_PROCESS

def stop_node_server():
    """Stop the Node.js server."""
    global NODE_PROCESS
    if NODE_PROCESS and NODE_PROCESS.poll() is None:
        print("[Launcher] Stopping Node.js server...", flush=True)
        NODE_PROCESS.terminate()
        try:
            NODE_PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            NODE_PROCESS.kill()
            NODE_PROCESS.wait()
        print("[Launcher] Node.js server stopped", flush=True)

# Register cleanup
atexit.register(stop_node_server)

def handle_signal(signum, frame):
    print(f"[Launcher] Received signal {signum}", flush=True)
    stop_node_server()
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

@asynccontextmanager
async def lifespan(scope):
    """ASGI lifespan - start/stop Node.js."""
    global HTTP_CLIENT
    
    # Start Node.js
    start_node_server()
    
    # Create HTTP client for proxying
    HTTP_CLIENT = httpx.AsyncClient(
        base_url=f"http://127.0.0.1:{NODE_PORT}",
        timeout=httpx.Timeout(60.0, connect=10.0)
    )
    
    yield
    
    # Cleanup
    await HTTP_CLIENT.aclose()
    stop_node_server()

async def proxy_request(scope, receive, send):
    """Proxy HTTP request to Node.js backend."""
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
        # Node.js not ready yet
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
                # Start Node.js on startup
                start_node_server()
                HTTP_CLIENT = httpx.AsyncClient(
                    base_url=f"http://127.0.0.1:{NODE_PORT}",
                    timeout=httpx.Timeout(60.0, connect=10.0)
                )
                await send({'type': 'lifespan.startup.complete'})
            elif message['type'] == 'lifespan.shutdown':
                if HTTP_CLIENT:
                    await HTTP_CLIENT.aclose()
                stop_node_server()
                await send({'type': 'lifespan.shutdown.complete'})
                return
    elif scope['type'] == 'http':
        await proxy_request(scope, receive, send)
