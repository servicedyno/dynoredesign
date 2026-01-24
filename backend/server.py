"""
Node.js launcher - spawns Node.js TypeScript backend on port 8001.
This file exists only because supervisor config is readonly and expects Python.
The actual backend is pure Node.js/TypeScript.
"""

import subprocess
import os
import sys
import signal
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Node.js will handle port 8001 directly
os.environ['PORT'] = '8001'

def run_node_server():
    """Run Node.js server directly on port 8001."""
    process = subprocess.Popen(
        ['/app/backend/node_modules/.bin/ts-node', '--transpile-only', 'server.ts'],
        cwd='/app/backend',
        env=os.environ.copy(),
        stdout=sys.stdout,
        stderr=sys.stderr
    )
    return process

def main():
    """Main entry point - runs Node.js and waits."""
    print("Starting Node.js TypeScript backend on port 8001...")
    
    node_process = run_node_server()
    
    # Handle signals to properly terminate Node.js
    def signal_handler(signum, frame):
        print(f"Received signal {signum}, shutting down Node.js...")
        node_process.terminate()
        node_process.wait()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Wait for Node.js process
    try:
        node_process.wait()
    except KeyboardInterrupt:
        node_process.terminate()
        node_process.wait()

if __name__ == "__main__":
    main()

# Dummy ASGI app for uvicorn (required by supervisor config)
# This won't actually be used since we run main() first
async def app(scope, receive, send):
    pass
