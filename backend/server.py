#!/usr/bin/env python3
"""
Minimal launcher for Node.js TypeScript backend.
This replaces the Python process with Node.js using exec.
Required because supervisor config is readonly and expects a Python entry point.
"""

import os
import sys

# Change to backend directory
os.chdir('/app/backend')

# Set PORT to 8001 (what supervisor expects)
os.environ['PORT'] = '8001'

# Load .env file manually for Node.js
from dotenv import dotenv_values
env_path = '/app/backend/.env'
if os.path.exists(env_path):
    env_vars = dotenv_values(env_path)
    for key, value in env_vars.items():
        if value is not None:
            os.environ[key] = value

# Replace this process with Node.js ts-node
# This completely replaces Python with Node.js - no proxy, no subprocess
os.execvp(
    '/app/backend/node_modules/.bin/ts-node',
    ['ts-node', '--transpile-only', 'server.ts']
)
