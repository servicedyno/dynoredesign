"""
Node.js launcher - spawns Node.js TypeScript backend on port 8001.
This file exists only because supervisor config is readonly and expects Python.
The actual backend is pure Node.js/TypeScript.
"""

import subprocess
import os
import sys
import signal
import atexit
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Node.js will handle port 8001 directly  
os.environ['PORT'] = '8001'

# Start Node.js immediately when this module is imported
print("=" * 60)
print("Starting Node.js TypeScript backend on port 8001...")
print("=" * 60)

NODE_PROCESS = subprocess.Popen(
    ['/app/backend/node_modules/.bin/ts-node', '--transpile-only', 'server.ts'],
    cwd='/app/backend',
    env=os.environ.copy(),
    stdout=sys.stdout,
    stderr=sys.stderr
)

def cleanup():
    """Cleanup Node.js process on exit."""
    global NODE_PROCESS
    if NODE_PROCESS and NODE_PROCESS.poll() is None:
        print("Shutting down Node.js server...")
        NODE_PROCESS.terminate()
        try:
            NODE_PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            NODE_PROCESS.kill()

atexit.register(cleanup)

# Handle signals
def signal_handler(signum, frame):
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Minimal ASGI app - uvicorn needs this but won't use it
# All traffic goes to Node.js on port 8001
async def app(scope, receive, send):
    """Dummy ASGI app - Node.js handles all requests on port 8001."""
    # This should never be called since Node.js binds to 8001 first
    if scope['type'] == 'http':
        await send({
            'type': 'http.response.start',
            'status': 503,
            'headers': [[b'content-type', b'text/plain']],
        })
        await send({
            'type': 'http.response.body',
            'body': b'Node.js backend is handling requests on port 8001',
        })
