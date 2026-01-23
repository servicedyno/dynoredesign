"""
FastAPI wrapper for Node.js TypeScript backend.
This wrapper spawns the actual Node.js server on a different port
and proxies requests to it.
"""

import subprocess
import os
import signal
import sys
import time
import threading
import atexit
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from contextlib import asynccontextmanager

# Node.js server will run on this internal port
NODE_PORT = 3300
NODE_PROCESS = None


def start_node_server():
    """Start the Node.js TypeScript server as a subprocess."""
    global NODE_PROCESS
    
    env = os.environ.copy()
    env['PORT'] = str(NODE_PORT)
    
    NODE_PROCESS = subprocess.Popen(
        ['npx', 'ts-node', '--transpile-only', 'server.ts'],
        cwd='/app/backend',
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True
    )
    
    # Log output in a separate thread
    def log_output():
        for line in NODE_PROCESS.stdout:
            print(f"[Node.js] {line.strip()}")
    
    log_thread = threading.Thread(target=log_output, daemon=True)
    log_thread.start()
    
    # Wait for server to start
    time.sleep(5)
    print(f"Node.js server started on port {NODE_PORT}")


def stop_node_server():
    """Stop the Node.js server."""
    global NODE_PROCESS
    if NODE_PROCESS:
        NODE_PROCESS.terminate()
        NODE_PROCESS.wait()
        print("Node.js server stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Start Node.js server
    start_node_server()
    yield
    # Cleanup
    stop_node_server()


# Register cleanup handler
atexit.register(stop_node_server)

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    """Proxy all requests to the Node.js server."""
    # Build the target URL
    target_url = f"http://127.0.0.1:{NODE_PORT}/{path}"
    
    # Get query parameters
    if request.query_params:
        target_url += f"?{request.query_params}"
    
    # Get request body
    body = await request.body()
    
    # Forward headers (excluding host)
    headers = dict(request.headers)
    headers.pop('host', None)
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
            
            # Return response with same status and headers
            excluded_headers = {'content-encoding', 'content-length', 'transfer-encoding', 'connection'}
            response_headers = {
                k: v for k, v in response.headers.items()
                if k.lower() not in excluded_headers
            }
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get('content-type')
            )
        except httpx.ConnectError:
            return Response(
                content='{"error": "Backend service unavailable"}',
                status_code=503,
                media_type='application/json'
            )
        except Exception as e:
            return Response(
                content=f'{{"error": "{str(e)}"}}',
                status_code=500,
                media_type='application/json'
            )
